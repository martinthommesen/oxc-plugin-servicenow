import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, getStringValue } from "../utils/ast.js";
import { usesClassicEngine } from "../utils/filenames.js";

function numericLiteralValue(node: unknown): number | null {
  if (!node || typeof node !== "object") return null;
  const rec = node as { type?: string; value?: unknown };
  if (rec.type !== "Literal" && rec.type !== "NumericLiteral") return null;
  return typeof rec.value === "number" ? rec.value : null;
}

export const noAtMethod = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `.at()` — it is not implemented on the classic ServiceNow JavaScript engine.",
      recommended: "recommended",
      url: ruleDocsUrl("no-at-method"),
    },
    hasSuggestions: true,
    messages: {
      at: "`.at()` is not supported in the classic ServiceNow JavaScript engine. Use `charAt` / an index expression instead.",
    },
  },
  createOnce(context) {
    return {
      before() {
        if (!usesClassicEngine(context)) return false;
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        const callee = call.callee as ESTree.MemberExpression;
        const property = callee.computed
          ? getStringValue(callee.property)
          : getName(callee.property);
        if (property !== "at") return;
        const arg = call.arguments[0];
        const obj = context.sourceCode.getText(callee.object as unknown as ESTree.Node);

        let replacement: string | undefined;
        const positive = numericLiteralValue(arg);
        if (arg && arg.type !== "SpreadElement" && positive !== null && positive >= 0) {
          replacement = `${obj}[${positive}]`;
        } else if (arg && arg.type === "UnaryExpression" && arg.operator === "-") {
          const k = numericLiteralValue((arg as ESTree.UnaryExpression).argument);
          if (k !== null && k > 0 && callee.object.type === "Identifier") {
            replacement = `${obj}[${obj}.length - ${k}]`;
          }
        }

        context.report({
          node,
          messageId: "at",
          suggest: replacement
            ? [
                {
                  desc: "Replace with an index access",
                  fix(fixer) {
                    return fixer.replaceText(node, replacement);
                  },
                },
              ]
            : undefined,
        });
      },
    };
  },
});
