import type { ESTree } from "@oxlint/plugins";
import { getName } from "../utils/ast.js";
import type { EnvState } from "./path-types.js";
import { BUDGET_EXCEEDED, type WorkBudget } from "./path-budget.js";
import {
  completionPaths,
  mergeMany,
  mergeStates,
  replaceWith,
  setCompletion,
  snapshotState,
  statesEqual,
  type MergePolicy,
} from "./path-environment.js";
import {
  constantValue,
  isDefinitelyTrue,
  isDefinitelyFalse,
  logicalRightOperandRuns,
} from "./constant-value.js";

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
  rememberCallableResult: (state: EnvState<T>, node: ESTree.Node, value: unknown) => void;
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
    rememberCallableResult,
  } = context;
  return (node: ESTree.Node, state: EnvState<T>): boolean => {
    switch (node.type) {
      case "IfStatement":
      case "ConditionalExpression": {
        visit(node.test, state, false);
        if (state.completion !== "normal") break;
        const remember = (path: EnvState<T>, branch: ESTree.Node | null): void => {
          if (node.type === "ConditionalExpression") rememberCallableResult(path, node, branch);
        };
        const selected = constantValue(node.test);
        if (selected) {
          const branch = selected.truthy ? node.consequent : node.alternate;
          if (branch) visit(branch, state, false);
          remember(state, branch);
          break;
        }
        const consequent = snapshotState(state, cloneData, budget);
        visit(node.consequent, consequent, false);
        remember(consequent, node.consequent);
        const alternate = snapshotState(state, cloneData, budget);
        if (node.alternate) visit(node.alternate, alternate, false);
        remember(alternate, node.alternate);
        joinInto(state, [consequent, alternate]);
        break;
      }
      case "LogicalExpression": {
        const expr = node as ESTree.LogicalExpression;
        visit(expr.left, state, false);
        if (state.completion !== "normal") break;
        // A constant left operand fixes which short-circuit branch executes:
        // `true && f()` always evaluates `f()` and `false && f()` never does.
        // Only an unknown operand keeps the join of both paths (FINDINGS.md COR-003).
        const rightRuns = logicalRightOperandRuns(expr);
        if (rightRuns === false) {
          rememberCallableResult(state, expr, expr.left);
          break;
        }
        if (rightRuns === true) {
          visit(expr.right, state, false);
          rememberCallableResult(state, expr, expr.right);
          break;
        }
        const afterLeft = snapshotState(state, cloneData, budget);
        rememberCallableResult(afterLeft, expr, expr.left);
        visit(expr.right, state, false);
        rememberCallableResult(state, expr, expr.right);
        joinInto(state, [afterLeft, snapshotState(state, cloneData, budget)]);
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
        }
        if (node.type === "ForInStatement" || node.type === "ForOfStatement") {
          const iterable = node as ESTree.ForInStatement | ESTree.ForOfStatement;
          if (iterable.right) visit(iterable.right, state, false);
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
        if (!isDoWhile && (isFor || isWhile) && isDefinitelyFalse(test)) {
          replaceWith(state, testState);
          break;
        }
        const infinite = (isFor || isWhile || isDoWhile) && isDefinitelyTrue(test);
        const exits: EnvState<T>[] =
          isDoWhile || infinite ? [] : [snapshotState(testState, cloneData, budget)];
        const initialHeader = snapshotState(isDoWhile ? beforeTest : testState, cloneData, budget);
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
            }
            if (isDoWhile) {
              visit((node as ESTree.DoWhileStatement).test, path, false);
            } else if (test) {
              visit(test, path, false);
            }
            if (!infinite) exits.push(snapshotState(path, cloneData, budget));
            if (!isDefinitelyFalse(test)) backEdges.push(path);
          }
          const back = mergeMany(backEdges, mergePolicy);
          if (!back) {
            converged = true;
            break;
          }
          const nextHeader = mergeStates(initialHeader, back, mergePolicy);
          if (statesEqual(header, nextHeader, equalsData, budget)) {
            converged = true;
            break;
          }
          header = nextHeader;
        }
        if (exits.length === 0) setCompletion(state, "unreachable");
        else if (converged) joinInto(state, exits);
        else throw BUDGET_EXCEEDED;
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
