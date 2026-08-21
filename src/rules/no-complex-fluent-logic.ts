import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { isFluentContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

const BANNED: Record<string, string> = {
  FunctionDeclaration: "function declarations",
  ClassDeclaration: "class declarations",
  ForStatement: "`for` loops",
  ForInStatement: "`for…in` loops",
  ForOfStatement: "`for…of` loops",
  WhileStatement: "`while` loops",
  DoWhileStatement: "`do…while` loops",
  TryStatement: "`try/catch`",
  SwitchStatement: "`switch` statements",
  ThrowStatement: "`throw`",
};

export const noComplexFluentLogic = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Keep `.now.ts` files declarative. Move business logic to server modules and load it with `Now.include()` or an import.",
      recommended: "recommended",
      url: ruleDocsUrl("no-complex-fluent-logic"),
    },
    messages: {
      banned:
        "Avoid {{kind}} inside Fluent metadata files. `.now.ts` should declare records, not implement runtime behaviour. Move the logic to `src/server/` and reference it from the entity.",
      asyncFn:
        "Do not declare async functions in Fluent metadata files. Scripts run on the instance, not during the Fluent build.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
      },
      FunctionDeclaration: banned,
      ClassDeclaration: banned,
      ForStatement: banned,
      ForInStatement: banned,
      ForOfStatement: banned,
      WhileStatement: banned,
      DoWhileStatement: banned,
      TryStatement: banned,
      SwitchStatement: banned,
      ThrowStatement: banned,
      FunctionExpression(node) {
        if ((node as { async?: boolean }).async) {
          context.report({ node, messageId: "asyncFn" });
        }
      },
      ArrowFunctionExpression(node) {
        const fn = node as ESTree.ArrowFunctionExpression;
        if (fn.async) {
          context.report({ node, messageId: "asyncFn" });
          return;
        }
        if (fn.body.type === "BlockStatement" && fn.body.body.length > 2) {
          context.report({
            node,
            messageId: "banned",
            data: { kind: "multi-statement arrow functions" },
          });
        }
      },
    };

    function banned(node: ESTree.Node) {
      const kind = BANNED[node.type];
      if (!kind) return;
      context.report({ node, messageId: "banned", data: { kind } });
    }
  },
});
