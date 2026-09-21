import type { ESTree } from "@oxlint/plugins";
import { isNode, nodeEnd, nodeStart, unwrapExpression, walk } from "../utils/ast.js";
import { forEachResolvedPatternBinding, type FileBindings } from "./bindings.js";

interface BindingWriteIndex {
  readonly dynamicScope: boolean;
  readonly written: ReadonlySet<number>;
  readonly writes: ReadonlyMap<number, readonly BindingWrite[]>;
}

export interface BindingWrite {
  readonly boundaryId: number | null;
  /** End offset of the write; a write completes earlier when this precedes the use. */
  readonly offset: number;
  /** Start offset of the write with a positive-infinity fallback, matching alias resolution. */
  readonly start: number;
  readonly kind: "assign" | "update" | "for";
  /** True when the write target is a bare identifier rather than a pattern. */
  readonly simple: boolean;
  /** The assignment operator for `assign` writes; null otherwise. */
  readonly operator: string | null;
  /** The assigned right-hand side for `assign` writes; null otherwise. */
  readonly right: ESTree.Node | null;
  /** Ancestor node types from the program root to the write's parent. */
  readonly ancestorTypes: readonly string[];
}

const NO_WRITES: readonly BindingWrite[] = [];

export interface BindingWriteQuery {
  /** True when the lexical binding is assigned or updated outside its declaration. */
  isWritten(bindingId: number): boolean;
  /** True when a lexical write completes earlier in the same execution boundary. */
  isWrittenBeforeInBoundary(bindingId: number, use: ESTree.Node): boolean;
  /** True when global eval or with can invalidate file-visible bindings. */
  hasDynamicScope(): boolean;
  /** Every recorded write to the binding in program order (FINDINGS.md PER-005). */
  writesFor(bindingId: number): readonly BindingWrite[];
}

function buildIndex(program: ESTree.Node | undefined, bindings: FileBindings): BindingWriteIndex {
  const written = new Set<number>();
  const writes = new Map<number, BindingWrite[]>();
  if (!program) return { dynamicScope: false, written, writes };

  const ancestors: ESTree.Node[] = [];
  let dynamicScope = false;
  const executionBoundaryId = (node: ESTree.Node): number | null =>
    bindings.executionBoundaryForNode(node, ancestors)?.id ?? null;
  const record = (
    target: unknown,
    offset: number,
    owner: ESTree.Node,
    detail: Pick<BindingWrite, "kind" | "operator" | "right">,
  ): void => {
    const boundaryId = executionBoundaryId(owner);
    // The walk leaves the current node last in `ancestors`; drop it so the
    // snapshot holds the write's parent chain.
    const ancestorTypes = ancestors.slice(0, -1).map((ancestor) => ancestor.type);
    const start = (owner as { start?: number }).start ?? Number.POSITIVE_INFINITY;
    const unwrapped = unwrapExpression(target);
    const simple = isNode(unwrapped) && unwrapped.type === "Identifier";
    forEachResolvedPatternBinding(target, bindings, ancestors, (binding) => {
      written.add(binding.id);
      const entries = writes.get(binding.id);
      const entry: BindingWrite = { boundaryId, offset, start, simple, ancestorTypes, ...detail };
      if (entries) entries.push(entry);
      else writes.set(binding.id, [entry]);
    });
  };

  walk(
    program,
    {
      AssignmentExpression(node) {
        const assignment = node as ESTree.AssignmentExpression;
        record(assignment.left, nodeEnd(node), node, {
          kind: "assign",
          operator: assignment.operator,
          right: isNode(assignment.right) ? assignment.right : null,
        });
      },
      UpdateExpression(node) {
        record((node as ESTree.UpdateExpression).argument, nodeEnd(node), node, {
          kind: "update",
          operator: null,
          right: null,
        });
      },
      ForInStatement(node) {
        const statement = node as ESTree.ForInStatement;
        record(statement.left, nodeEnd(statement.right), node, {
          kind: "for",
          operator: null,
          right: null,
        });
      },
      ForOfStatement(node) {
        const statement = node as ESTree.ForOfStatement;
        record(statement.left, nodeEnd(statement.right), node, {
          kind: "for",
          operator: null,
          right: null,
        });
      },
      WithStatement() {
        dynamicScope = true;
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        const callee = unwrapExpression(call.callee);
        if (
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

/** Create a lazy, immutable binding-write view shared by every rule for one file. */
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
      const boundaryId = bindings.executionBoundaryForNode(use)?.id;
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
    writesFor(bindingId: number) {
      return getIndex().writes.get(bindingId) ?? NO_WRITES;
    },
  });
}
