import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findChooseWindowWithoutNoCount } from "../analysis/internal.js";
import { isServerInstanceContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const preferSetnocountWithChoosewindow = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `setNoCount()` (or `setLimit()`) before `query()` when a proven GlideRecord uses `chooseWindow()`. `query()` after `chooseWindow()` runs `COUNT(*)` unless the count is skipped. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html",
      url: ruleDocsUrl("prefer-setnocount-with-choosewindow"),
    },
    messages: {
      missing:
        "`{{name}}.query()` after `chooseWindow()` runs a `COUNT(*)` unless `setNoCount()` or `setLimit()` skips it. Add `{{name}}.setNoCount()` before `query()` when the full match count is unused.",
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
        for (const finding of findChooseWindowWithoutNoCount(node as ESTree.Node, analysis)) {
          context.report({
            node: finding.node,
            messageId: "missing",
            data: { name: finding.name },
          });
        }
      },
    };
  },
});
