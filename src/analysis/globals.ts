import type { ESTree } from "@oxlint/plugins";
import { getName, isNode, unwrapExpression } from "../utils/ast.js";
import type { FileBindings } from "./bindings.js";
import {
  isDefinitelyNonCallable,
  resolveConstValue,
  resolveDestructuredConstMember,
  staticPropertyName,
} from "./members.js";

// `globalThis` is the only standards-defined namespace in the reviewed server
// engine tables. Browser-only `window`/`self` must not be treated as instance
// server globals.
export const GLOBAL_OBJECT_NAMES = new Set(["globalThis"]);
const MAX_PLATFORM_GLOBAL_ALIAS_DEPTH = 64;

function platformGlobalName(
  node: unknown,
  bindings: FileBindings,
  followValueAlias: boolean,
  depth = 0,
): string | null {
  if (depth > MAX_PLATFORM_GLOBAL_ALIAS_DEPTH) return null;
  const direct = unwrapExpression(node);
  if (!isNode(direct)) return null;
  if (followValueAlias) {
    const selected = resolveDestructuredConstMember(direct, bindings);
    if (
      selected &&
      (selected.fallback === null || isDefinitelyNonCallable(selected.fallback, bindings)) &&
      GLOBAL_OBJECT_NAMES.has(platformGlobalName(selected.source, bindings, true, depth + 1) ?? "")
    ) {
      return selected.property;
    }
  }
  const value = followValueAlias ? resolveConstValue(direct, bindings) : direct;
  if (!value) return null;
  if (value.type === "Identifier") {
    const name = getName(value);
    return name && bindings.isPlatformGlobal(value) ? name : null;
  }
  if (value.type !== "MemberExpression") return null;
  const property = staticPropertyName(value);
  const object = resolveConstValue(value.object, bindings);
  const objectName = getName(object);
  if (
    !property ||
    !object ||
    !objectName ||
    !GLOBAL_OBJECT_NAMES.has(objectName) ||
    !bindings.isPlatformGlobal(object)
  ) {
    return null;
  }
  return property;
}

/** Resolve a bare or globalThis-qualified platform global, following const aliases. */
export function resolvePlatformGlobalName(node: unknown, bindings: FileBindings): string | null {
  return platformGlobalName(node, bindings, true);
}

/** Resolve the access written at this exact use site, without following a value alias. */
export function directPlatformGlobalName(node: unknown, bindings: FileBindings): string | null {
  return platformGlobalName(node, bindings, false);
}

function findPlatformGlobalNamespaceAccess(
  node: unknown,
  bindings: FileBindings,
  depth: number,
): ESTree.Node | null {
  if (depth > MAX_PLATFORM_GLOBAL_ALIAS_DEPTH) return null;
  const selected = resolveDestructuredConstMember(node, bindings);
  if (selected) return findPlatformGlobalNamespaceAccess(selected.source, bindings, depth + 1);
  const value = resolveConstValue(node, bindings);
  if (!value || value.type !== "MemberExpression") return null;
  const object = resolveConstValue(value.object, bindings);
  if (!object) return null;
  if (object.type === "Identifier") {
    return getName(object) === "globalThis" && bindings.isPlatformGlobal(object) ? object : null;
  }
  return findPlatformGlobalNamespaceAccess(object, bindings, depth + 1);
}

/** Return the `globalThis` identifier read by a qualified access, if any. */
export function platformGlobalNamespaceAccess(
  node: unknown,
  bindings: FileBindings,
): ESTree.Node | null {
  return findPlatformGlobalNamespaceAccess(node, bindings, 0);
}
