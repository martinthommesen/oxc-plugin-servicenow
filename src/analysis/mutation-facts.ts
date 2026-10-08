import type { ESTree } from "@oxlint/plugins";
import { isNode, nodeEnd, nodeStart, unwrapExpression } from "../utils/ast.js";
import type { FileBindings } from "./bindings.js";
import type { BindingWriteQuery } from "./binding-writes.js";

export type MutationRuntime = "instance" | "browser";

export interface MutationIndex {
  callable: MutableMutationFacts;
  authority: MutableMutationFacts;
  authorityGlobalSources: ReadonlyMap<string, ReadonlySet<ESTree.Node | null>>;
  authorityGlobalPathSources: ReadonlyMap<string, ReadonlySet<ESTree.Node | null>>;
  authorityObjectPropertySources: ReadonlyMap<string, ReadonlySet<ESTree.Node | null>>;
  authorityObjectPropertyWildcardSources: ReadonlyMap<string, ReadonlySet<ESTree.Node | null>>;
  authorityAllocationPropertySources: WeakMap<
    ESTree.Node,
    ReadonlyMap<string, ReadonlySet<ESTree.Node | null>>
  >;
}

export interface MutableMutationFacts {
  readonly globals: Set<string>;
  readonly globalPaths: Set<string>;
  readonly objectProperties: Set<string>;
  readonly objectPropertyWildcards: Set<string>;
  readonly allocationProperties: Map<ESTree.Node, Set<string>>;
}

export function pathKey(path: readonly string[]): string {
  return JSON.stringify(path);
}

export function objectPropertyKey(objectId: number, property: string): string {
  return `${objectId}\0${property}`;
}

export function pathWasWritten(paths: ReadonlySet<string>, path: readonly string[]): boolean {
  for (const key of affectingPathKeys(path)) {
    if (paths.has(key)) return true;
  }
  return false;
}

export function affectingPathKeys(path: readonly string[]): readonly string[] {
  const keys = new Set([pathKey(["*"]), pathKey(path)]);
  if (path.length > 0) keys.add(pathKey(["*", path[path.length - 1]!]));
  for (let length = 1; length < path.length; length += 1) {
    keys.add(pathKey([...path.slice(0, length), "*"]));
  }
  return [...keys];
}

export function emptyMutationFacts(): MutableMutationFacts {
  return {
    globals: new Set(),
    globalPaths: new Set(),
    objectProperties: new Set(),
    objectPropertyWildcards: new Set(),
    allocationProperties: new Map(),
  };
}

export function aliasValue(
  node: unknown,
  bindings: FileBindings,
  bindingWrites: BindingWriteQuery,
  temporal: boolean,
): ESTree.Node | null {
  let value = unwrapExpression(node);
  const seen = new Set<number>();
  while (isNode(value)) {
    if (value.type === "SequenceExpression") {
      value = unwrapExpression(value.expressions.at(-1));
      continue;
    }
    if (value.type !== "Identifier") return value;
    const binding = bindings.resolve(value.name, value);
    const wasWritten = binding
      ? temporal
        ? bindingWrites.isWrittenBeforeInBoundary(binding.id, value)
        : bindingWrites.isWritten(binding.id)
      : false;
    if (
      !binding ||
      seen.has(binding.id) ||
      wasWritten ||
      (binding.kind !== "const" && bindingWrites.hasDynamicScope()) ||
      binding.declarations.length !== 1 ||
      binding.node.type !== "VariableDeclarator"
    ) {
      return value;
    }
    const declaration = binding.node as ESTree.VariableDeclarator;
    const initializerEnd = declaration.init ? nodeEnd(declaration.init as ESTree.Node) : -1;
    const useStart = nodeStart(value);
    if (
      declaration.id.type !== "Identifier" ||
      declaration.id.name !== binding.name ||
      !declaration.init ||
      initializerEnd < 0 ||
      useStart < 0 ||
      initializerEnd > useStart
    ) {
      return value;
    }
    seen.add(binding.id);
    value = unwrapExpression(declaration.init);
  }
  return null;
}

export function allocationValue(
  node: unknown,
  bindings: FileBindings,
  bindingWrites: BindingWriteQuery,
  temporal: boolean,
): ESTree.ArrayExpression | ESTree.ObjectExpression | null {
  const value = aliasValue(node, bindings, bindingWrites, temporal);
  return value?.type === "ArrayExpression" || value?.type === "ObjectExpression" ? value : null;
}

export function allocationPropertyWasWritten(
  properties: ReadonlyMap<ESTree.Node, ReadonlySet<string>>,
  allocation: ESTree.Node | null,
  property: string,
): boolean {
  const written = allocation ? properties.get(allocation) : undefined;
  return Boolean(written?.has(property) || written?.has("*"));
}
