import type { ESTree } from "@oxlint/plugins";
import { analyzePathBindings, mergeTri } from "./path-state.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface ChooseWindowCountFinding {
  node: ESTree.CallExpression;
  name: string;
}

interface CountData {
  windowed: boolean | "unknown";
  skippedCount: boolean | "unknown";
  usedRowCount: boolean | "unknown";
  wantsCount: boolean | "unknown";
}

interface PendingFinding {
  rec: { data: CountData; escaped: boolean; invalid: boolean };
  node: ESTree.CallExpression;
  name: string;
}

function forceCountArg(call: ESTree.CallExpression): boolean | "unknown" {
  const arg = call.arguments[2];
  if (!arg) return false;
  if (arg.type === "Literal" && arg.value === true) return true;
  if (arg.type === "Literal" && arg.value === false) return false;
  return "unknown";
}

/**
 * Report `query()` / `get()` after a definite `chooseWindow()` when the
 * binding never skips the documented `COUNT(*)` and never reads `getRowCount()`.
 *
 * Evidence: Zurich scoped GlideRecord `chooseWindow` / `setNoCount`.
 */
export function findChooseWindowWithoutNoCount(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): ChooseWindowCountFinding[] {
  const pending: PendingFinding[] = [];
  analyzePathBindings<CountData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({
      windowed: false,
      skippedCount: false,
      usedRowCount: false,
      wantsCount: false,
    }),
    cloneData: (data) => ({ ...data }),
    mergeData: (left, right) => ({
      windowed: mergeTri(left.windowed, right.windowed),
      skippedCount: mergeTri(left.skippedCount, right.skippedCount),
      usedRowCount: mergeTri(left.usedRowCount, right.usedRowCount),
      wantsCount: mergeTri(left.wantsCount, right.wantsCount),
    }),
    onCall({ call, rec, objectName, property }) {
      if (!rec || !objectName || !property) return;
      if (property === "chooseWindow") {
        rec.data.windowed = true;
        rec.data.wantsCount = forceCountArg(call);
      }
      if (property === "setNoCount" || property === "setLimit") {
        rec.data.skippedCount = true;
      }
      if (property === "getRowCount") {
        rec.data.usedRowCount = true;
      }
      if (rec.escaped || rec.invalid) return;
      if (
        (property === "query" || property === "get") &&
        rec.data.windowed === true &&
        rec.data.skippedCount === false &&
        rec.data.wantsCount === false
      ) {
        pending.push({ rec, node: call, name: objectName });
      }
    },
  });

  const findings: ChooseWindowCountFinding[] = [];
  for (const item of pending) {
    if (item.rec.data.usedRowCount !== false) continue;
    findings.push({ node: item.node, name: item.name });
  }
  return findings;
}
