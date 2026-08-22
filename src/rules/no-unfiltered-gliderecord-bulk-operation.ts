import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findUnfilteredBulkOperations } from "../analysis/glide-bulk-filter.js";
import { isServerInstanceContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const noUnfilteredGliderecordBulkOperation = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        'Report `updateMultiple()` / `deleteMultiple()` on a proven GlideRecord when no restricting filter with a non-empty argument ran on every path. `query`, `orderBy`, `setLimit`, `chooseWindow`, and empty `addQuery()` / `addEncodedQuery("")` are not filters. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html',
      url: ruleDocsUrl("no-unfiltered-gliderecord-bulk-operation"),
    },
    messages: {
      unfiltered:
        "`{{name}}.{{method}}()` has no proven query filter. Add `addQuery` / `addEncodedQuery` (or another documented filter), or suppress this with a rationale for a whole-table job.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isServerInstanceContext(script)) return false;
      },
      Program(node) {
        const { analysis } = beginRuleFile(context);
        for (const finding of findUnfilteredBulkOperations(node as ESTree.Node, analysis)) {
          context.report({
            node: finding.node,
            messageId: "unfiltered",
            data: { name: finding.name, method: finding.method },
          });
        }
      },
    };
  },
});
