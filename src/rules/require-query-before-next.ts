import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { nodeStart } from "../utils/ast.js";
import { findMissingQueryBeforeNext } from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";
import { isServerInstanceContext } from "../context/index.js";

export const requireQueryBeforeNext = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a proven GlideRecord binding to call `.query()` or `.get()` before `.next()`. `chooseWindow()` does not execute a query.",
      url: ruleDocsUrl("require-query-before-next"),
    },
    messages: {
      missingQuery:
        "`{{name}}.next()` is called without a preceding `.query()` or `.get()` on every path. Call `.query()` or `.get()` on every path before `.next()`; `chooseWindow()` only configures a later query.",
    },
  },
  createOnce(context) {
    const reported = new Set<number>();
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isServerInstanceContext(script)) return false;
      },
      Program(node) {
        const { analysis } = beginRuleFile(context);
        for (const finding of findMissingQueryBeforeNext(node as ESTree.Node, analysis)) {
          const start = nodeStart(finding.node);
          if (reported.has(start)) continue;
          reported.add(start);
          context.report({
            node: finding.node,
            messageId: "missingQuery",
            data: { name: finding.name },
          });
        }
      },
    };
  },
});
