import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findGlideAggregateIssues } from "../analysis/index.js";
import { isServerInstanceContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const validateGlideaggregateCalls = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `query()` on a proven GlideAggregate before `next()` / `getAggregate()`, and match static `getAggregate(type, field?)` tuples to `addAggregate`.",
      url: ruleDocsUrl("validate-glideaggregate-calls"),
    },
    messages: {
      missingQuery:
        "`{{name}}.{{method}}()` runs before `query()`. Configure aggregates, call `query()`, then read results.",
      unknownAggregate:
        "`{{name}}.getAggregate()` reads `{{tuple}}`, which was not registered with `addAggregate()`.",
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
        for (const finding of findGlideAggregateIssues(node as ESTree.Node, analysis)) {
          context.report({
            node: finding.node,
            messageId: finding.messageId,
            data: {
              name: finding.name,
              method: finding.method,
              tuple: finding.tuple ?? "",
            },
          });
        }
      },
    };
  },
});
