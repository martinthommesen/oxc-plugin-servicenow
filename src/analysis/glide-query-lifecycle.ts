import type { ESTree } from "@oxlint/plugins";
import { nodeStart } from "../utils/ast.js";
import { analyzePathBindings } from "./path-state.js";
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
): QueryModifierFinding[] {
  const findings: QueryModifierFinding[] = [];
  const reported = new Set<number>();
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
    onCall({ call, rec, objectName, property }) {
      if (!rec || !property) return;
      if (analysis.glide.executors.has(property)) {
        rec.data.opened = true;
        rec.data.pending = false;
        return;
      }
      if (analysis.glide.modifiers.has(property) && rec.data.opened === true) {
        rec.data.pending = true;
      }
      if (analysis.glide.consumers.has(property) && rec.data.pending === true) {
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
