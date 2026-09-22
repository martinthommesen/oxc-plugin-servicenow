import type { ESTree } from "@oxlint/plugins";
import { collectPathFindings } from "./path-state.js";
import {
  hasAuthoritativeGlideRecordMethod,
  type PlatformMethodAuthorityFacts,
} from "./platform-method-authority.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface QueryModifierFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
}

interface LifecycleData {
  opened: boolean;
  pending: boolean;
}

export function findQueryModifiersAfterQuery(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  authority: PlatformMethodAuthorityFacts,
): QueryModifierFinding[] {
  return collectPathFindings<LifecycleData, QueryModifierFinding>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({ opened: false, pending: false }),
    equalsData: (left, right) => left.opened === right.opened && left.pending === right.pending,
    mergeData: (left, right) => ({
      opened: left.opened || right.opened,
      pending: left.pending || right.pending,
    }),
    onCall({ call, rec, receiver, objectName, property }, report) {
      if (!rec || !receiver || !property) return;
      if (!hasAuthoritativeGlideRecordMethod(authority, receiver, property)) {
        rec.data.opened = false;
        rec.data.pending = false;
        return;
      }
      if (analysis.glide.byKind.GlideRecord.executors.has(property)) {
        rec.data.opened = true;
        rec.data.pending = false;
        return;
      }
      if (analysis.glide.byKind.GlideRecord.possibleExecutors.has(property)) {
        // A scope-specific executor may have refreshed the cursor. Positive
        // lifecycle diagnostics require certainty, so discard stale facts.
        rec.data.opened = false;
        rec.data.pending = false;
        return;
      }
      if (analysis.glide.byKind.GlideRecord.modifiers.has(property) && rec.data.opened === true) {
        rec.data.pending = true;
      }
      if (analysis.glide.byKind.GlideRecord.consumers.has(property) && rec.data.pending === true) {
        report({ node: call, name: objectName ?? "record", method: property });
      }
    },
  });
}
