import type { ESTree } from "@oxlint/plugins";
import { isNode, unwrapExpression } from "../utils/ast.js";
import { MAX_PATH_DEPTH } from "./path-budget.js";

/**
 * Truthiness and nullishness of an expression whose value is known from its
 * syntax alone. Anything that depends on a binding, a call, or a coercion of
 * an unknown operand stays `null` so the interpreter keeps the conservative
 * join. Constant tests decide which short-circuit branch and which `if`,
 * conditional, and loop arm can execute (FINDINGS.md COR-003).
 */
export interface ConstantValue {
  readonly truthy: boolean;
  readonly nullish: boolean;
}

const ALWAYS_OBJECT_EXPRESSIONS = new Set([
  "ObjectExpression",
  "ArrayExpression",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ClassExpression",
  "ClassDeclaration",
  "NewExpression",
]);

export function constantValue(node: unknown): ConstantValue | null {
  let expr = unwrapExpression(node);
  for (let depth = 0; isNode(expr) && expr.type === "SequenceExpression"; depth += 1) {
    if (depth >= MAX_PATH_DEPTH) return null;
    expr = unwrapExpression(expr.expressions.at(-1));
  }
  if (!isNode(expr)) return null;
  if (expr.type === "Literal") {
    const literal = expr as unknown as { value?: unknown; regex?: unknown; bigint?: string };
    if (literal.regex !== undefined) return { truthy: true, nullish: false };
    const value = literal.value;
    if (value === null) return { truthy: false, nullish: true };
    if (typeof literal.bigint === "string") {
      return { truthy: /[1-9]/.test(literal.bigint), nullish: false };
    }
    if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      return { truthy: Boolean(value), nullish: false };
    }
    return null;
  }
  if (expr.type === "TemplateLiteral") {
    const template = expr as ESTree.TemplateLiteral;
    if (template.expressions.length > 0) return null;
    const cooked = template.quasis.map((quasi) => quasi.value.cooked ?? "").join("");
    return { truthy: cooked.length > 0, nullish: false };
  }
  if (expr.type === "UnaryExpression" && (expr as ESTree.UnaryExpression).operator === "void") {
    return { truthy: false, nullish: true };
  }
  if (ALWAYS_OBJECT_EXPRESSIONS.has(expr.type)) return { truthy: true, nullish: false };
  return null;
}

export function isDefinitelyTrue(node: unknown): boolean {
  if (node == null) return true;
  return constantValue(node)?.truthy === true;
}

export function isDefinitelyFalse(node: unknown): boolean {
  return constantValue(node)?.truthy === false;
}

/**
 * Whether a logical expression's right operand definitely runs, definitely
 * does not run, or depends on a value the interpreter cannot see.
 */
export function logicalRightOperandRuns(expr: ESTree.LogicalExpression): boolean | null {
  const left = constantValue(expr.left);
  if (!left) return null;
  switch (expr.operator) {
    case "&&":
      return left.truthy;
    case "||":
      return !left.truthy;
    case "??":
      return left.nullish;
    default:
      return null;
  }
}
