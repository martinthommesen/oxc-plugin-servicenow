import type { ESTree } from "@oxlint/plugins";
import { analyzePathBindings } from "./path-state.js";
import {
  hasAuthoritativeGlideRecordMethod,
  type PlatformMethodAuthorityFacts,
} from "./platform-method-authority.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface ChooseWindowCountFinding {
  node: ESTree.CallExpression;
  name: string;
}

interface CountCandidate {
  node: ESTree.CallExpression;
  name: string;
  used: boolean;
}

interface CountAlternative {
  windowed: boolean;
  skippedCount: boolean;
  wantsCount: boolean | "unknown";
  uncertain: boolean;
  result: CountCandidate | null;
}

interface CountData {
  alternatives: CountAlternative[];
}

function forceCountArg(call: ESTree.CallExpression): boolean | "unknown" {
  const arg = call.arguments[2];
  if (!arg) return false;
  if (arg.type === "Literal" && arg.value === true) return true;
  if (arg.type === "Literal" && arg.value === false) return false;
  return "unknown";
}

function cloneAlternative(value: CountAlternative): CountAlternative {
  return {
    ...value,
    result: value.result ? { ...value.result } : null,
  };
}

function alternativeKey(value: CountAlternative): string {
  return JSON.stringify({
    windowed: value.windowed,
    skippedCount: value.skippedCount,
    wantsCount: value.wantsCount,
    uncertain: value.uncertain,
    resultStart: value.result?.node.start ?? null,
    resultUsed: value.result?.used ?? null,
  });
}

function mergeCountData(left: CountData, right: CountData): CountData {
  const alternatives = new Map<string, CountAlternative>();
  for (const value of [...left.alternatives, ...right.alternatives]) {
    alternatives.set(alternativeKey(value), cloneAlternative(value));
  }
  return { alternatives: [...alternatives.values()] };
}

/**
 * Report a reachable `query()` result that performs the documented
 * `chooseWindow()` count and is not consumed through `getRowCount()`.
 */
export function findChooseWindowWithoutNoCount(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  authority: PlatformMethodAuthorityFacts,
): ChooseWindowCountFinding[] {
  const finalized = new Map<ESTree.CallExpression, string>();
  const finalize = (alternative: CountAlternative): void => {
    if (alternative.result && !alternative.result.used) {
      finalized.set(alternative.result.node, alternative.result.name);
    }
  };

  analyzePathBindings<CountData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({
      alternatives: [
        {
          windowed: false,
          skippedCount: false,
          wantsCount: false,
          uncertain: false,
          result: null,
        },
      ],
    }),
    cloneData: (data) => ({ alternatives: data.alternatives.map(cloneAlternative) }),
    equalsData: (left, right) =>
      left.alternatives.length === right.alternatives.length &&
      left.alternatives.every(
        (value, index) => alternativeKey(value) === alternativeKey(right.alternatives[index]!),
      ),
    mergeData: mergeCountData,
    onCall({ call, rec, receiver, objectName, property }) {
      if (!rec || !receiver || !property) return;
      if (!hasAuthoritativeGlideRecordMethod(authority, receiver, property)) {
        for (const value of rec.data.alternatives) {
          if (value.result) value.result.used = true;
          value.uncertain = true;
        }
        return;
      }
      if (property === "chooseWindow") {
        for (const value of rec.data.alternatives) {
          value.windowed = true;
          value.wantsCount = forceCountArg(call);
        }
        return;
      }
      if (property === "setNoCount" || property === "setLimit") {
        for (const value of rec.data.alternatives) {
          value.skippedCount = true;
          value.uncertain = false;
        }
        return;
      }
      if (property === "getRowCount") {
        for (const value of rec.data.alternatives) {
          if (value.result) value.result.used = true;
        }
        return;
      }
      // ServiceNow documents the COUNT(*) behavior for query(), not get() or
      // getAsync(). Do not extend the performance claim to other executors.
      if (property !== "query") return;
      for (const value of rec.data.alternatives) {
        finalize(value);
        value.result =
          value.windowed && !value.skippedCount && value.wantsCount === false && !value.uncertain
            ? { node: call, name: objectName ?? "record", used: false }
            : null;
        value.windowed = false;
        value.skippedCount = false;
        value.wantsCount = false;
        value.uncertain = false;
      }
    },
    onExit(states) {
      for (const state of states) {
        for (const record of state.records) {
          for (const value of record.data.alternatives) finalize(value);
        }
      }
    },
    onBudgetExceeded() {
      finalized.clear();
    },
  });

  return [...finalized].map(([node, name]) => ({ node, name }));
}
