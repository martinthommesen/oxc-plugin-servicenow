import type { ESTree } from "@oxlint/plugins";
import type { FileBindings } from "./bindings.js";
import { getName, getStaticStringValue, isNode, unwrapExpression } from "../utils/ast.js";

export interface DestructuredConstMember {
  readonly fallback: ESTree.Node | null;
  readonly property: string;
  readonly source: ESTree.Node;
}

function executionBoundaryForScope(
  bindings: FileBindings,
  scopeId: number,
): ReturnType<FileBindings["tree"]["scopeById"]> {
  let scope = bindings.tree.scopeById(scopeId);
  while (
    scope &&
    scope.kind !== "module" &&
    scope.kind !== "function" &&
    scope.kind !== "static-block"
  ) {
    scope = scope.parent;
  }
  return scope;
}

function definitelyPrecedes(left: unknown, right: ESTree.Node): boolean {
  const leftEnd = isNode(left) ? (left as { end?: number }).end : undefined;
  const rightStart = (right as { start?: number }).start;
  return typeof leftEnd === "number" && typeof rightStart === "number" && leftEnd <= rightStart;
}

/** Follow immutable identifier aliases to their terminal initializer. */
export function resolveConstValue(
  node: unknown,
  bindings: FileBindings,
  seen: ReadonlySet<number> = new Set(),
): ESTree.Node | null {
  const value = unwrapExpression(node);
  if (!isNode(value)) return null;
  if (value.type === "SequenceExpression") {
    const last = value.expressions.at(-1);
    return last ? resolveConstValue(last, bindings, seen) : null;
  }
  if (value.type !== "Identifier") return value;
  const binding = bindings.resolve(getName(value) ?? "", value);
  if (binding?.kind !== "const" || binding.node.type !== "VariableDeclarator") return value;
  const declaration = binding.node as ESTree.VariableDeclarator;
  if (declaration.id.type !== "Identifier" || getName(declaration.id) !== getName(value)) {
    return value;
  }
  if (seen.has(binding.id)) return null;
  const next = new Set(seen);
  next.add(binding.id);
  return resolveConstValue(declaration.init, bindings, next);
}

/**
 * Follow a const alias only when its initializer is guaranteed to have run
 * before this use in the same execution boundary. This is the temporal form
 * for conclusions such as parameter-default selection; callers that merely
 * need a file-wide possible value should continue to use `resolveConstValue`.
 */
export function resolveDominatingConstValue(
  node: unknown,
  bindings: FileBindings,
  seen: ReadonlySet<number> = new Set(),
): ESTree.Node | null {
  const value = unwrapExpression(node);
  if (!isNode(value)) return null;
  if (value.type === "SequenceExpression") {
    const last = value.expressions.at(-1);
    return last ? resolveDominatingConstValue(last, bindings, seen) : null;
  }
  if (value.type !== "Identifier") return value;
  const binding = bindings.resolve(getName(value) ?? "", value);
  if (binding?.kind !== "const" || binding.node.type !== "VariableDeclarator") return value;
  const declaration = binding.node as ESTree.VariableDeclarator;
  if (
    declaration.id.type !== "Identifier" ||
    getName(declaration.id) !== getName(value) ||
    !declaration.init ||
    seen.has(binding.id) ||
    !definitelyPrecedes(declaration.init, value)
  ) {
    return value;
  }
  const useScope = bindings.tree.scopeForNode(value);
  if (
    !useScope ||
    executionBoundaryForScope(bindings, binding.scopeId) !==
      executionBoundaryForScope(bindings, useScope.id)
  ) {
    return value;
  }
  const next = new Set(seen);
  next.add(binding.id);
  return resolveDominatingConstValue(declaration.init, bindings, next);
}

/** Whether this expression definitely evaluates to `undefined` if it completes. */
export function isDefinitelyUndefinedValue(node: unknown, bindings: FileBindings): boolean {
  const value = resolveDominatingConstValue(node, bindings);
  if (!value) return false;
  if (value.type === "UnaryExpression" && value.operator === "void") return true;
  return (
    value.type === "Identifier" && value.name === "undefined" && bindings.isPlatformGlobal(value)
  );
}

/** Whether this expression definitely evaluates to null or undefined if it completes. */
export function isDefinitelyNullishValue(node: unknown, bindings: FileBindings): boolean {
  const value = resolveDominatingConstValue(node, bindings);
  return (
    (value?.type === "Literal" && (value as { value?: unknown }).value == null) ||
    isDefinitelyUndefinedValue(node, bindings)
  );
}

/**
 * Resolve one property selected by a const object pattern.
 *
 * `resolveConstValue()` intentionally leaves pattern bindings alone because
 * their value is conditional when a default initializer is present. Callers
 * that understand that fallback can use this narrower structural result.
 */
export function resolveDestructuredConstMember(
  node: unknown,
  bindings: FileBindings,
): DestructuredConstMember | null {
  const value = unwrapExpression(node);
  if (!isNode(value) || value.type !== "Identifier") return null;
  const name = getName(value);
  const binding = name ? bindings.resolve(name, value) : null;
  if (binding?.kind !== "const" || binding.node.type !== "VariableDeclarator") return null;
  const declaration = binding.node as ESTree.VariableDeclarator;
  if (declaration.id.type !== "ObjectPattern") return null;
  const source = resolveConstValue(declaration.init, bindings);
  if (!source) return null;
  for (const item of declaration.id.properties) {
    if (item.type !== "Property") continue;
    const property = item as unknown as {
      key: ESTree.Node;
      value: ESTree.Node;
      computed: boolean;
    };
    const local =
      property.value.type === "AssignmentPattern" ? property.value.left : property.value;
    if (local.type !== "Identifier" || getName(local) !== name) continue;
    const propertyName = property.computed
      ? getStaticStringValue(property.key)
      : getName(property.key);
    if (!propertyName) return null;
    return {
      fallback:
        property.value.type === "AssignmentPattern"
          ? resolveConstValue(property.value.right, bindings)
          : null,
      property: propertyName,
      source,
    };
  }
  return null;
}

/** Return true when invoking this expression cannot call a replacement implementation. */
export function isDefinitelyNonCallable(node: unknown, bindings: FileBindings): boolean {
  const value = resolveConstValue(node, bindings);
  if (!value) return false;
  if (
    value.type === "Literal" ||
    value.type === "ObjectExpression" ||
    value.type === "ArrayExpression"
  ) {
    return true;
  }
  if (value.type === "UnaryExpression" && value.operator === "void") return true;
  return (
    value.type === "Identifier" &&
    getName(value) === "undefined" &&
    bindings.isPlatformGlobal(value)
  );
}

/**
 * Return a statically known property name for a member expression.
 * Supports `obj.prop` and `obj["prop"]`. Returns null for computed names
 * that are not string/template literals without expressions.
 */
export function staticPropertyName(node: unknown): string | null {
  if (!isNode(node) || node.type !== "MemberExpression") return null;
  const member = node as unknown as ESTree.MemberExpression;
  if (member.computed) return getStaticStringValue(member.property);
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
  return getStaticStringValue(member.property) === null;
}
