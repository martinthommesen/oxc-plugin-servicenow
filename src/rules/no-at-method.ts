import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { isInvocationAvailabilityGuarded } from "../analysis/availability.js";
import { resolvePlatformGlobalName } from "../analysis/globals.js";
import {
  hasAuthoritativeConstructedMethod,
  resolveConstValue,
  staticPropertyName,
} from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { isNode } from "../utils/ast.js";

type AtConstructor = "Array" | "String";

function builtInAtReceiver(
  node: unknown,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
): AtConstructor | null {
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
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
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
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
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
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "at-method")) return false;
      },
      CallExpression(node) {
        const { analysis, file } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        if (staticPropertyName(call.callee) !== "at") return;
        const constructorName = builtInAtReceiver(call.callee.object, analysis);
        if (!constructorName) return;
        if (!hasAuthoritativeConstructedMethod(file, call.callee.object, constructorName, "at")) {
          return;
        }
        if (
          isInvocationAvailabilityGuarded(
            context,
            call,
            analysis,
            (candidate) => isPrototypeAtAccess(candidate, constructorName, analysis),
            {
              guardCacheKey: `no-at-method:${constructorName}`,
              isPropertyExistenceTest: (property, object) =>
                property === "at" && isBuiltInPrototype(object, constructorName, analysis),
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
