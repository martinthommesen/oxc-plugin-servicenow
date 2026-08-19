import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findGlideElementCollections } from "../analysis/glide-element-collection.js";
import { isServerInstanceContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const noGlideelementInCollection = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Do not push a GlideElement from a GlideRecord cursor into a collection. The element follows the cursor. Extract `getValue()`, `getDisplayValue()`, or `toString()`. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html",
      url: ruleDocsUrl("no-glideelement-in-collection"),
    },
    messages: {
      retained:
        "`{{name}}` field access yields a GlideElement bound to the current cursor. Extract a value before `push` / `unshift`.",
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
        for (const finding of findGlideElementCollections(node as ESTree.Node, analysis)) {
          context.report({ node: finding.node, messageId: "retained", data: { name: finding.name } });
        }
      },
    };
  },
});
