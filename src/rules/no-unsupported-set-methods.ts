import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  hasAuthoritativeConstructedMethod,
  isInvocationAvailabilityGuarded,
  provenReceiver,
  resolveConstValue,
  resolvePlatformGlobalName,
  staticPropertyName,
  type ProvenanceQuery,
} from "../analysis/internal.js";
import { ruleDocsUrl } from "../constants.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { isNode, unwrapExpression } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

const SET_METHODS = new Set([
  "difference",
  "intersection",
  "isDisjointFrom",
  "isSubsetOf",
  "isSupersetOf",
  "symmetricDifference",
  "union",
]);

interface SetMethodAccess {
  readonly method: string;
  readonly object: ESTree.Node;
  readonly objectId: number;
}

function setMethodAccess(node: unknown, analysis: ProvenanceQuery): SetMethodAccess | null {
  const value = resolveConstValue(node, analysis.bindings);
  if (!value || value.type !== "MemberExpression") return null;
  const method = staticPropertyName(value);
  if (!method || !SET_METHODS.has(method)) return null;
  const object = value.object as ESTree.Node;
  const receiver = provenReceiver(analysis, object, "Set");
  if (receiver?.objectId === undefined) return null;
  return { method, object, objectId: receiver.objectId };
}

function isSetPrototype(node: unknown, analysis: ProvenanceQuery): boolean {
  const value = resolveConstValue(node, analysis.bindings);
  return Boolean(
    value?.type === "MemberExpression" &&
    staticPropertyName(value) === "prototype" &&
    resolvePlatformGlobalName(value.object, analysis.bindings) === "Set",
  );
}

function isSetPrototypeMethodAccess(
  node: unknown,
  method: string,
  analysis: ProvenanceQuery,
): boolean {
  const value = resolveConstValue(node, analysis.bindings);
  return Boolean(
    value?.type === "MemberExpression" &&
    staticPropertyName(value) === method &&
    isSetPrototype(value.object, analysis),
  );
}

export const noUnsupportedSetMethods = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Set composition methods that the configured ServiceNow release does not support.",
      url: ruleDocsUrl("no-unsupported-set-methods"),
    },
    messages: {
      unsupported:
        "`Set.prototype.{{method}}()` is not supported by the configured ServiceNow release and JavaScript mode.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { script } = beginRuleFile(context);
        if (script.javascriptMode !== "es2021" || !shouldDiagnoseFeature(script, "set-methods")) {
          return false;
        }
        return undefined;
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        const rawCallee = unwrapExpression(call.callee);
        if (!isNode(rawCallee) || rawCallee.type !== "MemberExpression") return;

        const file = beginRuleFile(context);
        const { provenance } = file;
        const access = setMethodAccess(rawCallee, provenance);
        if (!access) return;
        if (!hasAuthoritativeConstructedMethod(file, access.object, "Set", access.method)) {
          return;
        }

        const isSameAccess = (candidate: unknown): boolean => {
          const other = setMethodAccess(candidate, provenance);
          return Boolean(
            (other?.method === access.method && other.objectId === access.objectId) ||
            isSetPrototypeMethodAccess(candidate, access.method, provenance),
          );
        };
        const isSameOwner = (candidate: ESTree.Node): boolean => {
          if (isSetPrototype(candidate, provenance)) return true;
          const receiver = provenReceiver(provenance, candidate, "Set");
          return receiver?.objectId === access.objectId;
        };

        if (
          isInvocationAvailabilityGuarded(context, call, provenance, isSameAccess, {
            isPropertyExistenceTest: (property, object) =>
              property === access.method && isSameOwner(object),
            isOptionalInvocation: (invocation) =>
              invocation.type === "CallExpression" &&
              invocation.optional &&
              isSameAccess(invocation.callee),
          })
        ) {
          return;
        }

        context.report({
          node: call,
          messageId: "unsupported",
          data: { method: access.method },
        });
      },
    };
  },
});
