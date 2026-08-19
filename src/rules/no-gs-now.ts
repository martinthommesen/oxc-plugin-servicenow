import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { isCallTo } from "../utils/ast.js";
import { classifyFromContext } from "../utils/filenames.js";

export const noGsNow = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `gs.now()`. It is unsupported on the client since London and timezone-unsafe on the server.",
      recommended: "recommended",
      url: ruleDocsUrl("no-gs-now"),
    },
    fixable: "code",
    hasSuggestions: true,
    messages: {
      client:
        "`gs.now()` has not been available in client scripts since London. Use `new GlideDateTime()` (or a display value from the server).",
      server:
        "`gs.now()` returns a display string in the session timezone and is easy to misuse. Prefer `new GlideDateTime()`.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isCallTo(node, "gs", "now")) return;
        const kind = classifyFromContext(context);
        const messageId = kind === "client" ? "client" : "server";
        context.report({
          node,
          messageId,
          fix(fixer) {
            return fixer.replaceText(node as ESTree.Node, "new GlideDateTime()");
          },
          suggest: [
            {
              desc: "Replace with new GlideDateTime()",
              fix(fixer) {
                return fixer.replaceText(node as ESTree.Node, "new GlideDateTime()");
              },
            },
            {
              desc: "Replace with new GlideDateTime().getDisplayValue()",
              fix(fixer) {
                return fixer.replaceText(node as ESTree.Node, "new GlideDateTime().getDisplayValue()");
              },
            },
          ],
        });
      },
    };
  },
});
