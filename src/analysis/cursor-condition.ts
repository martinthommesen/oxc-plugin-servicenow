import type { ESTree } from "@oxlint/plugins";
import { isNode, unwrapExpression } from "../utils/ast.js";

/**
 * Return whether truthy loop-body entry proves that a cursor `.next()` call
 * succeeded. The callback identifies a proven `.next()` call for the caller's
 * object-identity model.
 *
 * `&&` requires both operands to be truthy, while `||` and `??` may enter the
 * body through either operand. Thus a next call in either operand is enough
 * for `&&`, but both reachable results must require it for `||`/`??`.
 */
function intersection<T>(left: Set<T>, right: Set<T>): Set<T> {
  return new Set([...left].filter((value) => right.has(value)));
}

function comparisonOperand(node: ESTree.Node): ESTree.Node | null {
  if (node.type !== "BinaryExpression") return null;
  const binary = node as ESTree.BinaryExpression;
  const left = unwrapExpression(binary.left);
  const right = unwrapExpression(binary.right);
  const literal = (candidate: unknown): unknown =>
    isNode(candidate) && candidate.type === "Literal"
      ? (candidate as { value?: unknown }).value
      : undefined;
  const accepted =
    binary.operator === "===" || binary.operator === "=="
      ? true
      : binary.operator === "!==" || binary.operator === "!="
        ? false
        : null;
  if (accepted === null) return null;
  if (literal(left) === accepted && isNode(right)) return right;
  if (literal(right) === accepted && isNode(left)) return left;
  return null;
}

export function truthyPathRequiredCursorNexts<T>(
  node: unknown,
  cursorNext: (node: unknown) => T | null,
): Set<T> {
  const expr = unwrapExpression(node);
  if (!isNode(expr)) return new Set();
  const direct = cursorNext(expr);
  if (direct !== null) return new Set([direct]);
  const compared = comparisonOperand(expr);
  if (compared) return truthyPathRequiredCursorNexts(compared, cursorNext);
  if (expr.type === "LogicalExpression") {
    const logical = expr as ESTree.LogicalExpression;
    const left = truthyPathRequiredCursorNexts(logical.left, cursorNext);
    const right = truthyPathRequiredCursorNexts(logical.right, cursorNext);
    return logical.operator === "&&" ? new Set([...left, ...right]) : intersection(left, right);
  }
  if (expr.type === "ConditionalExpression") {
    const conditional = expr as ESTree.ConditionalExpression;
    return intersection(
      truthyPathRequiredCursorNexts(conditional.consequent, cursorNext),
      truthyPathRequiredCursorNexts(conditional.alternate, cursorNext),
    );
  }
  if (expr.type === "SequenceExpression") {
    const sequence = expr as ESTree.SequenceExpression;
    const last = sequence.expressions[sequence.expressions.length - 1];
    return truthyPathRequiredCursorNexts(last, cursorNext);
  }
  return new Set();
}

export function truthyPathRequiresCursorNext(
  node: unknown,
  isCursorNext: (node: unknown) => boolean,
): boolean {
  return truthyPathRequiredCursorNexts(node, (candidate) =>
    isCursorNext(candidate) ? true : null,
  ).size > 0;
}

export function definitelySkipsDoWhileTest(node: unknown): boolean {
  if (!isNode(node)) return false;
  if (node.type === "BreakStatement" || node.type === "ReturnStatement" || node.type === "ThrowStatement") {
    return true;
  }
  if (node.type === "BlockStatement") {
    return (node as ESTree.BlockStatement).body.some(definitelySkipsDoWhileTest);
  }
  if (node.type === "IfStatement") {
    const statement = node as ESTree.IfStatement;
    return Boolean(
      statement.alternate &&
        definitelySkipsDoWhileTest(statement.consequent) &&
        definitelySkipsDoWhileTest(statement.alternate),
    );
  }
  return false;
}
