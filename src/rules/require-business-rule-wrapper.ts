import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { appliesOnSurface } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { getName, isNode } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

function paramName(param: unknown): string | null {
  if (!isNode(param)) return null;
  if (param.type === "Identifier") return getName(param);
  if (param.type === "AssignmentPattern") {
    const pattern = param as ESTree.AssignmentPattern;
    return getName(pattern.left);
  }
  return null;
}

function isCurrentPreviousCall(args: ESTree.CallExpression["arguments"]): boolean {
  return args.length >= 2 && getName(args[0]) === "current" && getName(args[1]) === "previous";
}

function hasCurrentPreviousParams(callee: { params: unknown[] }): boolean {
  return paramName(callee.params[0]) === "current" && paramName(callee.params[1]) === "previous";
}

function isWrapperExpression(node: unknown): boolean {
  if (!isNode(node) || node.type !== "CallExpression") return false;
  const call = node as ESTree.CallExpression;
  if (!isCurrentPreviousCall(call.arguments)) return false;
  const callee = call.callee;
  if (callee.type !== "FunctionExpression" && callee.type !== "ArrowFunctionExpression") {
    return false;
  }
  return hasCurrentPreviousParams(callee as { params: unknown[] });
}

function isWrapperStatement(node: ESTree.Node): boolean {
  if (node.type === "ExpressionStatement") {
    return isWrapperExpression((node as ESTree.ExpressionStatement).expression);
  }
  return false;
}

function isIgnorable(node: ESTree.Node): boolean {
  return node.type === "EmptyStatement" || node.type === "DebuggerStatement";
}

export const requireBusinessRuleWrapper = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the standard `executeRule(current, previous)` IIFE in full-script Business Rules so top-level bindings do not leak. Inactive unless `businessRuleSourceFormat` is `full-script`. Evidence: https://www.servicenow.com/docs/r/application-development/business-rules-classic/c_BusinessRules.html",
      url: ruleDocsUrl("require-business-rule-wrapper"),
    },
    messages: {
      missingWrapper:
        "Wrap this full-script Business Rule in `(function executeRule(current, previous) { ... })(current, previous)` so variables do not leak into other rules.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!appliesOnSurface(script, "business-rule")) return false;
        if (script.businessRuleSourceFormat !== "full-script") return false;
      },
      Program(node) {
        const program = node as ESTree.Program;
        const executable = program.body.filter((stmt) => !isIgnorable(stmt as ESTree.Node));
        if (executable.length === 1 && isWrapperStatement(executable[0] as ESTree.Node)) return;
        const target = (executable[0] as ESTree.Node | undefined) ?? node;
        context.report({ node: target, messageId: "missingWrapper" });
      },
    };
  },
});
