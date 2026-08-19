import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { usesClassicEngine } from "../utils/filenames.js";

const CTORS = new Set(["WeakMap", "WeakSet", "WeakRef", "FinalizationRegistry"]);

export const noWeakReferences = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow WeakMap / WeakSet / WeakRef / FinalizationRegistry in classic ServiceNow scripts.",
      recommended: "strict",
      url: ruleDocsUrl("no-weak-references"),
    },
    messages: {
      weak: "`{{name}}` is not supported in the classic ServiceNow JavaScript engine. Use `Map` / `Set` (or a plain object).",
    },
  },
  createOnce(context) {
    return {
      before() {
        if (!usesClassicEngine(context)) return false;
      },
      NewExpression: check,
      CallExpression: check,
    };

    function check(node: ESTree.NewExpression | ESTree.CallExpression) {
      const name = getName(node.callee);
      if (!name || !CTORS.has(name)) return;
      context.report({ node, messageId: "weak", data: { name } });
    }
  },
});
