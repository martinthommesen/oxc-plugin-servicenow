import type { ESTree } from "@oxlint/plugins";
import { getName, getStringValue, isNode } from "../utils/ast.js";

/**
 * Return a statically known property name for a member expression.
 * Supports `obj.prop` and `obj["prop"]`. Returns null for computed names
 * that are not string/template literals without expressions.
 */
export function staticPropertyName(node: unknown): string | null {
  if (!isNode(node) || node.type !== "MemberExpression") return null;
  const member = node as unknown as ESTree.MemberExpression;
  if (member.computed) return getStringValue(member.property);
  return getName(member.property);
}

export function staticCalleeProperty(node: unknown): string | null {
  if (!isNode(node)) return null;
  if (node.type === "CallExpression" || node.type === "NewExpression") {
    return staticPropertyName((node as ESTree.CallExpression | ESTree.NewExpression).callee);
  }
  return staticPropertyName(node);
}

export function identifierName(node: unknown): string | null {
  return getName(node);
}

export function isComputedUnknown(node: unknown): boolean {
  if (!isNode(node) || node.type !== "MemberExpression") return false;
  const member = node as unknown as ESTree.MemberExpression;
  if (!member.computed) return false;
  return getStringValue(member.property) === null;
}
