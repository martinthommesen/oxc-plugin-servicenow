import type { ESTree } from "@oxlint/plugins";
import { getStringValue, isValueReference, walk } from "../utils/ast.js";
import type { FileBindings, LexicalBinding, ScopeNode } from "./bindings.js";

interface BindingReference {
  readonly node: ESTree.Node;
  readonly boundary: ScopeNode | null;
  readonly inLoop: boolean;
  readonly definitelyNonMutating: boolean;
  readonly constAlias: LexicalBinding | null;
}

export interface EmptyArrayBindingQuery {
  /** Prove that an empty-array allocation remains empty through this use. */
  isUnchangedThrough(binding: LexicalBinding, use: ESTree.Node): boolean;
}

export interface EmptyArrayBindingQueryOptions {
  /** References consumed by a separately proven non-mutating operation. */
  readonly knownNonMutatingReferences?: ReadonlySet<ESTree.Node>;
  /** Function bodies that cannot execute until after the queried use begins. */
  readonly ignoredSubtrees?: ReadonlySet<ESTree.Node>;
}

function executionBoundary(
  bindings: FileBindings,
  node: ESTree.Node,
  ancestors: readonly ESTree.Node[] = [],
): ScopeNode | null {
  let scope = bindings.tree.scopeForNode(node, ancestors);
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

function isInsideLoopInCurrentExecution(ancestors: readonly ESTree.Node[]): boolean {
  for (let index = ancestors.length - 2; index >= 0; index -= 1) {
    const ancestor = ancestors[index]!;
    if (
      ancestor.type === "FunctionDeclaration" ||
      ancestor.type === "FunctionExpression" ||
      ancestor.type === "ArrowFunctionExpression" ||
      ancestor.type === "StaticBlock" ||
      ancestor.type === "Program"
    ) {
      return false;
    }
    if (
      ancestor.type === "ForStatement" ||
      ancestor.type === "ForInStatement" ||
      ancestor.type === "ForOfStatement" ||
      ancestor.type === "WhileStatement" ||
      ancestor.type === "DoWhileStatement"
    ) {
      return true;
    }
  }
  return false;
}

function isDefinitelyNonMutatingArrayReference(
  node: ESTree.Node,
  ancestors: readonly ESTree.Node[],
): boolean {
  let child = node;
  for (let index = ancestors.length - 2; index >= 0; index -= 1) {
    const parent = ancestors[index]!;
    switch (parent.type) {
      case "ParenthesizedExpression":
      case "ChainExpression":
      case "TSAsExpression":
      case "TSTypeAssertion":
      case "TSNonNullExpression":
      case "TSSatisfiesExpression":
        child = parent;
        continue;
      case "MemberExpression": {
        const member = parent as ESTree.MemberExpression;
        if (member.object !== child) return false;
        const property = member.computed ? getStringValue(member.property) : member.property.name;
        if (property !== "length") return false;

        // Array literals have an own, non-configurable data `length`. Once it
        // is read, the resulting number cannot expose or mutate the array.
        let target = parent as ESTree.Node;
        for (let outer = index - 1; outer >= 0; outer -= 1) {
          const container = ancestors[outer]!;
          if (
            container.type === "ParenthesizedExpression" ||
            container.type === "ChainExpression" ||
            container.type === "TSAsExpression" ||
            container.type === "TSTypeAssertion" ||
            container.type === "TSNonNullExpression" ||
            container.type === "TSSatisfiesExpression" ||
            container.type === "Property" ||
            container.type === "ArrayPattern" ||
            container.type === "ObjectPattern" ||
            container.type === "RestElement" ||
            container.type === "AssignmentPattern"
          ) {
            target = container;
            continue;
          }
          if (container.type === "AssignmentExpression") {
            const assignment = container as ESTree.AssignmentExpression;
            if (assignment.left !== target) break;
            return (
              assignment.operator === "=" &&
              assignment.right.type === "Literal" &&
              assignment.right.value === 0
            );
          }
          if (
            (container.type === "UpdateExpression" &&
              (container as ESTree.UpdateExpression).argument === target) ||
            ((container.type === "ForInStatement" || container.type === "ForOfStatement") &&
              (container as ESTree.ForInStatement | ESTree.ForOfStatement).left === target)
          ) {
            return false;
          }
          if (
            container.type === "UnaryExpression" &&
            (container as ESTree.UnaryExpression).operator === "delete" &&
            (container as ESTree.UnaryExpression).argument === target
          ) {
            return true;
          }
          break;
        }
        return true;
      }
      case "BinaryExpression": {
        const operator = (parent as ESTree.BinaryExpression).operator;
        return operator === "===" || operator === "!==";
      }
      case "UnaryExpression": {
        const operator = (parent as ESTree.UnaryExpression).operator;
        return operator === "!" || operator === "typeof" || operator === "void";
      }
      case "ConditionalExpression":
        if ((parent as ESTree.ConditionalExpression).test === child) return true;
        child = parent;
        continue;
      case "LogicalExpression": {
        const logical = parent as ESTree.LogicalExpression;
        if (logical.left === child && logical.operator === "&&") return true;
        child = parent;
        continue;
      }
      case "SequenceExpression":
        if ((parent as ESTree.SequenceExpression).expressions.at(-1) !== child) return true;
        child = parent;
        continue;
      case "ExpressionStatement":
        return true;
      case "IfStatement":
      case "WhileStatement":
      case "DoWhileStatement":
        return (
          (parent as ESTree.IfStatement | ESTree.WhileStatement | ESTree.DoWhileStatement).test ===
          child
        );
      case "ForStatement": {
        const statement = parent as ESTree.ForStatement;
        return statement.init === child || statement.test === child || statement.update === child;
      }
      case "SwitchStatement":
        return (parent as ESTree.SwitchStatement).discriminant === child;
      case "SwitchCase":
        return (parent as ESTree.SwitchCase).test === child;
      default:
        return false;
    }
  }
  return false;
}

function directConstAliasBinding(
  node: ESTree.Node,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
): LexicalBinding | null {
  let child = node;
  for (let index = ancestors.length - 2; index >= 0; index -= 1) {
    const parent = ancestors[index]!;
    if (
      parent.type === "ParenthesizedExpression" ||
      parent.type === "ChainExpression" ||
      parent.type === "TSAsExpression" ||
      parent.type === "TSTypeAssertion" ||
      parent.type === "TSNonNullExpression" ||
      parent.type === "TSSatisfiesExpression"
    ) {
      child = parent;
      continue;
    }
    if (parent.type !== "VariableDeclarator") return null;
    const declaration = parent as ESTree.VariableDeclarator;
    if (declaration.init !== child || declaration.id.type !== "Identifier") return null;
    const alias = bindings.resolve(declaration.id.name, declaration, ancestors);
    return alias?.kind === "const" && alias.node === declaration ? alias : null;
  }
  return null;
}

/**
 * Build a lazy, binding-aware query for an empty array literal and its direct
 * const aliases. Unknown reads, escapes, or mutations end the proof.
 */
export function createEmptyArrayBindingQuery(
  program: ESTree.Node,
  bindings: FileBindings,
  options: EmptyArrayBindingQueryOptions = {},
): EmptyArrayBindingQuery {
  let references: ReadonlyMap<number, readonly BindingReference[]> | undefined;
  return Object.freeze({
    isUnchangedThrough(binding: LexicalBinding, use: ESTree.Node): boolean {
      if (!references) {
        const next = new Map<number, BindingReference[]>();
        const ancestors: ESTree.Node[] = [];
        walk(
          program,
          {
            Identifier(node) {
              if (ancestors.some((ancestor) => options.ignoredSubtrees?.has(ancestor))) return;
              if (!isValueReference(node, ancestors)) return;
              const name = (node as { name?: unknown }).name;
              if (typeof name !== "string") return;
              const resolved = bindings.resolve(name, node, ancestors);
              if (!resolved) return;
              if (
                resolved.node.type === "VariableDeclarator" &&
                (resolved.node as ESTree.VariableDeclarator).id === node
              ) {
                return;
              }
              const nodes = next.get(resolved.id) ?? [];
              nodes.push({
                node,
                boundary: executionBoundary(bindings, node, ancestors),
                inLoop: isInsideLoopInCurrentExecution(ancestors),
                definitelyNonMutating:
                  options.knownNonMutatingReferences?.has(node) === true ||
                  isDefinitelyNonMutatingArrayReference(node, ancestors),
                constAlias: directConstAliasBinding(node, ancestors, bindings),
              });
              next.set(resolved.id, nodes);
            },
          },
          ancestors,
        );
        references = next;
      }

      const nodes = references.get(binding.id) ?? [];
      const useReference = nodes.find((reference) => reference.node === use);
      if (!useReference) return false;
      const useStart = (use as { start?: unknown }).start;
      const useBoundary = useReference.boundary;
      const declarationBoundary = executionBoundary(bindings, binding.node);
      if (typeof useStart !== "number" || !useBoundary || !declarationBoundary) return false;
      const bindingIsRecreatedWithUse = declarationBoundary === useBoundary;
      const seen = new Set<number>();
      const unchanged = (current: LexicalBinding): boolean => {
        if (seen.has(current.id)) return true;
        seen.add(current.id);
        return (references!.get(current.id) ?? []).every((reference) => {
          if (reference.node === use || reference.definitelyNonMutating) return true;
          const start = (reference.node as { start?: unknown }).start;
          const happensTooLate =
            !useReference.inLoop &&
            bindingIsRecreatedWithUse &&
            reference.boundary === useBoundary &&
            typeof start === "number" &&
            start > useStart;
          if (happensTooLate) return true;
          return reference.constAlias !== null && unchanged(reference.constAlias);
        });
      };
      return unchanged(binding);
    },
  });
}
