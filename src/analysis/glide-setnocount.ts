import type { ESTree } from "@oxlint/plugins";
import { GLIDE_QUERY_EXECUTORS } from "../glide/query-methods.js";
import { analyzePathBindings, mergeTri } from "./path-state.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface ChooseWindowCountFinding {
  node: ESTree.CallExpression;
  name: string;
}

interface CountData {
  queryEpoch: number;
  windowed: boolean | "unknown";
  skippedCount: boolean | "unknown";
  wantsCount: boolean | "unknown";
}

interface PendingFinding {
  objectId: number;
  epoch: number;
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

function mergeEpoch(left: number, right: number): number {
  return left === right ? left : -1;
}

/**
 * Report `query()` / `get()` / `getAsync()` after a definite `chooseWindow()`
 * when that query epoch never skips `COUNT(*)` and never reads `getRowCount()`.
 *
 * Pending diagnostics store `(objectId, queryEpoch)` snapshots. Joins cannot
 * attach those findings to a replaced mutable record.
 *
 * Evidence: Zurich scoped GlideRecord `chooseWindow` / `setNoCount`.
 */
export function findChooseWindowWithoutNoCount(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): ChooseWindowCountFinding[] {
  const pending: PendingFinding[] = [];
  const usedRowCount = new Set<string>();

  analyzePathBindings<CountData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({
      queryEpoch: 0,
      windowed: false,
      skippedCount: false,
      wantsCount: false,
    }),
    cloneData: (data) => ({ ...data }),
    mergeData: (left, right) => ({
      queryEpoch: mergeEpoch(left.queryEpoch, right.queryEpoch),
      windowed: mergeTri(left.windowed, right.windowed),
      skippedCount: mergeTri(left.skippedCount, right.skippedCount),
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
        const executed = rec.data.queryEpoch - 1;
        if (executed >= 0) {
          usedRowCount.add(`${rec.id}:${executed}`);
        }
      }
      if (!GLIDE_QUERY_EXECUTORS.has(property)) return;
      if (rec.data.queryEpoch < 0) {
        rec.data = {
          queryEpoch: -1,
          windowed: false,
          skippedCount: false,
          wantsCount: false,
        };
        return;
      }
      if (
        rec.data.windowed === true &&
        rec.data.skippedCount === false &&
        rec.data.wantsCount === false
      ) {
        pending.push({
          objectId: rec.id,
          epoch: rec.data.queryEpoch,
          node: call,
          name: objectName,
        });
      }
      rec.data = {
        queryEpoch: rec.data.queryEpoch + 1,
        windowed: false,
        skippedCount: false,
        wantsCount: false,
      };
    },
  });

  const findings: ChooseWindowCountFinding[] = [];
  for (const item of pending) {
    if (usedRowCount.has(`${item.objectId}:${item.epoch}`)) continue;
    findings.push({ node: item.node, name: item.name });
  }
  return findings;
}
