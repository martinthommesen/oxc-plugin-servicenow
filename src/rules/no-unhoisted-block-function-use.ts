import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findUnhoistedBlockFunctionUses } from "../analysis/internal.js";
import { ruleDocsUrl } from "../constants.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { beginRuleFile } from "./helpers.js";

export const noUnhoistedBlockFunctionUse = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow pre-declaration uses of nested block functions when the configured ServiceNow release does not hoist them correctly.",
      url: ruleDocsUrl("no-unhoisted-block-function-use"),
    },
    messages: {
      unhoisted:
        "`{{name}}` is used before its nested-block declaration, which is not hoisted correctly before ServiceNow Australia. Move the declaration above this use or upgrade to Australia.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "block-function-hoisting")) return false;
      },
      Program(node) {
        const { analysis, file } = beginRuleFile(context);
        for (const finding of findUnhoistedBlockFunctionUses(
          node as ESTree.Node,
          analysis.bindings,
          file.bindingWrites,
        )) {
          context.report({
            node: finding.node,
            messageId: "unhoisted",
            data: { name: finding.name },
          });
        }
      },
    };
  },
});
