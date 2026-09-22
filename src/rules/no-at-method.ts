import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import {
  hasAuthoritativeConstructedMethod,
  isInvocationAvailabilityGuarded,
  resolveConstValue,
  resolvePlatformGlobalName,
  staticPropertyName,
  type ProvenanceQuery,
} from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { isNode } from "../utils/ast.js";

type AtConstructor = "Array" | "String";

function builtInAtReceiver(node: unknown, analysis: ProvenanceQuery): AtConstructor | null {
  const value = resolveConstValue(node, analysis.bindings);
  if (!isNode(value)) return null;
  if (value.type === "ArrayExpression") return "Array";
  if (value.type === "Literal" && typeof (value as { value?: unknown }).value === "string")
    return "String";
  return null;
}

function isPrototypeAtAccess(
  node: unknown,
  constructorName: AtConstructor,
  analysis: ProvenanceQuery,
): boolean {
  const access = resolveConstValue(node, analysis.bindings);
  if (!access || access.type !== "MemberExpression" || staticPropertyName(access) !== "at") {
    return false;
  }
  return isBuiltInPrototype(access.object, constructorName, analysis);
}

function isBuiltInPrototype(
  node: unknown,
  constructorName: AtConstructor,
  analysis: ProvenanceQuery,
): boolean {
  const owner = resolveConstValue(node, analysis.bindings);
  return Boolean(
    owner?.type === "MemberExpression" &&
    staticPropertyName(owner) === "prototype" &&
    resolvePlatformGlobalName(owner.object, analysis.bindings) === constructorName,
  );
}

export const noAtMethod = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `.at()` in Compatibility and ES5 ServiceNow scripts. ES2021 supports Array/String.prototype.at.",
      url: ruleDocsUrl("no-at-method"),
    },
    messages: {
      at: "`.at()` is not supported in Compatibility or ES5 Standards mode. Use `charAt()` for strings or an index expression for arrays.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "at-method")) return false;
        return undefined;
      },
      CallExpression(node) {
        const file = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        if (staticPropertyName(call.callee) !== "at") return;
        const constructorName = builtInAtReceiver(call.callee.object, file.provenance);
        if (!constructorName) return;
        if (!hasAuthoritativeConstructedMethod(file, call.callee.object, constructorName, "at")) {
          return;
        }
        if (
          isInvocationAvailabilityGuarded(
            context,
            call,
            file.provenance,
            (candidate) => isPrototypeAtAccess(candidate, constructorName, file.provenance),
            {
              isPropertyExistenceTest: (property, object) =>
                property === "at" && isBuiltInPrototype(object, constructorName, file.provenance),
              isOptionalInvocation: (invocation) =>
                invocation === call && invocation.type === "CallExpression" && invocation.optional,
            },
          )
        ) {
          return;
        }
        context.report({ node, messageId: "at" });
      },
    };
  },
});
