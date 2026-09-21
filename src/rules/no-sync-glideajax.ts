import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { isClientCapableContext } from "../context/index.js";
import { provenReceiverMethod } from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";

export const noSyncGlideajax = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow synchronous `GlideAjax.getXMLWait()` on proven GlideAjax bindings. It blocks the browser and does not work in Service Portal.",
      url: ruleDocsUrl("no-sync-glideajax"),
    },
    messages: {
      wait: "`getXMLWait()` is a synchronous server call. It freezes the form and is unavailable in Service Portal. Use `getXML()` or `getXMLAnswer()` with a callback.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { script } = beginRuleFile(context);
        if (!isClientCapableContext(script)) return false;
        return undefined;
      },
      CallExpression(node) {
        const file = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        const access = provenReceiverMethod(file, call, {
          kind: "GlideAjax",
          method: "getXMLWait",
          runtime: "browser",
        });
        if (!access) return;
        context.report({ node, messageId: "wait" });
      },
    };
  },
});
