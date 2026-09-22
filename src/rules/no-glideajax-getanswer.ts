import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { isClientCapableContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { provenReceiverMethod } from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";

export const noGlideajaxGetanswer = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `GlideAjax.getAnswer()` on proven GlideAjax bindings. It belongs to the synchronous `getXMLWait()` pattern and can run before an async request finishes. Evidence: https://www.servicenow.com/docs/r/api-reference/c_GlideAjaxAPI.html",
      url: ruleDocsUrl("no-glideajax-getanswer"),
    },
    messages: {
      getAnswer:
        "`getAnswer()` reads a synchronous GlideAjax result. Use `getXMLAnswer(callback)` or read the answer from the `getXML` callback.",
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
          method: "getAnswer",
          runtime: "browser",
        });
        if (!access) return;
        context.report({ node, messageId: "getAnswer" });
      },
    };
  },
});
