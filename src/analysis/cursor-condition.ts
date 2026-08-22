import type { ESTree } from "@oxlint/plugins";
import { isNode, unwrapExpression } from "../utils/ast.js";

interface TruthProof {
  required: Set<number>;
  canBeTruthy: boolean;
  canBeFalsy: boolean;
  canBeNullish: boolean;
}

function intersect(sets: readonly Set<number>[]): Set<number> {
  if (sets.length === 0) return new Set();
  const result = new Set(sets[0]);
  for (const value of result) {
    if (sets.slice(1).some((set) => !set.has(value))) result.delete(value);
  }
  return result;
}

function truthyBooleanOperand(node: ESTree.Node): ESTree.Node | null {
  if (node.type !== "BinaryExpression") return null;
  const binary = node as ESTree.BinaryExpression;
  const left = unwrapExpression(binary.left);
  const right = unwrapExpression(binary.right);
  const literal = (candidate: unknown): unknown =>
    isNode(candidate) && candidate.type === "Literal"
      ? (candidate as { value?: unknown }).value
      : undefined;
  const required =
    binary.operator === "===" || binary.operator === "=="
      ? true
      : binary.operator === "!==" || binary.operator === "!="
        ? false
        : undefined;
  if (required === undefined) return null;
  if (literal(left) === required && isNode(right)) return right;
  if (literal(right) === required && isNode(left)) return left;
  return null;
}

export function definitelySkipsDoWhileTest(node: unknown): boolean {
  if (!isNode(node)) return false;
  if (
    node.type === "BreakStatement" ||
    node.type === "ReturnStatement" ||
    node.type === "ThrowStatement"
  ) {
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

function proof(node: unknown, cursorId: (node: unknown) => number | null): TruthProof {
  const expr = unwrapExpression(node);
  if (!isNode(expr)) {
    return { required: new Set(), canBeTruthy: true, canBeFalsy: true, canBeNullish: true };
  }
  const id = cursorId(expr);
  if (id !== null) {
    return { required: new Set([id]), canBeTruthy: true, canBeFalsy: true, canBeNullish: false };
  }
  const compared = truthyBooleanOperand(expr);
  if (compared) return proof(compared, cursorId);
  if (expr.type === "Literal") {
    const value = (expr as unknown as { value?: unknown }).value;
    return {
      required: new Set(),
      canBeTruthy: Boolean(value),
      canBeFalsy: !value,
      canBeNullish: value == null,
    };
  }
  if (expr.type === "SequenceExpression") {
    const values = (expr as ESTree.SequenceExpression).expressions;
    return proof(values[values.length - 1], cursorId);
  }
  if (expr.type === "ConditionalExpression") {
    const conditional = expr as ESTree.ConditionalExpression;
    const alternatives = [
      proof(conditional.consequent, cursorId),
      proof(conditional.alternate, cursorId),
    ];
    const truthy = alternatives.filter((item) => item.canBeTruthy);
    return {
      required: intersect(truthy.map((item) => item.required)),
      canBeTruthy: truthy.length > 0,
      canBeFalsy: alternatives.some((item) => item.canBeFalsy),
      canBeNullish: alternatives.some((item) => item.canBeNullish),
    };
  }
  if (expr.type === "LogicalExpression") {
    const logical = expr as ESTree.LogicalExpression;
    const left = proof(logical.left, cursorId);
    const right = proof(logical.right, cursorId);
    if (logical.operator === "&&") {
      return {
        required: new Set([...left.required, ...right.required]),
        canBeTruthy: left.canBeTruthy && right.canBeTruthy,
        canBeFalsy: left.canBeFalsy || (left.canBeTruthy && right.canBeFalsy),
        canBeNullish: left.canBeTruthy && right.canBeNullish,
      };
    }
    const alternatives: Set<number>[] = [];
    if (left.canBeTruthy) alternatives.push(left.required);
    if (logical.operator === "||") {
      if (left.canBeFalsy && right.canBeTruthy) alternatives.push(right.required);
      return {
        required: intersect(alternatives),
        canBeTruthy: alternatives.length > 0,
        canBeFalsy: left.canBeFalsy && right.canBeFalsy,
        canBeNullish: left.canBeFalsy && right.canBeNullish,
      };
    }
    if (left.canBeNullish && right.canBeTruthy) alternatives.push(right.required);
    return {
      required: intersect(alternatives),
      canBeTruthy: alternatives.length > 0,
      canBeFalsy: left.canBeFalsy || (left.canBeNullish && right.canBeFalsy),
      canBeNullish: left.canBeNullish && right.canBeNullish,
    };
  }
  return { required: new Set(), canBeTruthy: true, canBeFalsy: true, canBeNullish: true };
}

/** Return cursor identities that must have returned true on every truthy path. */
export function truthyPathRequiredCursorIds(
  node: unknown,
  cursorId: (node: unknown) => number | null,
): ReadonlySet<number> {
  const result = proof(node, cursorId);
  return result.canBeTruthy ? result.required : new Set();
}

/** Compatibility predicate for callers that only need one required cursor. */
export function truthyPathRequiresCursorNext(
  node: unknown,
  isCursorNext: (node: unknown) => boolean,
): boolean {
  return (
    truthyPathRequiredCursorIds(node, (candidate) => (isCursorNext(candidate) ? 1 : null)).size > 0
  );
}
