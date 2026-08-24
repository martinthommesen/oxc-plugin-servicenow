import type { ESTree } from "@oxlint/plugins";
import { isNode, unwrapExpression } from "../utils/ast.js";
import type { ProvenanceQuery } from "./provenance.js";
import { analyzePathBindings } from "./path-state.js";

interface GlideElementAliasData {
  cursorId: number | null;
}

export interface GlideElementAliasFacts {
  /** Return the source GlideRecord object ID proven at this exact value use. */
  cursorIdAt(node: unknown): number | null;
}

/**
 * Track local values that are definitely GlideElements from one cursor.
 *
 * Escaping a value does not change the caller's local binding identity, but
 * reassignment, shadowing, divergent branches, and incomplete paths do. The
 * shared path engine owns those semantics; this layer only carries the source
 * cursor ID as its value domain.
 */
export function analyzeGlideElementAliases(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  identifyDirect: (node: ESTree.Node) => number | null,
): GlideElementAliasFacts {
  let observed = new WeakMap<ESTree.Node, number | null>();

  const observe = (node: ESTree.Node, cursorId: number | null): void => {
    if (!observed.has(node)) {
      observed.set(node, cursorId);
      return;
    }
    if (observed.get(node) !== cursorId) observed.set(node, null);
  };

  analyzePathBindings<GlideElementAliasData>({
    program,
    analysis,
    kinds: [],
    emptyData: () => ({ cursorId: null }),
    cloneData: (data) => ({ ...data }),
    mergeData: (left, right) => ({
      cursorId: left.cursorId === right.cursorId ? left.cursorId : null,
    }),
    mergeDistinctData: (left, right) =>
      left.cursorId !== null && left.cursorId === right.cursorId
        ? { cursorId: left.cursorId }
        : undefined,
    equalsData: (left, right) => left.cursorId === right.cursorId,
    onCall() {},
    onValue(node) {
      const cursorId = identifyDirect(node);
      return cursorId === null ? undefined : { cursorId };
    },
    // This pass only answers exact program-point alias queries. Once a join
    // has no binding for an abstract value, retaining its record cannot
    // improve a later answer and can prevent loop fixpoints from converging.
    retainUnboundRecords: false,
    onRef({ node, rec }) {
      observe(node, rec && !rec.invalid ? rec.data.cursorId : null);
    },
    onBudgetExceeded() {
      observed = new WeakMap();
    },
  });

  return Object.freeze({
    cursorIdAt(node: unknown): number | null {
      const value = unwrapExpression(node);
      return isNode(value) ? (observed.get(value) ?? null) : null;
    },
  });
}
