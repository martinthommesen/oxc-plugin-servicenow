import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { staticPropertyName } from "../analysis/index.js";
import { isServerInstanceContext } from "../context/index.js";
import { GLIDE_SYSTEM_BYPASS_METHODS } from "../glide/query-methods.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const noSystemQueryBypass = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Review documented GlideRecord methods that bypass query ACLs (`addSystemQuery`, `addSystemEncodedQuery`, `addSystemOrderBy`, `addSystemOrderByDesc`). This is a security review diagnostic, not a claim that every use is wrong. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html",
      url: ruleDocsUrl("no-system-query-bypass"),
    },
    messages: {
      bypass:
        "`{{method}}()` bypasses query ACL enforcement. Keep it only when system-level access is intended, and document the reason in a disable comment.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isServerInstanceContext(script)) return false;
      },
      CallExpression(node) {
        const { analysis } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        const method = staticPropertyName(call.callee);
        if (!method || !GLIDE_SYSTEM_BYPASS_METHODS.has(method)) return;
        const proven = analysis.ofExpression((call.callee as ESTree.MemberExpression).object);
        if (proven?.kind !== "GlideRecord" || proven.invalid || proven.escaped) return;
        context.report({ node, messageId: "bypass", data: { method } });
      },
    };
  },
});
