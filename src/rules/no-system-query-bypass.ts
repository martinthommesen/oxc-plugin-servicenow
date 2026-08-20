import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { staticPropertyName } from "../analysis/index.js";
import { isNode, walk } from "../utils/ast.js";
import { isServerInstanceContext } from "../context/index.js";
import { GLIDE_SYSTEM_BYPASS_METHODS } from "../glide/query-methods.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

function sameObjectArgument(
  call: ESTree.CallExpression,
  objectId: number | undefined,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
): boolean {
  if (objectId === undefined) return false;
  return call.arguments.some((argument) => analysis.ofExpression(argument)?.objectId === objectId);
}

/**
 * The analysis marks a receiver escaped after visiting call arguments. For
 * `gr.addSystemQuery(gr)`, that is an escape caused by the call being checked,
 * not evidence that the receiver was already unsafe. Find escapes before this
 * call so the receiver guard remains conservative for earlier helper/storage
 * escapes while preserving this definite bypass diagnostic.
 */
function escapedBefore(
  call: ESTree.CallExpression,
  objectId: number | undefined,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
  program: ESTree.Node,
): boolean {
  if (objectId === undefined) return true;
  let found = false;
  walk(program as unknown as Record<string, unknown>, {
    Identifier(node) {
      if (found || typeof node.start !== "number" || node.start >= (call.start ?? 0)) return;
      const proven = analysis.ofExpression(node);
      if (proven?.objectId === objectId && proven.escaped) found = true;
    },
    MemberExpression(node) {
      if (found || typeof node.start !== "number" || node.start >= (call.start ?? 0)) return;
      const proven = analysis.ofExpression(node);
      if (proven?.objectId === objectId && proven.escaped) found = true;
    },
  });
  return found;
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
        const object = (call.callee as ESTree.MemberExpression).object;
        const proven = analysis.ofExpression(object);
        if (!proven || proven.kind !== "GlideRecord" || proven.invalid) return;
        if (proven.escaped) {
          const sameArgument = sameObjectArgument(call, proven.objectId, analysis);
          const program = context.sourceCode.ast as unknown;
          if (!sameArgument || !isNode(program) || escapedBefore(call, proven.objectId, analysis, program)) {
            return;
          }
        }
        context.report({ node, messageId: "bypass", data: { method } });
      },
    };
  },
});
