import type { ESTree } from "@oxlint/plugins";
import { getName, isValueReference, nodeStart, walk } from "../utils/ast.js";
import type { FileBindings } from "./bindings.js";
import type { BindingWriteQuery } from "./binding-writes.js";

export interface UnhoistedBlockFunctionUse {
  readonly declaration: ESTree.Node;
  readonly name: string;
  readonly node: ESTree.Node;
}

interface BlockFunctionDeclaration {
  readonly boundary: ESTree.Node;
  readonly block: ESTree.BlockStatement;
  readonly declaration: ESTree.Node;
  readonly name: string;
}

function isFunctionNode(
  node: ESTree.Node | undefined,
): node is ESTree.Function | ESTree.ArrowFunctionExpression {
  return (
    node?.type === "FunctionDeclaration" ||
    node?.type === "FunctionExpression" ||
    node?.type === "ArrowFunctionExpression"
  );
}

/** Nearest independently invoked script/function body, excluding the current node. */
function executionBoundary(ancestors: readonly ESTree.Node[]): ESTree.Node | null {
  for (let index = ancestors.length - 2; index >= 0; index -= 1) {
    const ancestor = ancestors[index]!;
    if (
      ancestor.type === "Program" ||
      ancestor.type === "FunctionDeclaration" ||
      ancestor.type === "FunctionExpression" ||
      ancestor.type === "ArrowFunctionExpression" ||
      ancestor.type === "StaticBlock"
    ) {
      return ancestor;
    }
  }
  return null;
}

function crossesClassBoundary(
  block: ESTree.BlockStatement,
  ancestors: readonly ESTree.Node[],
): boolean {
  const blockIndex = ancestors.lastIndexOf(block);
  if (blockIndex < 0) return true;
  return ancestors
    .slice(blockIndex + 1, -1)
    .some(
      (ancestor) => ancestor.type === "ClassDeclaration" || ancestor.type === "ClassExpression",
    );
}

/**
 * Find reads that execute in the same body before a nested block function's
 * declaration. Pre-Australia Rhino did not hoist these declarations to their
 * block entry. Deferred function/class bodies and mutable bindings stay
 * unknown instead of inferring execution order.
 */
export function findUnhoistedBlockFunctionUses(
  program: ESTree.Node,
  bindings: FileBindings,
  bindingWrites: BindingWriteQuery,
): readonly UnhoistedBlockFunctionUse[] {
  if (bindingWrites.hasDynamicScope()) return [];

  // Multiple same-name declarations in one block have ordering semantics that
  // differ across sloppy/strict parsing and legacy Rhino modes. A single
  // binding id can resolve all of them, so mark that identity ambiguous rather
  // than treating the last declaration as authoritative.
  const declarations = new Map<number, BlockFunctionDeclaration | null>();
  const ancestors: ESTree.Node[] = [];
  walk(
    program,
    {
      FunctionDeclaration(node) {
        const declaration = node as ESTree.Function;
        const id = declaration.id;
        const block = ancestors[ancestors.length - 2];
        const blockParent = ancestors[ancestors.length - 3];
        if (!id || id.type !== "Identifier" || block?.type !== "BlockStatement") return;
        // Function-body declarations were already hoisted correctly. The
        // Australia fix concerns declarations in nested blocks.
        if (isFunctionNode(blockParent) && blockParent.body === block) return;
        const binding = bindings.resolve(id.name, id, ancestors);
        const boundary = executionBoundary(ancestors);
        if (!binding || binding.kind !== "function" || !boundary) return;
        if (bindingWrites.isWritten(binding.id)) return;
        if (declarations.has(binding.id)) {
          declarations.set(binding.id, null);
          return;
        }
        declarations.set(binding.id, {
          boundary,
          block,
          declaration,
          name: id.name,
        });
      },
    },
    ancestors,
  );
  if (declarations.size === 0) return [];

  const findings: UnhoistedBlockFunctionUse[] = [];
  ancestors.length = 0;
  walk(
    program,
    {
      Identifier(node) {
        if (!isValueReference(node, ancestors)) return;
        const identifier = node as ESTree.IdentifierReference;
        const binding = bindings.resolve(getName(identifier) ?? "", identifier, ancestors);
        const declaration = binding ? declarations.get(binding.id) : undefined;
        if (!declaration) return;
        const useStart = nodeStart(identifier);
        const declarationStart = nodeStart(declaration.declaration);
        if (useStart < 0 || declarationStart < 0 || useStart >= declarationStart) return;
        if (executionBoundary(ancestors) !== declaration.boundary) return;
        if (crossesClassBoundary(declaration.block, ancestors)) return;
        findings.push({
          declaration: declaration.declaration,
          name: declaration.name,
          node: identifier,
        });
      },
    },
    ancestors,
  );
  return findings;
}
