import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { staticPropertyName, type ProvenanceQuery } from "../analysis/index.js";
import { isClientCapableContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { getName, isNode } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

const NON_CALLABLE_EXPRESSIONS = new Set([
  "Literal",
  "TemplateLiteral",
  "ObjectExpression",
  "ArrayExpression",
  "ClassExpression",
]);

function isNullishCallback(node: unknown, analysis: ProvenanceQuery): boolean {
  if (!node) return true;
  if (!isNode(node)) return false;
  if (node.type === "Identifier" && getName(node) === "undefined") {
    return analysis.isPlatformGlobal(node);
  }
  if (node.type === "Literal") {
    const value = (node as { value?: unknown }).value;
    return value === null || value === undefined;
  }
  if (node.type === "UnaryExpression") {
    return (node as ESTree.UnaryExpression).operator === "void";
  }
  return false;
}

function isStaticallyNonCallable(node: unknown): boolean {
  return isNode(node) && NON_CALLABLE_EXPRESSIONS.has(node.type);
}

export const requireCallbackForGetreference = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a callback on `g_form.getReference()`. The one-argument form is a synchronous server request. Evidence: https://www.servicenow.com/docs/r/api-reference/c_GlideFormAPI.html",
      url: ruleDocsUrl("require-callback-for-getreference"),
    },
    messages: {
      missingCallback:
        "`getReference()` without a callback blocks the browser. Pass a function as the second argument.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isClientCapableContext(script)) return false;
      },
      CallExpression(node) {
        const { analysis } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        if (staticPropertyName(call.callee) !== "getReference") return;
        const object = (call.callee as ESTree.MemberExpression).object;
        const proven = analysis.ofExpression(object);
        if (proven?.kind !== "g_form" || proven.invalid || proven.escaped) return;
        // A spread has unknown runtime arity. It may supply a callback even
        // when no syntactic second argument is present.
        if (call.arguments.some((argument) => argument.type === "SpreadElement")) return;
        const callback = call.arguments[1];
        if (
          call.arguments.length >= 2 &&
          !isNullishCallback(callback, analysis) &&
          !isStaticallyNonCallable(callback)
        ) return;
        context.report({ node, messageId: "missingCallback" });
      },
    };
  },
});
