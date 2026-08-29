import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { appliesOnSurface } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { getName, isNode } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";
import type { FileBindings } from "../analysis/bindings.js";

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

function unwrap(node: unknown): unknown {
  let current = node;
  while (isNode(current) && current.type === "ParenthesizedExpression") {
    current = (current as { expression: unknown }).expression;
  }
  return current;
}

function isWrapperExpression(node: unknown): boolean {
  if (!isNode(node) || node.type !== "CallExpression") return false;
  const call = node as ESTree.CallExpression;
  if (!isCurrentPreviousCall(call.arguments)) return false;
  const callee = unwrap(call.callee);
  if (!isNode(callee)) return false;
  if (callee.type !== "FunctionExpression" && callee.type !== "ArrowFunctionExpression") {
    return false;
  }
  return hasCurrentPreviousParams(callee as { params: unknown[] });
}

function isWrapperStatement(node: ESTree.Node): boolean {
  if (node.type === "ExpressionStatement") {
    return isWrapperExpression(unwrap((node as ESTree.ExpressionStatement).expression));
  }
  return false;
}

export interface CanonicalBusinessRuleWrapper {
  call: ESTree.CallExpression;
  fn: ESTree.Node;
  currentParam: ESTree.Node;
}

export function canonicalBusinessRuleWrapper(
  program: ESTree.Program,
  bindings: FileBindings,
): CanonicalBusinessRuleWrapper | null {
  let index = 0;
  while (index < program.body.length) {
    const statement = program.body[index] as ESTree.Node;
    if (isIgnorable(statement) || isDirective(statement)) index += 1;
    else break;
  }
  const executable = program.body
    .slice(index)
    .filter((statement) => !isIgnorable(statement as ESTree.Node));
  if (executable.length !== 1) return null;
  const statement = executable[0] as ESTree.Node;
  if (!isWrapperStatement(statement) || statement.type !== "ExpressionStatement") return null;
  const call = unwrap(
    (statement as ESTree.ExpressionStatement).expression,
  ) as ESTree.CallExpression;
  const fn = unwrap(call.callee) as ESTree.Node & { params: readonly unknown[] };
  const currentParam = fn.params[0] as ESTree.Node | undefined;
  const previousParam = fn.params[1] as ESTree.Node | undefined;
  const currentArg = call.arguments[0] as ESTree.Node | undefined;
  const previousArg = call.arguments[1] as ESTree.Node | undefined;
  if (currentParam?.type !== "Identifier" || previousParam?.type !== "Identifier") return null;
  if (getName(currentParam) !== "current" || getName(previousParam) !== "previous") return null;
  if (
    !currentArg ||
    !previousArg ||
    getName(currentArg) !== "current" ||
    getName(previousArg) !== "previous"
  )
    return null;
  if (!bindings.isPlatformGlobal(currentArg) || !bindings.isPlatformGlobal(previousArg))
    return null;
  return { call, fn, currentParam };
}

function isIgnorable(node: ESTree.Node): boolean {
  return node.type === "EmptyStatement" || node.type === "DebuggerStatement";
}

function isDirective(node: ESTree.Node): boolean {
  if (node.type !== "ExpressionStatement") return false;
  const expression = (node as ESTree.ExpressionStatement).expression as {
    type?: string;
    value?: unknown;
  };
  return (
    (expression.type === "Literal" || expression.type === "StringLiteral") &&
    typeof expression.value === "string"
  );
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
        const { analysis } = beginRuleFile(context);
        const program = node as ESTree.Program;
        // A directive prologue is executed before the wrapper and is valid in
        // a full-script Business Rule. Only directives at the start of the
        // program are ignored; later string expressions are ordinary code.
        if (canonicalBusinessRuleWrapper(program, analysis.bindings)) return;
        const target =
          (program.body.find(
            (statement) =>
              !isIgnorable(statement as ESTree.Node) && !isDirective(statement as ESTree.Node),
          ) as ESTree.Node | undefined) ?? node;
        context.report({ node: target, messageId: "missingWrapper" });
      },
    };
  },
});
