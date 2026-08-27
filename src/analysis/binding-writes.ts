import type { ESTree } from "@oxlint/plugins";
import { isNode, nodeEnd, nodeStart, unwrapExpression, walk } from "../utils/ast.js";
import { forEachResolvedPatternBinding, type FileBindings } from "./bindings.js";

interface BindingWriteIndex {
  readonly dynamicScope: boolean;
  readonly written: ReadonlySet<number>;
  readonly writes: ReadonlyMap<number, readonly BindingWrite[]>;
}

interface BindingWrite {
  readonly boundaryId: number | null;
  readonly offset: number;
}

export interface BindingWriteQuery {
  /** True when the lexical binding is assigned or updated outside its declaration. */
  isWritten(bindingId: number): boolean;
  /** True when a lexical write completes earlier in the same execution boundary. */
  isWrittenBeforeInBoundary(bindingId: number, use: ESTree.Node): boolean;
  /** True when direct global eval or with can invalidate lexical resolution. */
  hasDynamicScope(): boolean;
}

function buildIndex(program: ESTree.Node | undefined, bindings: FileBindings): BindingWriteIndex {
  const written = new Set<number>();
  const writes = new Map<number, BindingWrite[]>();
  if (!program) return { dynamicScope: false, written, writes };

  const ancestors: ESTree.Node[] = [];
  let dynamicScope = false;
  const executionBoundaryId = (node: ESTree.Node): number | null => {
    let scope = bindings.tree.scopeForNode(node, ancestors);
    while (
      scope &&
      scope.kind !== "module" &&
      scope.kind !== "function" &&
      scope.kind !== "static-block"
    ) {
      scope = scope.parent;
    }
    return scope?.id ?? null;
  };
  const record = (target: unknown, offset: number, owner: ESTree.Node): void => {
    const boundaryId = executionBoundaryId(owner);
    forEachResolvedPatternBinding(target, bindings, ancestors, (binding) => {
      written.add(binding.id);
      const entries = writes.get(binding.id);
      const entry = { boundaryId, offset };
      if (entries) entries.push(entry);
      else writes.set(binding.id, [entry]);
    });
  };

  walk(
    program,
    {
      AssignmentExpression(node) {
        record((node as ESTree.AssignmentExpression).left, nodeEnd(node), node);
      },
      UpdateExpression(node) {
        record((node as ESTree.UpdateExpression).argument, nodeEnd(node), node);
      },
      ForInStatement(node) {
        record(
          (node as ESTree.ForInStatement).left,
          nodeEnd((node as ESTree.ForInStatement).right),
          node,
        );
      },
      ForOfStatement(node) {
        record(
          (node as ESTree.ForOfStatement).left,
          nodeEnd((node as ESTree.ForOfStatement).right),
          node,
        );
      },
      WithStatement() {
        dynamicScope = true;
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        const callee = unwrapExpression(call.callee);
        if (
          !call.optional &&
          isNode(callee) &&
          callee.type === "Identifier" &&
          callee.name === "eval" &&
          bindings.isPlatformGlobal(callee, ancestors)
        ) {
          dynamicScope = true;
        }
      },
    },
    ancestors,
  );
  return { dynamicScope, written, writes };
}

/** Create a lazy, immutable binding-write view for one file. */
export function createBindingWriteQuery(
  program: ESTree.Node | undefined,
  bindings: FileBindings,
): BindingWriteQuery {
  let index: BindingWriteIndex | undefined;
  const getIndex = () => (index ??= buildIndex(program, bindings));
  return Object.freeze({
    isWritten(bindingId: number) {
      return getIndex().written.has(bindingId);
    },
    isWrittenBeforeInBoundary(bindingId: number, use: ESTree.Node) {
      const current = getIndex();
      const entries = current.writes.get(bindingId);
      if (!entries) return false;
      const useOffset = nodeStart(use);
      if (useOffset < 0) return true;
      let scope = bindings.tree.scopeForNode(use);
      while (
        scope &&
        scope.kind !== "module" &&
        scope.kind !== "function" &&
        scope.kind !== "static-block"
      ) {
        scope = scope.parent;
      }
      const boundaryId = scope?.id;
      if (boundaryId === undefined) return true;
      return entries.some(
        (entry) =>
          entry.boundaryId === null ||
          (entry.boundaryId === boundaryId && (entry.offset < 0 || entry.offset <= useOffset)),
      );
    },
    hasDynamicScope() {
      return getIndex().dynamicScope;
    },
  });
}
