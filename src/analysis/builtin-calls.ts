import type { ESTree } from "@oxlint/plugins";
import { isNode } from "../utils/ast.js";
import type { FileBindings } from "./bindings.js";
import {
  isDefinitelyNonCallable,
  resolveConstValue,
  resolveDestructuredConstMember,
  staticPropertyName,
} from "./members.js";
import { platformGlobalNamespaceAccess, resolvePlatformGlobalName } from "./globals.js";

export interface BuiltinReference {
  readonly method: string;
  readonly owner: string;
  readonly receiver: ESTree.Node;
}

export interface BuiltinCall extends BuiltinReference {
  /** Null means the invocation is proven but its effective arguments are unknown. */
  readonly arguments: readonly unknown[] | null;
}

export interface BuiltinCallOptions {
  readonly allowGlobalThis: boolean;
  readonly allowReflectApply: boolean;
}

export function resolveBuiltinReference(
  node: unknown,
  bindings: FileBindings,
  allowGlobalThis: boolean,
): BuiltinReference | null {
  const selected = resolveDestructuredConstMember(node, bindings);
  if (selected) {
    if (selected.fallback !== null && !isDefinitelyNonCallable(selected.fallback, bindings)) {
      return null;
    }
    if (platformGlobalNamespaceAccess(selected.source, bindings) && !allowGlobalThis) return null;
    const owner = resolvePlatformGlobalName(selected.source, bindings);
    return owner ? { method: selected.property, owner, receiver: selected.source } : null;
  }
  const value = resolveConstValue(node, bindings);
  if (!value) return null;
  if (platformGlobalNamespaceAccess(value, bindings) && !allowGlobalThis) return null;
  if (value.type !== "MemberExpression") return null;
  const method = staticPropertyName(value);
  const owner = resolvePlatformGlobalName(value.object, bindings);
  return owner && method ? { method, owner, receiver: value.object } : null;
}

function arrayArguments(node: unknown, bindings: FileBindings): readonly unknown[] | null {
  const value = resolveConstValue(node, bindings);
  if (value?.type !== "ArrayExpression") return null;
  return value.elements.some((element) => element?.type === "SpreadElement")
    ? null
    : value.elements;
}

function directArguments(arguments_: readonly unknown[]): readonly unknown[] | null {
  return arguments_.some((argument) => isNode(argument) && argument.type === "SpreadElement")
    ? null
    : arguments_;
}

export function resolveBuiltinBindCall(
  call: ESTree.CallExpression,
  bindings: FileBindings,
  allowGlobalThis: boolean,
): (BuiltinReference & { readonly arguments: readonly unknown[] | null }) | null {
  const callee = resolveConstValue(call.callee, bindings);
  if (callee?.type !== "MemberExpression" || staticPropertyName(callee) !== "bind") return null;
  const wrapped = resolveBuiltinReference(callee.object, bindings, allowGlobalThis);
  return wrapped ? { ...wrapped, arguments: directArguments(call.arguments.slice(1)) } : null;
}

function boundBuiltin(
  node: unknown,
  bindings: FileBindings,
  allowGlobalThis: boolean,
): (BuiltinReference & { readonly arguments: readonly unknown[] | null }) | null {
  const value = resolveConstValue(node, bindings);
  return value?.type === "CallExpression"
    ? resolveBuiltinBindCall(value, bindings, allowGlobalThis)
    : null;
}

export function resolveBuiltinCall(
  call: ESTree.CallExpression,
  bindings: FileBindings,
  options: BuiltinCallOptions,
): BuiltinCall | null {
  const direct = resolveBuiltinReference(call.callee, bindings, options.allowGlobalThis);
  if (direct?.owner === "Reflect" && direct.method === "apply") {
    if (!options.allowReflectApply) return null;
    const target = resolveBuiltinReference(call.arguments[0], bindings, options.allowGlobalThis);
    return target ? { ...target, arguments: arrayArguments(call.arguments[2], bindings) } : null;
  }
  if (direct) return { ...direct, arguments: directArguments(call.arguments) };

  const callee = resolveConstValue(call.callee, bindings);
  if (callee?.type === "MemberExpression") {
    const helper = staticPropertyName(callee);
    const wrapped = resolveBuiltinReference(callee.object, bindings, options.allowGlobalThis);
    if (wrapped && helper === "call") {
      return { ...wrapped, arguments: directArguments(call.arguments.slice(1)) };
    }
    if (wrapped && helper === "apply") {
      return { ...wrapped, arguments: arrayArguments(call.arguments[1], bindings) };
    }
  }

  const bound = boundBuiltin(call.callee, bindings, options.allowGlobalThis);
  if (!bound) return null;
  const invocationArguments = directArguments(call.arguments);
  return {
    ...bound,
    arguments:
      bound.arguments === null || invocationArguments === null
        ? null
        : [...bound.arguments, ...invocationArguments],
  };
}
