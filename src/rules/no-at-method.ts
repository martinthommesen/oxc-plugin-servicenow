import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { resolveConstValue, staticPropertyName } from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { isNode } from "../utils/ast.js";

function isBuiltInAtReceiver(
  node: unknown,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
): boolean {
  const value = resolveConstValue(node, analysis.bindings);
  if (!isNode(value)) return false;
  if (value.type === "ArrayExpression") return true;
  if (value.type === "Literal" && typeof (value as { value?: unknown }).value === "string")
    return true;
  return false;
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
        const { analysis } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        if (staticPropertyName(call.callee) !== "at") return;
        if (!isBuiltInAtReceiver(call.callee.object, analysis)) return;
        context.report({ node, messageId: "at" });
      },
    };
  },
});
