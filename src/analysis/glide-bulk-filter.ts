import type { ESTree } from "@oxlint/plugins";
import { getStringValue, nodeStart } from "../utils/ast.js";
import { classifyStaticArg } from "./static-args.js";
import { analyzePathBindings, mergeTri } from "./path-state.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface UnfilteredBulkFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
}

interface FilterData {
  filtered: boolean | "unknown";
  /** Dynamic/undocumented evidence is intentionally silent rather than a must-fact failure. */
  uncertain: boolean;
}

const FIELD_OR_ENCODED_FILTERS = new Set([
  "addQuery",
  "addEncodedQuery",
  "addUserQuery",
  "addUserEncodedQuery",
  "addSystemQuery",
  "addSystemEncodedQuery",
  "addNullQuery",
  "addNotNullQuery",
  "addJoinQuery",
]);

/**
 * A recognized filter counts only when the call supplies restricting input.
 *
 * `addActiveQuery()` is restricting with no arguments.
 * Missing or statically empty field/encoded-query arguments do not count.
 * Dynamic arguments become unknown and stay silent.
 */
function filterEvidence(
  property: string,
  call: ESTree.CallExpression,
  analysis: ProvenanceQuery,
): boolean | "unknown" | null {
  if (!analysis.glide.filters.has(property)) return null;
  if (property === "addActiveQuery") return true;
  if (!FIELD_OR_ENCODED_FILTERS.has(property)) return "unknown";

  const first = classifyStaticArg(call.arguments[0], analysis);
  switch (first) {
    case "missing":
    case "empty":
      return false;
    case "present":
      return getStringValue(call.arguments[0]) !== null;
    case "unknown":
      return "unknown";
    default: {
      const exhaustive: never = first;
      return exhaustive;
    }
  }
}

export function findUnfilteredBulkOperations(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): UnfilteredBulkFinding[] {
  const findings: UnfilteredBulkFinding[] = [];
  const reported = new Set<number>();
  analyzePathBindings<FilterData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({ filtered: false, uncertain: false }),
    cloneData: (data) => ({ ...data }),
    equalsData: (left, right) =>
      left.filtered === right.filtered && left.uncertain === right.uncertain,
    mergeData: (left, right) => ({
      filtered: mergeTri(left.filtered, right.filtered),
      uncertain: left.uncertain || right.uncertain,
    }),
    onCall({ call, rec, objectName, property }) {
      if (!rec || !objectName || !property) return;
      const evidence = filterEvidence(property, call, analysis);
      if (evidence === true) {
        rec.data.filtered = true;
        return;
      }
      if (evidence === "unknown") {
        rec.data.filtered = mergeTri(rec.data.filtered, "unknown");
        rec.data.uncertain = true;
        return;
      }
      if (evidence === false) {
        return;
      }
      if (
        analysis.glide.bulk.has(property) &&
        (rec.data.filtered === false || (rec.data.filtered === "unknown" && !rec.data.uncertain))
      ) {
        const key = nodeStart(call);
        if (!reported.has(key)) {
          reported.add(key);
          findings.push({ node: call, name: objectName, method: property });
        }
        return;
      }
      if (!analysis.glide.knownMethods.has(property) && rec.data.filtered !== true) {
        rec.data.filtered = "unknown";
        rec.data.uncertain = true;
      }
    },
  });
  return findings;
}
