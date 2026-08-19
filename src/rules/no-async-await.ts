import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { usesClassicEngine } from "../utils/filenames.js";

export const noAsyncAwait = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow async/await in classic ServiceNow scripts. The legacy engine does not implement them.",
      recommended: "recommended",
      url: ruleDocsUrl("no-async-await"),
    },
    messages: {
      asyncFn:
        "Async functions are not supported in the classic ServiceNow JavaScript engine. Rewrite this as a synchronous Glide script, or enable ES latest (`@sn-es-latest` / `$meta.useEsLatest`).",
      awaitExpr:
        "`await` is not supported in the classic ServiceNow JavaScript engine.",
    },
  },
  createOnce(context) {
    let active = false;

    return {
      before() {
        active = usesClassicEngine(context);
        if (!active) return false;
      },
      FunctionDeclaration: checkFn,
      FunctionExpression: checkFn,
      ArrowFunctionExpression: checkFn,
      AwaitExpression(node) {
        if (!active) return;
        context.report({ node, messageId: "awaitExpr" });
      },
    };

    function checkFn(node: ESTree.Node) {
      if (!active) return;
      if ("async" in node && (node as { async?: boolean }).async) {
        context.report({ node, messageId: "asyncFn" });
      }
    }
  },
});
