import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { isCallTo } from "../utils/ast.js";
import type { ScriptKind } from "../types.js";
import { classifyFromContext } from "../utils/filenames.js";

export const noGsNow = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `gs.now()` and `gs.nowDateTime()`. They are timezone-unsafe, and `gs.now()` is unsupported on the client since London.",
      recommended: "recommended",
      url: ruleDocsUrl("no-gs-now"),
    },
    hasSuggestions: true,
    messages: {
      client:
        "`gs.now()` has not been available in client scripts since London. Use `new GlideDateTime()` (or a display value from the server).",
      server:
        "`gs.now()` returns a display string in the session timezone and is easy to misuse. Prefer `new GlideDateTime()`.",
      nowDateTime:
        "`gs.nowDateTime()` returns a display string in the session timezone. Prefer `new GlideDateTime()`.",
    },
  },
  createOnce(context) {
    let kind: ScriptKind;
    return {
      before() {
        kind = classifyFromContext(context);
      },
      CallExpression(node) {
        const isNow = isCallTo(node, "gs", "now");
        const isNowDateTime = isCallTo(node, "gs", "nowDateTime");
        if (!isNow && !isNowDateTime) return;
        const messageId = isNowDateTime ? "nowDateTime" : kind === "client" ? "client" : "server";
        context.report({
          node,
          messageId,
          suggest: [
            {
              desc: "Replace with new GlideDateTime().getDisplayValue()",
              fix(fixer) {
                return fixer.replaceText(node as ESTree.Node, "new GlideDateTime().getDisplayValue()");
              },
            },
            {
              desc: "Replace with new GlideDateTime()",
              fix(fixer) {
                return fixer.replaceText(node as ESTree.Node, "new GlideDateTime()");
              },
            },
          ],
        });
      },
    };
  },
});
