import type { ESTree } from "@oxlint/plugins";
import { GLIDE_BULK_METHODS, GLIDE_FILTER_METHODS, GLIDE_KNOWN_METHODS } from "../glide/query-methods.js";
import { analyzePathBindings, mergeTri } from "./path-state.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface UnfilteredBulkFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
}

interface FilterData {
  filtered: boolean | "unknown";
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
    emptyData: () => ({ filtered: false }),
    cloneData: (data) => ({ ...data }),
    mergeData: (left, right) => ({ filtered: mergeTri(left.filtered, right.filtered) }),
    onCall({ call, rec, objectName, property }) {
      if (!rec || !objectName || !property) return;
      if (GLIDE_FILTER_METHODS.has(property)) {
        rec.data.filtered = true;
        return;
      }
      if (GLIDE_BULK_METHODS.has(property) && rec.data.filtered === false) {
        findings.push({ node: call, name: objectName, method: property });
        return;
      }
      if (!GLIDE_KNOWN_METHODS.has(property) && rec.data.filtered === false) {
        rec.data.filtered = "unknown";
      }
    },
  });
  return findings;
}
