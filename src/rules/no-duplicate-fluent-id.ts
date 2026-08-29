import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findDuplicateFluentIds } from "../analysis/internal.js";
import { isFluentContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const noDuplicateFluentId = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow two Fluent `$id` values that use the same static `Now.ID` key in one file. Cross-file duplicates are out of scope.",
      url: ruleDocsUrl("no-duplicate-fluent-id"),
    },
    messages: {
      duplicate:
        "`Now.ID['{{key}}']` is already used as `$id` in this file. Give this definition a distinct identity.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
      },
      Program(node) {
        const { analysis, file } = beginRuleFile(context);
        for (const finding of findDuplicateFluentIds(node as ESTree.Node, analysis, file.nowIdAt)) {
          context.report({
            node: finding.node,
            messageId: "duplicate",
            data: { key: finding.key },
          });
        }
      },
    };
  },
});
