import type { ESTree } from "@oxlint/plugins";
import type { PathFindingOptions } from "./path-types.js";
import { analyzePathBindings } from "./path-interpreter.js";
import { shallowClone } from "./path-domains.js";

export type {
  BindingId,
  ObjectId,
  Completion,
  SharedRecord,
  PathCallInput,
  PathRefInput,
  PathAnalysisOutcome,
  PathAnalysisOptions,
  PathExitState,
  PathFindingOptions,
} from "./path-types.js";
export { analyzePathBindings } from "./path-interpreter.js";
export {
  BUDGET_EXCEEDED,
  MAX_PATH_DEPTH,
  defaultMaxWork,
  exhaustedPathAnalysis,
  getPathBudgetExceededCount,
  resetPathBudgetExceededCount,
  spendWork,
  type WorkBudget,
} from "./path-budget.js";
export {
  shallowClone,
  mergeTri,
  mergeKeyedUnion,
  keyedAlternativeDomain,
  type KeyedAlternatives,
} from "./path-domains.js";

// Keyed on node identity: nodeStart() returns -1 on hosts without offset
// shapes, which would collapse every finding onto one key (FINDINGS.md COR-016).
export function dedupePathFindings<T extends { node: ESTree.Node }>(
  findings: T[],
  keyOf?: (finding: T) => string,
): T[] {
  const seen = new WeakMap<ESTree.Node, Set<string>>();
  return findings.filter((finding) => {
    let keys = seen.get(finding.node);
    if (!keys) {
      keys = new Set();
      seen.set(finding.node, keys);
    }
    const key = keyOf?.(finding) ?? "";
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

/**
 * Run one finder domain over the shared interpreter and return its findings.
 * Exhaustion returns no findings, so the silence rule lives here once instead
 * of in every finder's return statement.
 */
export function collectPathFindings<T, F extends { node: ESTree.Node }>(
  options: PathFindingOptions<T, F>,
  keyOf?: (finding: F) => string,
): F[] {
  const { cloneData = shallowClone, onCall, ...rest } = options;
  const findings: F[] = [];
  const report = (finding: F): void => {
    findings.push(finding);
  };
  const outcome = analyzePathBindings<T>({
    ...rest,
    cloneData,
    onCall: (input) => {
      onCall(input, report);
    },
  });
  return outcome.outcome === "complete" ? dedupePathFindings(findings, keyOf) : [];
}
