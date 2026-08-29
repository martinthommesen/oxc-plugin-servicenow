import type { ESTree } from "@oxlint/plugins";
import { analyzePathBindings } from "./path-state.js";
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
  const findings: QueryModifierFinding[] = [];
  // Keyed on node identity: nodeStart() returns -1 on a host whose nodes
  // carry no offset shape, which would collapse every finding in the file
  // onto one key and silently drop all but the first (FINDINGS.md COR-016).
  const reported = new Set<ESTree.Node>();
  analyzePathBindings<LifecycleData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({ opened: false, pending: false }),
    cloneData: (data) => ({ ...data }),
    equalsData: (left, right) => left.opened === right.opened && left.pending === right.pending,
    mergeData: (left, right) => ({
      opened: left.opened || right.opened,
      pending: left.pending || right.pending,
    }),
    onCall({ call, rec, receiver, objectName, property }) {
      if (!rec || !receiver || !property) return;
      if (!hasAuthoritativeGlideRecordMethod(authority, receiver, property)) {
        rec.data.opened = false;
        rec.data.pending = false;
        return;
      }
      if (analysis.glide.executors.has(property)) {
        rec.data.opened = true;
        rec.data.pending = false;
        return;
      }
      if (analysis.glide.possibleExecutors.has(property)) {
        // A scope-specific executor may have refreshed the cursor. Positive
        // lifecycle diagnostics require certainty, so discard stale facts.
        rec.data.opened = false;
        rec.data.pending = false;
        return;
      }
      if (analysis.glide.modifiers.has(property) && rec.data.opened === true) {
        rec.data.pending = true;
      }
      if (analysis.glide.consumers.has(property) && rec.data.pending === true) {
        if (!reported.has(call)) {
          reported.add(call);
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
