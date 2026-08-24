import type { ESTree } from "@oxlint/plugins";
import { nodeStart } from "../utils/ast.js";
import { analyzePathBindings } from "./path-state.js";
import {
  hasAuthoritativeGlideRecordMethod,
  type PlatformMethodAuthorityFacts,
} from "./platform-method-authority.js";
import type { ProvenanceQuery, QueryState } from "./provenance.js";

export interface MissingQueryFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
}

interface QueryData {
  queryState: QueryState;
  /** Unknown custom calls stay silent; ordinary branch disagreement still reports. */
  uncertain: boolean;
}

/**
 * Path-sensitive query-before-next for proven GlideRecord object identities.
 *
 * Reports whenever a reachable path to a cursor advance lacks a proven query
 * executor.
 * A merged `unknown` state is unsafe for a must-fact and is therefore reported;
 * escaped or unproven receivers remain silent. `chooseWindow` does not open a cursor.
 * Executors come from the versioned GlideRecord manifest.
 */
export function findMissingQueryBeforeNext(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  authority: PlatformMethodAuthorityFacts,
): MissingQueryFinding[] {
  const findings: MissingQueryFinding[] = [];
  const reported = new Set<number>();
  analyzePathBindings<QueryData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({ queryState: "unopened", uncertain: false }),
    cloneData: (data) => ({ ...data }),
    equalsData: (left, right) =>
      left.queryState === right.queryState && left.uncertain === right.uncertain,
    mergeData: (left, right) => ({
      queryState: left.queryState === right.queryState ? left.queryState : "unknown",
      uncertain: left.uncertain || right.uncertain,
    }),
    onCall({ call, rec, receiver, objectName, property }) {
      if (!rec || !receiver || !property) return;
      if (!hasAuthoritativeGlideRecordMethod(authority, receiver, property)) {
        rec.data.queryState = "unknown";
        rec.data.uncertain = true;
        return;
      }
      if (analysis.glide.possibleExecutors.has(property)) {
        rec.data.queryState = "opened";
        rec.data.uncertain = false;
      }
      if (
        analysis.glide.cursorAdvancers.has(property) &&
        (rec.data.queryState === "unopened" ||
          (rec.data.queryState === "unknown" && !rec.data.uncertain))
      ) {
        const key = nodeStart(call);
        if (!reported.has(key)) {
          reported.add(key);
          findings.push({ node: call, name: objectName ?? "record", method: property });
        }
      }
    },
    onBudgetExceeded() {
      findings.length = 0;
      reported.clear();
    },
  });
  return findings;
}
