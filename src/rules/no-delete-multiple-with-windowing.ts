import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findWindowedDeleteMultiple } from "../analysis/internal.js";
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
        const { script } = beginRuleFile(context);
        if (!isServerInstanceContext(script)) return false;
        return undefined;
      },
      Program(node) {
        const file = beginRuleFile(context);
        for (const finding of findWindowedDeleteMultiple(
          node as ESTree.Node,
          file.provenance,
          file,
        )) {
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
