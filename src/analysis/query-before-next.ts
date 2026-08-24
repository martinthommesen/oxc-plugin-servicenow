import type { ESTree } from "@oxlint/plugins";
import { nodeStart } from "../utils/ast.js";
import { analyzePathBindings } from "./path-state.js";
import {
  hasAuthoritativeGlideRecordMethod,
  type PlatformMethodAuthorityFacts,
} from "./platform-method-authority.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface MissingQueryFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
}

interface QueryData {
  /** At least one represented runtime path has not executed a query. */
  unopened: boolean;
}

/**
 * Path-sensitive query-before-next for proven GlideRecord object identities.
 *
 * Reports whenever a reachable path to a cursor advance lacks a proven query
 * executor. Definite unopened alternatives survive joins with uncertain
 * alternatives, while a custom call on every represented path stays silent.
 * Escaped or unproven receivers remain silent. `chooseWindow` does not open a
 * cursor. Executors come from the versioned GlideRecord manifest.
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
    emptyData: () => ({ unopened: true }),
    cloneData: (data) => ({ ...data }),
    equalsData: (left, right) => left.unopened === right.unopened,
    mergeData: (left, right) => ({
      unopened: left.unopened || right.unopened,
    }),
    onCall({ call, rec, receiver, objectName, property }) {
      if (!rec || !receiver || !property) return;
      if (!hasAuthoritativeGlideRecordMethod(authority, receiver, property)) {
        rec.data.unopened = false;
        return;
      }
      if (analysis.glide.possibleExecutors.has(property)) {
        rec.data.unopened = false;
      }
      if (analysis.glide.cursorAdvancers.has(property) && rec.data.unopened) {
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
