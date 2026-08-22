import type { ESTree } from "@oxlint/plugins";
import { nodeStart } from "../utils/ast.js";
import { analyzePathBindings } from "./path-state.js";
import type { ProvenanceQuery, QueryState } from "./provenance.js";

export interface MissingQueryFinding {
  node: ESTree.CallExpression;
  name: string;
}

interface QueryData {
  queryState: QueryState;
}

/**
 * Path-sensitive query-before-next for proven GlideRecord object identities.
 *
 * Reports whenever a reachable path to `next()` lacks a proven query/get.
 * A merged `unknown` state is unsafe for a must-fact and is therefore reported;
 * escaped or unproven receivers remain silent. `chooseWindow` does not open a cursor.
 * Executors come from the versioned GlideRecord manifest.
 */
export function findMissingQueryBeforeNext(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): MissingQueryFinding[] {
  const findings: MissingQueryFinding[] = [];
  const reported = new Set<number>();
  analyzePathBindings<QueryData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({ queryState: "unopened" }),
    cloneData: (data) => ({ ...data }),
    equalsData: (left, right) => left.queryState === right.queryState,
    mergeData: (left, right) => ({
      queryState: left.queryState === right.queryState ? left.queryState : "unknown",
    }),
    onCall({ call, rec, objectName, property }) {
      if (!rec || !property) return;
      if (analysis.glide.executors.has(property)) {
        rec.data.queryState = "opened";
      }
      if (
        analysis.glide.cursorAdvancers.has(property) &&
        (rec.data.queryState === "unopened" || rec.data.queryState === "unknown")
      ) {
        const key = nodeStart(call);
        if (!reported.has(key)) {
          reported.add(key);
          findings.push({ node: call, name: objectName ?? "record" });
        }
      }
    },
  });
  return findings;
}
