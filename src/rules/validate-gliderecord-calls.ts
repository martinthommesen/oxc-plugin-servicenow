import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, isExpressionStatementCall } from "../utils/ast.js";
import {
  findMissingQueryBeforeNext,
  hasAuthoritativeGlideRecordMethod,
  staticPropertyName,
} from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";
import { isServerInstanceContext } from "../context/index.js";

const UNUSED_RETURN = new Set(["insert", "update", "deleteRecord", "get", "next", "_next"]);

/**
 * @deprecated Split into `require-query-before-next` plus narrower rules.
 * Kept as a migration alias with corrected semantics: `chooseWindow` does not
 * open a cursor, and bulk methods are not treated as having a required return.
 */
export const validateGliderecordCalls = defineRule({
  meta: {
    type: "problem",
    deprecated: {
      message:
        "Use servicenow/require-query-before-next for cursor sequencing. This rule is a temporary alias and is not in recommended or strict.",
      replacedBy: [{ rule: { name: "require-query-before-next" } }],
    },
    docs: {
      description:
        "Deprecated. Prefer `require-query-before-next`. Still reports missing query-before-cursor-advance and unused insert/update/deleteRecord/get/next/_next returns on proven GlideRecord bindings.",
      url: ruleDocsUrl("validate-gliderecord-calls"),
    },
    messages: {
      unusedReturn:
        "The return value of `{{name}}.{{method}}()` is ignored. Check `insert`, `update`, `deleteRecord`, `get`, `next`, and `_next`. Bulk methods such as `updateMultiple` and `deleteMultiple` are not flagged.",
      missingQuery:
        "`{{name}}.{{method}}()` is called without a preceding documented query executor on every path. Execute the query on every path before advancing the cursor; `chooseWindow()` only configures a later query.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isServerInstanceContext(script)) return false;
      },
      Program(node) {
        const { analysis, file } = beginRuleFile(context);
        for (const finding of findMissingQueryBeforeNext(node as ESTree.Node, analysis, file)) {
          context.report({
            node: finding.node,
            messageId: "missingQuery",
            data: { name: finding.name, method: finding.method },
          });
        }
      },
      CallExpression(node) {
        const { analysis, file } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        const member = call.callee as ESTree.MemberExpression;
        const object = getName(member.object);
        const method = staticPropertyName(member);
        if (!object || !method || !UNUSED_RETURN.has(method)) return;
        const proven = analysis.ofExpression(member.object);
        if (!proven || proven.kind !== "GlideRecord" || proven.invalid || proven.escaped) return;
        if (!hasAuthoritativeGlideRecordMethod(file, member.object, method)) return;
        const ancestors = context.sourceCode.getAncestors(node);
        const parent = ancestors[ancestors.length - 1];
        if (!isExpressionStatementCall(parent)) return;
        context.report({
          node,
          messageId: "unusedReturn",
          data: { name: object, method },
        });
      },
    };
  },
});
