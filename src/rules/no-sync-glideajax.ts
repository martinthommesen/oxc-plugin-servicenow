import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { staticPropertyName } from "../analysis/internal.js";
import { isClientCapableContext } from "../context/index.js";
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
        if (!isClientCapableContext(beginRuleFile(context).context)) return false;
      },
      CallExpression(node) {
        const { analysis } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        const member = call.callee as ESTree.MemberExpression;
        if (staticPropertyName(member) !== "getXMLWait") return;
        const object = member.object;
        const proven = analysis.ofExpression(object);
        if (proven?.kind === "GlideAjax" && !proven.invalid && !proven.escaped) {
          context.report({ node, messageId: "wait" });
          return;
        }
        const name = getName(object);
        if (name === "GlideAjax") return;
        // Direct `new GlideAjax(...).getXMLWait()` is covered by ofExpression on
        // the NewExpression object. Unproven receivers are left silent.
      },
    };
  },
});
