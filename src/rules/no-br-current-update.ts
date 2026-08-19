import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { isCallTo } from "../utils/ast.js";
import type { ScriptKind } from "../types.js";
import { classifyFromContext } from "../utils/filenames.js";

export const noBrCurrentUpdate = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `current.update()` in Business Rules. It retriggers other rules and can recurse.",
      recommended: "recommended",
      url: ruleDocsUrl("no-br-current-update"),
    },
    messages: {
      update:
        "Do not call `current.update()` in a Business Rule. Assign fields on `current` and let the platform save the record (use a *before* rule). Calling `update()` retriggers other Business Rules and can recurse.",
    },
  },
  createOnce(context) {
    let kind: ScriptKind;
    return {
      before() {
        kind = classifyFromContext(context);
      },
      CallExpression(node) {
        if (!isCallTo(node, "current", "update")) return;
        if (kind === "client" || kind === "ui-action") return;
        context.report({ node: node as ESTree.Node, messageId: "update" });
      },
    };
  },
});
