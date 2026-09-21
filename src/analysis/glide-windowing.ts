import type { ESTree } from "@oxlint/plugins";
import { collectPathFindings, mergeTri } from "./path-state.js";
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
  return collectPathFindings<WindowData, WindowedDeleteFinding>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({ windowed: false }),
    equalsData: (left, right) => left.windowed === right.windowed,
    mergeData: (left, right) => ({ windowed: mergeTri(left.windowed, right.windowed) }),
    onCall({ call, rec, receiver, objectName, property }, report) {
      if (!rec || !receiver || !property) return;
      if (!hasAuthoritativeGlideRecordMethod(authority, receiver, property)) {
        rec.data.windowed = "unknown";
        return;
      }
      if (WINDOW.has(property)) rec.data.windowed = true;
      if (property === "deleteMultiple" && rec.data.windowed === true) {
        report({ node: call, name: objectName ?? "record", method: property });
      }
    },
  });
}
