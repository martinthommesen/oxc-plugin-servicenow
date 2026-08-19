import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findQueryModifiersAfterQuery } from "../analysis/glide-query-lifecycle.js";
import { isServerInstanceContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const noGliderecordQueryModifierAfterQuery = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Query modifiers after `query()` / `get()` do not change the open cursor. Report when `next()` or another consumer runs before a second query. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html",
      url: ruleDocsUrl("no-gliderecord-query-modifier-after-query"),
    },
    messages: {
      lateModifier:
        "`{{name}}.{{method}}()` consumes a cursor after a query modifier. Call `query()` again, or move the modifier before the first query.",
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
        for (const finding of findQueryModifiersAfterQuery(node as ESTree.Node, analysis)) {
          context.report({
            node: finding.node,
            messageId: "lateModifier",
            data: { name: finding.name, method: finding.method },
          });
        }
      },
    };
  },
});
