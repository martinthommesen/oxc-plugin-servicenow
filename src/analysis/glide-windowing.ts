import type { ESTree } from "@oxlint/plugins";
import { analyzePathBindings, mergeTri } from "./path-state.js";
import {
  hasAuthoritativeGlideRecordMethod,
  type PlatformMethodAuthorityFacts,
} from "./platform-method-authority.js";
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
  authority: PlatformMethodAuthorityFacts,
): WindowedDeleteFinding[] {
  const findings: WindowedDeleteFinding[] = [];
  // Keyed on node identity: nodeStart() returns -1 on a host whose nodes
  // carry no offset shape, which would collapse every finding in the file
  // onto one key and silently drop all but the first (FINDINGS.md COR-016).
  const reported = new Set<ESTree.Node>();
  analyzePathBindings<WindowData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({ windowed: false }),
    cloneData: (data) => ({ ...data }),
    equalsData: (left, right) => left.windowed === right.windowed,
    mergeData: (left, right) => ({ windowed: mergeTri(left.windowed, right.windowed) }),
    onCall({ call, rec, receiver, objectName, property }) {
      if (!rec || !receiver || !objectName || !property) return;
      if (!hasAuthoritativeGlideRecordMethod(authority, receiver, property)) {
        rec.data.windowed = "unknown";
        return;
      }
      if (WINDOW.has(property)) rec.data.windowed = true;
      if (property === "deleteMultiple" && rec.data.windowed === true) {
        if (!reported.has(call)) {
          reported.add(call);
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
