import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  isAvailabilityGuarded,
  isInvocationAvailabilityGuarded,
} from "../analysis/availability.js";
import {
  directPlatformGlobalName,
  platformGlobalNamespaceAccess,
  resolvePlatformGlobalName,
} from "../analysis/globals.js";
import {
  isDefinitelyNonCallable,
  resolveConstValue,
  resolveDestructuredConstMember,
  staticPropertyName,
} from "../analysis/internal.js";
import { ruleDocsUrl } from "../constants.js";
import { isFeatureAllowed, shouldDiagnoseFeature } from "../engine/index.js";
import { isNode, unwrapExpression } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

const INVOCATION_HELPERS = new Set(["apply", "bind", "call"]);

function destructuredObjectHasOwnSource(
  node: ESTree.Node,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
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

function objectHasOwnAccess(
  node: unknown,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
): ESTree.Node | null {
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
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
): ESTree.Node | null {
  const rawCallee = resolveConstValue(call.callee, analysis.bindings);
  const reflectApply = Boolean(
    rawCallee?.type === "MemberExpression" &&
    staticPropertyName(rawCallee) === "apply" &&
    resolvePlatformGlobalName(rawCallee.object, analysis.bindings) === "Reflect",
  );
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
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
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
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "object-hasown")) return false;
      },
      CallExpression(node) {
        const { analysis, context: script, file } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "object-hasown")) return;
        const call = node as ESTree.CallExpression;
        const invokedAccess = invokedObjectHasOwn(call, analysis);
        if (!invokedAccess) return;
        const namespaceIsSafe = (candidate: ESTree.Node): boolean => {
          const namespace = platformGlobalNamespaceAccess(candidate, analysis.bindings);
          return (
            namespace === null ||
            isFeatureAllowed("global-this", script.javascriptMode, script.settings.release) ||
            isAvailabilityGuarded(
              context,
              namespace,
              analysis,
              (access) => directPlatformGlobalName(access, analysis.bindings) === "globalThis",
              {
                allowDirectAccessGuard: false,
                guardCacheKey: "global-this",
              },
            )
          );
        };
        if (
          namespaceIsSafe(invokedAccess) &&
          isInvocationAvailabilityGuarded(
            context,
            call,
            analysis,
            (candidate) => {
              const access = objectHasOwnAccess(candidate, analysis);
              return access !== null && namespaceIsSafe(access);
            },
            {
              guardCacheKey: "no-object-hasown",
              isPropertyExistenceTest: (property, object) =>
                property === "hasOwn" &&
                resolvePlatformGlobalName(object, analysis.bindings) === "Object" &&
                namespaceIsSafe(object),
              isOptionalInvocation: (invocation) =>
                isOptionalObjectHasOwnInvocation(invocation, analysis),
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
