import type { ESTree } from "@oxlint/plugins";
import {
  GLIDE_QUERY_EXECUTORS,
  GLIDE_QUERY_MODIFIERS,
  GLIDE_RESULT_CONSUMERS,
} from "../glide/query-methods.js";
import { analyzePathBindings, mergeTri } from "./path-state.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface QueryModifierFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
}

interface LifecycleData {
  opened: boolean | "unknown";
  pending: boolean | "unknown";
}

export function findQueryModifiersAfterQuery(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): QueryModifierFinding[] {
  const findings: QueryModifierFinding[] = [];
  analyzePathBindings<LifecycleData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({ opened: false, pending: false }),
    cloneData: (data) => ({ ...data }),
    equalsData: (left, right) => left.opened === right.opened && left.pending === right.pending,
    mergeData: (left, right) => ({
      opened: mergeTri(left.opened, right.opened),
      pending: mergeTri(left.pending, right.pending),
    }),
    onCall({ call, rec, objectName, property }) {
      if (!rec || !objectName || !property) return;
      if (GLIDE_QUERY_EXECUTORS.has(property)) {
        rec.data.opened = true;
        rec.data.pending = false;
        return;
      }
      if (GLIDE_QUERY_MODIFIERS.has(property) && rec.data.opened === true) {
        rec.data.pending = true;
      }
      if (GLIDE_RESULT_CONSUMERS.has(property) && rec.data.pending === true) {
        findings.push({ node: call, name: objectName, method: property });
      }
    },
  });
  return findings;
}
