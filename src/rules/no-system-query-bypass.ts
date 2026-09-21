import { defineRule } from "@oxlint/plugins";
import type { Context, ESTree } from "@oxlint/plugins";
import {
  getAncestors,
  hasAuthoritativeGlideRecordMethod,
  isComputedUnknown,
  staticPropertyName,
} from "../analysis/internal.js";
import { isServerInstanceContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

function isWriteTarget(context: Context, node: ESTree.Node): boolean {
  const ancestors = getAncestors(context, node);
  const parent = ancestors[ancestors.length - 1] as ESTree.Node | undefined;
  return Boolean(
    (parent?.type === "AssignmentExpression" &&
      (parent as ESTree.AssignmentExpression).left === node) ||
    (parent?.type === "UpdateExpression" &&
      (parent as ESTree.UpdateExpression).argument === node) ||
    (parent?.type === "UnaryExpression" &&
      (parent as ESTree.UnaryExpression).operator === "delete" &&
      (parent as ESTree.UnaryExpression).argument === node) ||
    (parent?.type === "ForInStatement" && (parent as ESTree.ForInStatement).left === node) ||
    (parent?.type === "ForOfStatement" && (parent as ESTree.ForOfStatement).left === node),
  );
}

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
        const { script } = beginRuleFile(context);
        if (!isServerInstanceContext(script)) return false;
        return undefined;
      },
      MemberExpression(node) {
        const file = beginRuleFile(context);
        const member = node as ESTree.MemberExpression;
        if (isWriteTarget(context, member)) return;
        const method = staticPropertyName(member);
        const possible = isComputedUnknown(member);
        if ((!method || !file.glide.byKind.GlideRecord.systemBypass.has(method)) && !possible)
          return;
        const object = member.object;
        const proven = file.provenance.ofExpression(object);
        if (!proven || proven.kind !== "GlideRecord" || proven.invalid) return;
        if (method && file.glide.byKind.GlideRecord.systemBypass.has(method)) {
          // This opt-in security rule reviews access to ACL-bypass names even
          // when a file also writes that method. File-wide mutation facts do
          // not prove that a later write happened before this access, and an
          // appended write must not suppress an earlier platform call.
          context.report({ node, messageId: "bypass", data: { method } });
        } else {
          if (
            file.bindingWrites.hasDynamicScope() ||
            file.mutations.isGlobalAuthorityLost("GlideRecord") ||
            file.mutations.isGlobalAuthorityLost("GlideRecordSecure")
          ) {
            return;
          }
          if (
            ![...file.glide.byKind.GlideRecord.systemBypass].some((candidate) =>
              hasAuthoritativeGlideRecordMethod(file, object, candidate),
            )
          ) {
            return;
          }
          context.report({ node, messageId: "possibleBypass" });
        }
      },
    };
  },
});
