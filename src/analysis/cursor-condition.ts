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
export function truthyPathRequiresCursorNext(
  node: unknown,
  isCursorNext: (node: unknown) => boolean,
): boolean {
  const expr = unwrapExpression(node);
  if (!isNode(expr)) return false;
  if (isCursorNext(expr)) return true;
  if (expr.type === "LogicalExpression") {
    const logical = expr as ESTree.LogicalExpression;
    const left = truthyPathRequiresCursorNext(logical.left, isCursorNext);
    const right = truthyPathRequiresCursorNext(logical.right, isCursorNext);
    return logical.operator === "&&" ? left || right : left && right;
  }
  if (expr.type === "ConditionalExpression") {
    const conditional = expr as ESTree.ConditionalExpression;
    return (
      truthyPathRequiresCursorNext(conditional.consequent, isCursorNext) &&
      truthyPathRequiresCursorNext(conditional.alternate, isCursorNext)
    );
  }
  if (expr.type === "SequenceExpression") {
    const sequence = expr as ESTree.SequenceExpression;
    const last = sequence.expressions[sequence.expressions.length - 1];
    return truthyPathRequiresCursorNext(last, isCursorNext);
  }
  return false;
}
