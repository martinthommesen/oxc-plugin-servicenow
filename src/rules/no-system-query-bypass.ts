import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  hasAuthoritativeGlideRecordMethod,
  isComputedUnknown,
  staticPropertyName,
} from "../analysis/internal.js";
import { isServerInstanceContext } from "../context/index.js";
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
      possibleBypass:
        "Computed access on a GlideRecord can select a query ACL-bypass method. Use an explicit method and document system-level access.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isServerInstanceContext(script)) return false;
      },
      MemberExpression(node) {
        const { analysis, file } = beginRuleFile(context);
        const member = node as ESTree.MemberExpression;
        const method = staticPropertyName(member);
        const possible = isComputedUnknown(member);
        if ((!method || !analysis.glide.systemBypass.has(method)) && !possible) return;
        const object = member.object;
        const proven = analysis.ofExpression(object);
        if (!proven || proven.kind !== "GlideRecord" || proven.invalid) return;
        if (method && analysis.glide.systemBypass.has(method)) {
          if (!hasAuthoritativeGlideRecordMethod(file, object, method)) return;
          context.report({ node, messageId: "bypass", data: { method } });
        } else {
          if (
            file.bindingWrites.hasDynamicScope() ||
            file.mutations.isGlobalAuthorityLost("GlideRecord") ||
            file.mutations.isGlobalAuthorityLost("GlideRecordSecure")
          ) {
            return;
          }
          context.report({ node, messageId: "possibleBypass" });
        }
      },
    };
  },
});
