import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  isDefinitelyNonCallable,
  isInvocationAvailabilityGuarded,
  platformGlobalNamespaceAccess,
  resolveConstValue,
  resolveDestructuredConstMember,
  resolvePlatformGlobalName,
  staticPropertyName,
  type ProvenanceQuery,
} from "../analysis/internal.js";
import { INVOCATION_HELPERS, ruleDocsUrl } from "../constants.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { isNode, unwrapExpression } from "../utils/ast.js";
import { beginRuleFile, isPlatformStaticMember, platformNamespaceIsSafe } from "./helpers.js";

function destructuredObjectHasOwnSource(
  node: ESTree.Node,
  analysis: ProvenanceQuery,
): ESTree.Node | null {
  const selected = resolveDestructuredConstMember(node, analysis.bindings);
  if (
    !selected ||
    selected.property !== "hasOwn" ||
    resolvePlatformGlobalName(selected.source, analysis.bindings) !== "Object" ||
    (selected.fallback !== null && !isDefinitelyNonCallable(selected.fallback, analysis.bindings))
  ) {
    return null;
  }
  return selected.source;
}

function objectHasOwnAccess(node: unknown, analysis: ProvenanceQuery): ESTree.Node | null {
  let value = resolveConstValue(node, analysis.bindings);
  if (!value) return null;
  if (value.type === "SequenceExpression") {
    const last = value.expressions.at(-1);
    value = last ? resolveConstValue(last, analysis.bindings) : null;
  }
  if (!value) return null;
  if (value.type === "Identifier") {
    const source = destructuredObjectHasOwnSource(value, analysis);
    if (source) return source;
  }
  if (value.type !== "MemberExpression" || staticPropertyName(value) !== "hasOwn") return null;
  const object = resolveConstValue(value.object, analysis.bindings);
  if (!object || resolvePlatformGlobalName(object, analysis.bindings) !== "Object") return null;
  return value;
}

function invokedObjectHasOwn(
  call: ESTree.CallExpression,
  analysis: ProvenanceQuery,
): ESTree.Node | null {
  const rawCallee = resolveConstValue(call.callee, analysis.bindings);
  const reflectApply = isPlatformStaticMember(call.callee, "Reflect", "apply", analysis);
  let value = reflectApply ? resolveConstValue(call.arguments[0], analysis.bindings) : rawCallee;
  if (value?.type === "SequenceExpression") {
    const last = value.expressions.at(-1);
    value = last ? resolveConstValue(last, analysis.bindings) : null;
  }
  if (
    value?.type === "MemberExpression" &&
    INVOCATION_HELPERS.has(staticPropertyName(value) ?? "")
  ) {
    value = resolveConstValue(value.object, analysis.bindings);
  }
  return objectHasOwnAccess(value, analysis);
}

function isOptionalObjectHasOwnInvocation(
  invocation: ESTree.CallExpression | ESTree.NewExpression,
  analysis: ProvenanceQuery,
): boolean {
  if (invocation.type !== "CallExpression") return false;
  if (invocation.optional && objectHasOwnAccess(invocation.callee, analysis)) return true;
  const callee = unwrapExpression(invocation.callee);
  if (!isNode(callee) || callee.type !== "MemberExpression" || !callee.optional) return false;
  if (!INVOCATION_HELPERS.has(staticPropertyName(callee) ?? "")) return false;
  return objectHasOwnAccess(callee.object, analysis) !== null;
}

export const noObjectHasown = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Object.hasOwn() when the configured ServiceNow release and JavaScript mode do not support it.",
      url: ruleDocsUrl("no-object-hasown"),
    },
    messages: {
      unsupported:
        "`Object.hasOwn()` is not supported by the configured ServiceNow release and JavaScript mode. Use `Object.prototype.hasOwnProperty.call()`.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "object-hasown")) return false;
        return undefined;
      },
      CallExpression(node) {
        const file = beginRuleFile(context);
        const { provenance } = file;
        const call = node as ESTree.CallExpression;
        const invokedAccess = invokedObjectHasOwn(call, provenance);
        if (!invokedAccess) return;
        const namespaceIsSafe = (candidate: ESTree.Node): boolean => {
          const namespace = platformGlobalNamespaceAccess(candidate, provenance.bindings);
          return namespace === null || platformNamespaceIsSafe(context, namespace, file);
        };
        if (
          namespaceIsSafe(invokedAccess) &&
          isInvocationAvailabilityGuarded(
            context,
            call,
            provenance,
            (candidate) => {
              const access = objectHasOwnAccess(candidate, provenance);
              return access !== null && namespaceIsSafe(access);
            },
            {
              isPropertyExistenceTest: (property, object) =>
                property === "hasOwn" &&
                resolvePlatformGlobalName(object, provenance.bindings) === "Object" &&
                namespaceIsSafe(object),
              isOptionalInvocation: (invocation) =>
                isOptionalObjectHasOwnInvocation(invocation, provenance),
            },
          )
        ) {
          return;
        }
        if (file.mutations.isGlobalWritten("Object")) return;
        if (file.mutations.isGlobalPathWritten(["Object", "hasOwn"])) return;
        context.report({ node, messageId: "unsupported" });
      },
    };
  },
});
