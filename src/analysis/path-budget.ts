import type { ESTree } from "@oxlint/plugins";
import { isNode, visitChildren } from "../utils/ast.js";
import type { ProvenanceQuery } from "./provenance.js";
import type { PathAnalysisOutcome } from "./path-types.js";

// Snapshot cost grows superlinearly with file length (top-level `var`
// bindings stay live to end of file), so the default budget scales with
// program size while `maxWork` stays an explicit override and the ceiling
// still bounds adversarial input (FINDINGS.md PER-003).
const WORK_PER_NODE = 128;
/** Floor of the default work budget, whatever the program size. */
const MIN_WORK_BUDGET = 50_000;
/** Ceiling of the default work budget, whatever the program size. */
const MAX_WORK_BUDGET = 5_000_000;
const programNodeBudgets = new WeakMap<ESTree.Node, number>();
export const MAX_PATH_DEPTH = 128;
export const BUDGET_EXCEEDED = Symbol("path-analysis-budget-exceeded");
let budgetExceededCount = 0;

export function getPathBudgetExceededCount(): number {
  return budgetExceededCount;
}

export function resetPathBudgetExceededCount(): void {
  budgetExceededCount = 0;
}

export interface WorkBudget {
  remaining: number;
}

export function spendWork(budget: WorkBudget, amount = 1): void {
  budget.remaining -= amount;
  if (budget.remaining < 0) throw BUDGET_EXCEEDED;
}

export function exhaustedPathAnalysis(analysis: ProvenanceQuery): PathAnalysisOutcome {
  budgetExceededCount += 1;
  analysis.onExhausted?.();
  return { outcome: "exhausted" };
}

function countNodes(program: ESTree.Node): number {
  let count = 0;
  const pending: ESTree.Node[] = [program];
  while (pending.length > 0) {
    const node = pending.pop()!;
    count += 1;
    visitChildren(node, (child) => {
      if (isNode(child)) pending.push(child);
    });
  }
  return count;
}

export function defaultMaxWork(program: ESTree.Node): number {
  const cached = programNodeBudgets.get(program);
  if (cached !== undefined) return cached;
  const budget = Math.min(
    MAX_WORK_BUDGET,
    Math.max(MIN_WORK_BUDGET, countNodes(program) * WORK_PER_NODE),
  );
  programNodeBudgets.set(program, budget);
  return budget;
}
