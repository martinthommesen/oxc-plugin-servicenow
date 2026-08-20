import type { ESTree } from "@oxlint/plugins";
import { GLIDE_QUERY_EXECUTORS } from "../glide/query-methods.js";
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
 * Reports only when every reachable path to `next()` still has
 * `queryState === "unopened"`. `chooseWindow` does not open a cursor.
 * Executors come from the versioned GlideRecord manifest.
 */
export function findMissingQueryBeforeNext(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): MissingQueryFinding[] {
  const findings: MissingQueryFinding[] = [];
  analyzePathBindings<QueryData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({ queryState: "unopened" }),
    cloneData: (data) => ({ ...data }),
    mergeData: (left, right) => ({
      queryState: left.queryState === right.queryState ? left.queryState : "unknown",
    }),
    onCall({ call, rec, objectName, property }) {
      if (!rec || !property) return;
      if (GLIDE_QUERY_EXECUTORS.has(property) && rec.data.queryState === "unopened") {
        rec.data.queryState = "opened";
      }
      if (property === "next" && rec.data.queryState === "unopened") {
        findings.push({ node: call, name: objectName ?? "record" });
      }
    },
  });
  return findings;
}
