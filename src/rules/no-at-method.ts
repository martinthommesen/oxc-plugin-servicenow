import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { staticPropertyName } from "../analysis/index.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";

export const noAtMethod = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `.at()` in Compatibility and ES5 ServiceNow scripts. ES2021 supports Array/String.prototype.at.",
      url: ruleDocsUrl("no-at-method"),
    },
    messages: {
      at: "`.at()` is not supported in Compatibility or ES5 Standards mode. Use `charAt` or an index expression. This rule cannot prove the receiver is Array/String versus a user method; it reports only in known ES5/Compatibility files.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "at-method")) return false;
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        if (staticPropertyName(call.callee) !== "at") return;
        context.report({ node, messageId: "at" });
      },
    };
  },
});
