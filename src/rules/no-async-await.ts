import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";

export const noAsyncAwait = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow async/await in Compatibility and ES5 ServiceNow scripts. ES2021 instance scripts support async functions.",
      url: ruleDocsUrl("no-async-await"),
    },
    messages: {
      asyncFn:
        "Async functions are not supported in Compatibility or ES5 Standards mode. Rewrite this as a synchronous Glide script, or set `javascriptMode` to `es2021`.",
      awaitExpr: "`await` is not supported in Compatibility or ES5 Standards mode.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "async-await")) return false;
      },
      FunctionDeclaration: checkFn,
      FunctionExpression: checkFn,
      ArrowFunctionExpression: checkFn,
      AwaitExpression(node) {
        context.report({ node, messageId: "awaitExpr" });
      },
    };

    function checkFn(node: ESTree.Node) {
      if ("async" in node && (node as { async?: boolean }).async) {
        context.report({ node, messageId: "asyncFn" });
      }
    }
  },
});
