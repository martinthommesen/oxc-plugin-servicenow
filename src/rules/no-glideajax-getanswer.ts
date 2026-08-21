import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { staticPropertyName } from "../analysis/internal.js";
import { isClientCapableContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
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
        const { context: script } = beginRuleFile(context);
        if (!isClientCapableContext(script)) return false;
      },
      CallExpression(node) {
        const { analysis } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        if (staticPropertyName(call.callee) !== "getAnswer") return;
        const proven = analysis.ofExpression((call.callee as ESTree.MemberExpression).object);
        if (proven?.kind !== "GlideAjax" || proven.invalid || proven.escaped) return;
        context.report({ node, messageId: "getAnswer" });
      },
    };
  },
});
