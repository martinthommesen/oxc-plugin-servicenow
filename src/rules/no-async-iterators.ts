import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";

export const noAsyncIterators = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `for await…of` and async generators in instance-executed ServiceNow scripts. Both remain disallowed in ES2021.",
      url: ruleDocsUrl("no-async-iterators"),
    },
    messages: {
      forAwait:
        "`for await…of` is disallowed on the ServiceNow JavaScript engine, including ES2021 mode. Use a synchronous loop.",
      asyncGen:
        "Async generators are disallowed on the ServiceNow JavaScript engine, including ES2021 mode. Use a synchronous generator or return an array.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "async-iterators")) return false;
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
