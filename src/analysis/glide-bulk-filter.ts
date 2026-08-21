import type { ESTree } from "@oxlint/plugins";
import { GLIDE_BULK_METHODS, GLIDE_FILTER_METHODS, GLIDE_KNOWN_METHODS } from "../glide/query-methods.js";
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
function filterEvidence(property: string, call: ESTree.CallExpression): boolean | "unknown" | null {
  if (property === "addActiveQuery") return true;
  if (!GLIDE_FILTER_METHODS.has(property)) return null;
  if (!FIELD_OR_ENCODED_FILTERS.has(property)) return "unknown";

  const first = classifyStaticArg(call.arguments[0]);
  switch (first) {
    case "missing":
    case "empty":
      return false;
    case "present":
      return true;
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
      const evidence = filterEvidence(property, call);
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
        GLIDE_BULK_METHODS.has(property) &&
        (rec.data.filtered === false || (rec.data.filtered === "unknown" && !rec.data.uncertain))
      ) {
        findings.push({ node: call, name: objectName, method: property });
        return;
      }
      if (!GLIDE_KNOWN_METHODS.has(property) && rec.data.filtered === false) {
        rec.data.filtered = "unknown";
        rec.data.uncertain = true;
      }
    },
  });
  return findings;
}
