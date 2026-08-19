import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { usesClassicEngine } from "../utils/filenames.js";

export const noAsyncIterators = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `for await…of` and async generators in classic ServiceNow scripts.",
      recommended: "strict",
      url: ruleDocsUrl("no-async-iterators"),
    },
    messages: {
      forAwait: "`for await…of` is not supported in the classic ServiceNow JavaScript engine.",
      asyncGen: "Async generators are not supported in the classic ServiceNow JavaScript engine.",
    },
  },
  createOnce(context) {
    return {
      before() {
        if (!usesClassicEngine(context)) return false;
      },
      ForOfStatement(node) {
        if ((node as ESTree.ForOfStatement).await) {
          context.report({ node, messageId: "forAwait" });
        }
      },
      FunctionDeclaration: checkGen,
      FunctionExpression: checkGen,
    };

    function checkGen(node: ESTree.Node) {
      const rec = node as { async?: boolean; generator?: boolean };
      if (rec.async && rec.generator) {
        context.report({ node, messageId: "asyncGen" });
      }
    }
  },
});
