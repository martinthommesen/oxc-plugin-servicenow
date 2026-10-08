import type { ESTree } from "@oxlint/plugins";
import { getName } from "../utils/ast.js";
import type { EnvState } from "./path-types.js";
import { BUDGET_EXCEEDED, type WorkBudget } from "./path-budget.js";
import {
  completionPaths,
  mergeMany,
  mergeStates,
  setCompletion,
  snapshotState,
  statesEqual,
  type MergePolicy,
} from "./path-environment.js";
import type { ConstantValue } from "./constant-value.js";
import { evaluatedConstantValue } from "./path-values.js";

interface ControlFlowContext<T> {
  visit: (node: unknown, state: EnvState<T>, traverseRoot: boolean) => void;
  budget: WorkBudget;
  cloneData: (data: T) => T;
  equalsData: (left: T, right: T) => boolean;
  mergePolicy: MergePolicy<T>;
  ancestors: ESTree.Node[];
  tryThrowPaths: EnvState<T>[][];
  stopAtAwait: boolean;
  joinInto: (state: EnvState<T>, paths: EnvState<T>[]) => void;
  invalidatePattern: (state: EnvState<T>, pattern: unknown) => void;
  rememberExpressionResult: (state: EnvState<T>, node: ESTree.Node, value: unknown) => void;
  finishExpressionResults: (state: EnvState<T>) => void;
}

/** Statement branches, loop fixpoints and abrupt completions share one policy. */
export function createControlFlowVisitor<T>(context: ControlFlowContext<T>) {
  const {
    visit,
    budget,
    cloneData,
    equalsData,
    mergePolicy,
    ancestors,
    tryThrowPaths,
    stopAtAwait,
    joinInto,
    invalidatePattern,
    rememberExpressionResult,
    finishExpressionResults,
  } = context;
  const rightRuns = (
    operator: ESTree.LogicalExpression["operator"],
    value: ConstantValue,
  ): boolean =>
    operator === "&&" ? value.truthy : operator === "||" ? !value.truthy : value.nullish;
  const evaluatedPaths = (state: EnvState<T>): EnvState<T>[] =>
    state.callablePaths.length || state.abrupt.size
      ? completionPaths(state, cloneData, budget)
      : [state];
  return (node: ESTree.Node, state: EnvState<T>): boolean => {
    switch (node.type) {
      case "IfStatement":
      case "ConditionalExpression": {
        visit(node.test, state, false);
        const remember = (path: EnvState<T>, branch: ESTree.Node | null): void => {
          if (node.type === "ConditionalExpression") rememberExpressionResult(path, node, branch);
        };
        const groups = new Map<boolean | null, EnvState<T>[]>();
        const results: EnvState<T>[] = [];
        for (const path of evaluatedPaths(state)) {
          if (path.completion !== "normal") {
            results.push(path);
            continue;
          }
          const selected = evaluatedConstantValue(path, node.test, budget)?.truthy ?? null;
          if (node.type === "IfStatement") finishExpressionResults(path);
          const paths = groups.get(selected) ?? [];
          paths.push(path);
          groups.set(selected, paths);
        }
        for (const [selected, paths] of groups) {
          const entry = mergeMany(paths, mergePolicy);
          if (!entry) continue;
          if (selected !== null) {
            const branch = selected ? node.consequent : node.alternate;
            if (branch) visit(branch, entry, false);
            remember(entry, branch);
            results.push(entry);
          } else {
            const consequent = snapshotState(entry, cloneData, budget);
            visit(node.consequent, consequent, false);
            remember(consequent, node.consequent);
            const alternate = snapshotState(entry, cloneData, budget);
            if (node.alternate) visit(node.alternate, alternate, false);
            remember(alternate, node.alternate);
            results.push(consequent, alternate);
          }
        }
        joinInto(state, results);
        break;
      }
      case "LogicalExpression": {
        const expr = node as ESTree.LogicalExpression;
        visit(expr.left, state, false);
        const groups = new Map<boolean | null, EnvState<T>[]>();
        const results: EnvState<T>[] = [];
        for (const path of evaluatedPaths(state)) {
          if (path.completion !== "normal") {
            results.push(path);
            continue;
          }
          const value = evaluatedConstantValue(path, expr.left, budget);
          const selected = value ? rightRuns(expr.operator, value) : null;
          const paths = groups.get(selected) ?? [];
          paths.push(path);
          groups.set(selected, paths);
        }
        for (const [selected, paths] of groups) {
          const entry = mergeMany(paths, mergePolicy);
          if (!entry) continue;
          if (selected !== true) {
            const skipped = selected === false ? entry : snapshotState(entry, cloneData, budget);
            rememberExpressionResult(skipped, expr, expr.left);
            results.push(skipped);
          }
          if (selected !== false) {
            visit(expr.right, entry, false);
            rememberExpressionResult(entry, expr, expr.right);
            results.push(entry);
          }
        }
        joinInto(state, results);
        break;
      }
      case "LabeledStatement": {
        const statement = node as ESTree.LabeledStatement;
        const label = getName(statement.label);
        visit(statement.body, state, false);
        const paths = completionPaths(state, cloneData, budget);
        for (const path of paths) {
          if (path.completion === "break" && path.completionLabel === label) {
            setCompletion(path, "normal");
          }
        }
        joinInto(state, paths);
        break;
      }
      case "SwitchStatement": {
        const stmt = node as ESTree.SwitchStatement;
        visit(stmt.discriminant, state, false);
        finishExpressionResults(state);
        if (state.completion !== "normal") break;
        const before = snapshotState(state, cloneData, budget);
        const exits: EnvState<T>[] = [];
        const abruptExits: EnvState<T>[] = [];
        let hasDefault = false;
        let fall: EnvState<T> | undefined;
        const directState = snapshotState(before, cloneData, budget);
        for (const switchCase of stmt.cases) {
          if (!switchCase.test) hasDefault = true;
          if (switchCase.test) visit(switchCase.test, directState, false);
          finishExpressionResults(directState);
          const direct = snapshotState(directState, cloneData, budget);
          const entry = fall ? mergeStates(direct, fall, mergePolicy) : direct;
          for (const consequent of switchCase.consequent) visit(consequent, entry, false);
          if (entry.completion === "break" && !entry.completionLabel) {
            setCompletion(entry, "normal");
            exits.push(entry);
            fall = undefined;
          } else if (entry.completion === "normal") {
            fall = entry;
          } else {
            abruptExits.push(entry);
            fall = undefined;
          }
        }
        if (!hasDefault) exits.push(snapshotState(directState, cloneData, budget));
        if (fall?.completion === "normal") exits.push(fall);
        joinInto(state, [...exits, ...abruptExits]);
        break;
      }
      case "ForStatement":
      case "WhileStatement":
      case "DoWhileStatement":
      case "ForInStatement":
      case "ForOfStatement": {
        // Evaluate loop headers before taking the zero-iteration snapshot. A
        // condition can mutate a tracked object even when it immediately
        // yields false, so the post-test state is the loop's zero-body path.
        if (node.type === "ForStatement" && (node as ESTree.ForStatement).init) {
          visit((node as ESTree.ForStatement).init, state, false);
          finishExpressionResults(state);
        }
        if (node.type === "ForInStatement" || node.type === "ForOfStatement") {
          const iterable = node as ESTree.ForInStatement | ESTree.ForOfStatement;
          if (iterable.right) visit(iterable.right, state, false);
          finishExpressionResults(state);
          if (
            node.type === "ForOfStatement" &&
            (node as ESTree.ForOfStatement).await &&
            stopAtAwait &&
            state.completion === "normal"
          ) {
            setCompletion(state, "suspend");
            break;
          }
        }

        const beforeTest = snapshotState(state, cloneData, budget);
        const testState = snapshotState(beforeTest, cloneData, budget);
        const isFor = node.type === "ForStatement";
        const isWhile = node.type === "WhileStatement";
        const isDoWhile = node.type === "DoWhileStatement";
        const parent = ancestors[ancestors.length - 2];
        const loopLabel =
          parent?.type === "LabeledStatement" && (parent as ESTree.LabeledStatement).body === node
            ? getName((parent as ESTree.LabeledStatement).label)
            : null;
        const ownsLoopCompletion = (path: EnvState<T>, kind: "break" | "continue"): boolean =>
          path.completion === kind && (!path.completionLabel || path.completionLabel === loopLabel);
        if (isFor) {
          const test = (node as ESTree.ForStatement).test;
          if (test) visit(test, testState, false);
        } else if (isWhile) {
          visit((node as ESTree.WhileStatement).test, testState, false);
        }

        const test = isFor
          ? (node as ESTree.ForStatement).test
          : isWhile
            ? (node as ESTree.WhileStatement).test
            : isDoWhile
              ? (node as ESTree.DoWhileStatement).test
              : undefined;
        const loopTest = (path: EnvState<T>): ConstantValue | null =>
          isFor && !test
            ? { truthy: true, nullish: false }
            : isFor || isWhile || isDoWhile
              ? evaluatedConstantValue(path, test, budget)
              : null;
        const exits: EnvState<T>[] = [];
        const entries: EnvState<T>[] = [];
        for (const path of evaluatedPaths(isDoWhile ? beforeTest : testState)) {
          if (path.completion !== "normal") {
            exits.push(path);
            continue;
          }
          const selected = isDoWhile ? null : loopTest(path);
          finishExpressionResults(path);
          if (!isDoWhile && selected?.truthy !== true) {
            exits.push(snapshotState(path, cloneData, budget));
          }
          if (isDoWhile || selected?.truthy !== false) entries.push(path);
        }
        const initialHeader = mergeMany(entries, mergePolicy);
        if (!initialHeader) {
          joinInto(state, exits);
          break;
        }
        let header = snapshotState(initialHeader, cloneData, budget);
        let converged = false;
        const body = (node as { body: ESTree.Node }).body;
        for (let iteration = 0; iteration < 16; iteration += 1) {
          const bodyState = snapshotState(header, cloneData, budget);
          if (node.type === "ForInStatement" || node.type === "ForOfStatement") {
            const left = (node as ESTree.ForInStatement | ESTree.ForOfStatement).left;
            if (left.type === "VariableDeclaration") {
              visit(left, bodyState, false);
              // A `var` head declarator has no initializer, so the visit is a
              // runtime no-op; the head still rebinds its names on every
              // iteration whatever the declaration kind (FINDINGS.md COR-013).
              for (const declarator of (left as ESTree.VariableDeclaration).declarations) {
                invalidatePattern(bodyState, declarator.id);
              }
            } else invalidatePattern(bodyState, left);
          }
          visit(body, bodyState, false);

          const backEdges: EnvState<T>[] = [];
          for (const path of completionPaths(bodyState, cloneData, budget)) {
            if (ownsLoopCompletion(path, "break")) {
              setCompletion(path, "normal");
              exits.push(path);
              continue;
            }
            if (ownsLoopCompletion(path, "continue")) setCompletion(path, "normal");
            if (path.completion !== "normal") {
              exits.push(path);
              continue;
            }
            if (isFor) {
              const update = (node as ESTree.ForStatement).update;
              if (update) visit(update, path, false);
              finishExpressionResults(path);
            }
            if (isDoWhile) {
              visit((node as ESTree.DoWhileStatement).test, path, false);
            } else if (test) {
              visit(test, path, false);
            }
            for (const evaluated of evaluatedPaths(path)) {
              if (evaluated.completion !== "normal") {
                exits.push(evaluated);
                continue;
              }
              const selected = loopTest(evaluated);
              finishExpressionResults(evaluated);
              if (selected?.truthy !== true) {
                exits.push(snapshotState(evaluated, cloneData, budget));
              }
              if (selected?.truthy !== false) backEdges.push(evaluated);
            }
          }
          const back = mergeMany(backEdges, mergePolicy);
          if (!back) {
            converged = true;
            break;
          }
          const nextHeader = mergeStates(initialHeader, back, mergePolicy);
          if (statesEqual(header, nextHeader, equalsData, mergePolicy)) {
            converged = true;
            break;
          }
          header = nextHeader;
        }
        if (!converged) throw BUDGET_EXCEEDED;
        if (exits.length === 0) setCompletion(state, "unreachable");
        else joinInto(state, exits);
        break;
      }

      case "TryStatement": {
        const stmt = node as ESTree.TryStatement;
        const tried = snapshotState(state, cloneData, budget);
        const possibleThrows: EnvState<T>[] = [];
        tryThrowPaths.push(possibleThrows);
        try {
          visit(stmt.block, tried, false);
        } finally {
          tryThrowPaths.pop();
        }
        const handled: EnvState<T>[] = [];
        for (const path of [...completionPaths(tried, cloneData, budget), ...possibleThrows]) {
          if (path.completion === "throw" && stmt.handler) {
            setCompletion(path, "normal");
            visit(stmt.handler, path, false);
            handled.push(path);
            continue;
          }
          handled.push(path);
        }
        if (stmt.finalizer) {
          for (const path of handled) {
            if (path.completion === "unreachable" || path.completion === "suspend") continue;
            const priorCompletion = path.completion;
            const priorLabel = path.completionLabel ?? null;
            setCompletion(path, "normal");
            visit(stmt.finalizer, path, false);
            if (path.completion === "normal") setCompletion(path, priorCompletion, priorLabel);
          }
        }
        joinInto(state, handled);
        break;
      }
      default:
        return false;
    }
    return true;
  };
}
