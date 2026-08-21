import type { ESTree } from "@oxlint/plugins";
import { nodeStart } from "../utils/ast.js";
import { analyzePathBindings, mergeTri } from "./path-state.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface WindowedDeleteFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
}

interface WindowData {
  windowed: boolean | "unknown";
}

const WINDOW = new Set(["setLimit", "chooseWindow"]);

/**
 * Report `deleteMultiple()` only when `setLimit` / `chooseWindow` is definite
 * on every remaining path for a proven GlideRecord binding.
 */
export function findWindowedDeleteMultiple(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): WindowedDeleteFinding[] {
  const findings: WindowedDeleteFinding[] = [];
  const reported = new Set<number>();
  analyzePathBindings<WindowData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({ windowed: false }),
    cloneData: (data) => ({ ...data }),
    equalsData: (left, right) => left.windowed === right.windowed,
    mergeData: (left, right) => ({ windowed: mergeTri(left.windowed, right.windowed) }),
    onCall({ call, rec, objectName, property }) {
      if (!rec || !objectName || !property) return;
      if (WINDOW.has(property)) rec.data.windowed = true;
      if (property === "deleteMultiple" && rec.data.windowed === true) {
        const key = nodeStart(call);
        if (!reported.has(key)) {
          reported.add(key);
          findings.push({ node: call, name: objectName, method: property });
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
