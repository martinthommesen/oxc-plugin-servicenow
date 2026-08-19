import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { propertyName } from "../utils/ast.js";

export const noSyncGlideajax = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow synchronous `GlideAjax.getXMLWait()`. It blocks the browser and does not work in Service Portal.",
      recommended: "recommended",
      url: ruleDocsUrl("no-sync-glideajax"),
    },
    messages: {
      wait: "`getXMLWait()` is a synchronous server call. It freezes the form and is unavailable in Service Portal. Use `getXML()` or `getXMLAnswer()` with a callback.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (propertyName((node as ESTree.CallExpression).callee) !== "getXMLWait") return;
        context.report({ node, messageId: "wait" });
      },
    };
  },
});
