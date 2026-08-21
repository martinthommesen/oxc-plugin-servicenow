import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl, TYPED_ARRAY_CTORS } from "../constants.js";
import { getName } from "../utils/ast.js";
import { usesClassicEngine } from "../utils/filenames.js";

const CTORS = new Set<string>(TYPED_ARRAY_CTORS);

export const noTypedArrays = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow TypedArray and DataView constructors in classic ServiceNow scripts.",
      recommended: "recommended",
      url: ruleDocsUrl("no-typed-arrays"),
    },
    messages: {
      ctor: "`{{name}}` is not supported in the classic ServiceNow JavaScript engine. Use a plain Array or a string of bytes.",
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
      context.report({ node, messageId: "ctor", data: { name } });
    }
  },
});
