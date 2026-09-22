import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { isServerInstanceContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { provenReceiverMethod, type FileAnalysis } from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";

const RELATIONAL = new Set(["<", ">", "<=", ">=", "-"]);

function isDisplayValueCall(node: ESTree.Node, file: FileAnalysis): boolean {
  return (
    node.type === "CallExpression" &&
    provenReceiverMethod(file, node as ESTree.CallExpression, {
      kind: "GlideDateTime",
      method: "getDisplayValue",
    }) !== null
  );
}

export const noDisplayValueDateComparison = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Do not relationally compare `GlideDateTime.getDisplayValue()` strings. They follow the session format, not chronological order. Use `getNumericValue()` or a date-aware API. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideDateTimeAPI.html",
      url: ruleDocsUrl("no-display-value-date-comparison"),
    },
    messages: {
      displayCompare:
        "`getDisplayValue()` is a locale-formatted string. Compare `getNumericValue()` or use a date API instead of `{{op}}`.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { script } = beginRuleFile(context);
        if (!isServerInstanceContext(script)) return false;
        return undefined;
      },
      BinaryExpression(node) {
        const file = beginRuleFile(context);
        const expr = node as ESTree.BinaryExpression;
        if (!RELATIONAL.has(expr.operator)) return;
        if (
          isDisplayValueCall(expr.left as ESTree.Node, file) ||
          isDisplayValueCall(expr.right as ESTree.Node, file)
        ) {
          context.report({ node, messageId: "displayCompare", data: { op: expr.operator } });
        }
      },
    };
  },
});
