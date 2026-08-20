import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findWindowedDeleteMultiple } from "../analysis/index.js";
import { isServerInstanceContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const noDeleteMultipleWithWindowing = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `deleteMultiple()` on a proven GlideRecord after `setLimit()` or `chooseWindow()`. Those APIs do not limit bulk deletion. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html",
      url: ruleDocsUrl("no-delete-multiple-with-windowing"),
    },
    messages: {
      windowed:
        "`{{name}}.deleteMultiple()` ignores a preceding `setLimit()` / `chooseWindow()`. Remove the window, or delete records one at a time after `query()` / `next()`.",
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
        for (const finding of findWindowedDeleteMultiple(node as ESTree.Node, analysis)) {
          context.report({
            node: finding.node,
            messageId: "windowed",
            data: { name: finding.name },
          });
        }
      },
    };
  },
});
