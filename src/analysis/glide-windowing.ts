import type { ESTree } from "@oxlint/plugins";
import { analyzePathBindings, dedupePathFindings, mergeTri } from "./path-state.js";
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
  const outcome = analyzePathBindings<WindowData>({
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
        findings.push({ node: call, name: objectName, method: property });
      }
    },
  });
  return outcome.outcome === "complete" ? dedupePathFindings(findings) : [];
}
