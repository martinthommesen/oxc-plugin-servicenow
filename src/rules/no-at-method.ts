import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { memberName } from "../utils/ast.js";
import { usesClassicEngine } from "../utils/filenames.js";

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
        const member = memberName((node as ESTree.CallExpression).callee);
        if (!member || member.property !== "at") return;
        const arg = (node as ESTree.CallExpression).arguments[0];
        context.report({
          node,
          messageId: "at",
          suggest:
            arg && arg.type !== "SpreadElement"
              ? [
                  {
                    desc: "Replace with an index access",
                    fix(fixer) {
                      const obj = context.sourceCode.getText(
                        ((node as ESTree.CallExpression).callee as ESTree.MemberExpression)
                          .object as unknown as ESTree.Node,
                      );
                      const index = context.sourceCode.getText(arg as unknown as ESTree.Node);
                      return fixer.replaceText(node, `${obj}[${index}]`);
                    },
                  },
                ]
              : undefined,
        });
      },
    };
  },
});
