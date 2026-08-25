import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { findMissingQueryBeforeNext } from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";
import { isServerInstanceContext } from "../context/index.js";

export const requireQueryBeforeNext = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a proven GlideRecord binding to use a documented query executor before advancing its cursor with `.next()` or `._next()`. `chooseWindow()` does not execute a query.",
      url: ruleDocsUrl("require-query-before-next"),
    },
    messages: {
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
        const { analysis } = beginRuleFile(context);
        for (const finding of findMissingQueryBeforeNext(node as ESTree.Node, analysis)) {
          context.report({
            node: finding.node,
            messageId: "missingQuery",
            data: { name: finding.name, method: finding.method },
          });
        }
      },
    };
  },
});
