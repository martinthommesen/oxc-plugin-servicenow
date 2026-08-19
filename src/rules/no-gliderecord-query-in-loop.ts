import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findQueriesInCursorLoops } from "../analysis/glide-query-in-loop.js";
import { isServerInstanceContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const noGliderecordQueryInLoop = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when a proven GlideRecord / GlideAggregate `query()` or `get()` runs inside an outer `.next()` cursor loop. This is an N+1 pattern. Helpers stay silent.",
      url: ruleDocsUrl("no-gliderecord-query-in-loop"),
    },
    messages: {
      nestedQuery:
        "`{{name}}.{{method}}()` runs inside a GlideRecord cursor loop. Prefer a display/reference value or one query outside the loop.",
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
        for (const finding of findQueriesInCursorLoops(node as ESTree.Node, analysis)) {
          context.report({
            node: finding.node,
            messageId: "nestedQuery",
            data: { name: finding.name, method: finding.method },
          });
        }
      },
    };
  },
});
