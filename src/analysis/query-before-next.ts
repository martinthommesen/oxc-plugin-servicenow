import type { ESTree } from "@oxlint/plugins";
import { getName, isNode, WALK_SKIP_KEYS } from "../utils/ast.js";
import { staticPropertyName } from "./members.js";
import type { ProvenanceQuery, QueryState } from "./provenance.js";

export interface MissingQueryFinding {
  node: ESTree.CallExpression;
  name: string;
}

interface RecordState {
  queryState: QueryState;
  escaped: boolean;
  invalid: boolean;
}

function cloneState(state: RecordState): RecordState {
  return { ...state };
}

function mergeState(left: RecordState | undefined, right: RecordState | undefined): RecordState | undefined {
  if (!left) return right ? { ...right, queryState: right.queryState === "unopened" ? "unknown" : right.queryState } : undefined;
  if (!right) return { ...left, queryState: left.queryState === "unopened" ? "unknown" : left.queryState };
  const queryState =
    left.queryState === right.queryState ? left.queryState : ("unknown" as QueryState);
  return {
    queryState,
    escaped: left.escaped || right.escaped,
    invalid: left.invalid || right.invalid,
  };
}

function mergeMaps(left: Map<string, RecordState>, right: Map<string, RecordState>): Map<string, RecordState> {
  const names = new Set([...left.keys(), ...right.keys()]);
  const out = new Map<string, RecordState>();
  for (const name of names) {
    const merged = mergeState(left.get(name), right.get(name));
    if (merged) out.set(name, merged);
  }
  return out;
}

function snapshot(map: Map<string, RecordState>): Map<string, RecordState> {
  const out = new Map<string, RecordState>();
  for (const [name, state] of map) out.set(name, cloneState(state));
  return out;
}

const OPENERS = new Set(["query", "get", "getAsync"]);

/**
 * Path-sensitive query-before-next for proven GlideRecord bindings.
 *
 * Reports only when every path to `next()` still has `queryState === "unopened"`.
 * `chooseWindow` does not open a cursor. Branch disagreement is unknown and
 * suppresses the diagnostic.
 */
export function findMissingQueryBeforeNext(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): MissingQueryFinding[] {
  const findings: MissingQueryFinding[] = [];
  analyzeBlock(program, new Map(), analysis, findings, new Set());
  return findings;
}

function analyzeBlock(
  node: ESTree.Node,
  records: Map<string, RecordState>,
  analysis: ProvenanceQuery,
  findings: MissingQueryFinding[],
  seenFunctions: Set<ESTree.Node>,
): Map<string, RecordState> {
  visit(node, records, analysis, findings, seenFunctions, true);
  return records;
}

function visit(
  node: unknown,
  records: Map<string, RecordState>,
  analysis: ProvenanceQuery,
  findings: MissingQueryFinding[],
  seenFunctions: Set<ESTree.Node>,
  traverseRoot: boolean,
): void {
  if (!isNode(node)) return;

  if (isFunctionLikeNode(node) && !traverseRoot) {
    if (seenFunctions.has(node)) return;
    seenFunctions.add(node);
    const nested = new Map<string, RecordState>();
    visitChildren(node, nested, analysis, findings, seenFunctions);
    for (const state of records.values()) state.escaped = true;
    return;
  }

  switch (node.type) {
    case "VariableDeclarator": {
      const decl = node as ESTree.VariableDeclarator;
      const name = getName(decl.id);
      if (name && decl.init) {
        const proven = analysis.ofExpression(decl.init);
        if (proven?.kind === "GlideRecord" && !proven.invalid) {
          records.set(name, { queryState: "unopened", escaped: false, invalid: false });
        }
      }
      visitChildren(node, records, analysis, findings, seenFunctions);
      return;
    }
    case "AssignmentExpression": {
      const assign = node as ESTree.AssignmentExpression;
      const name = getName(assign.left);
      visit(assign.right, records, analysis, findings, seenFunctions, false);
      if (name) {
        const proven = analysis.ofExpression(assign.right);
        if (proven?.kind === "GlideRecord" && !proven.invalid) {
          records.set(name, { queryState: "unopened", escaped: false, invalid: false });
        } else if (records.has(name)) {
          const state = records.get(name)!;
          state.invalid = true;
        }
      }
      return;
    }
    case "IfStatement": {
      const stmt = node as ESTree.IfStatement;
      visit(stmt.test, records, analysis, findings, seenFunctions, false);
      const before = snapshot(records);
      const consequent = snapshot(before);
      visit(stmt.consequent, consequent, analysis, findings, seenFunctions, false);
      const alternate = snapshot(before);
      if (stmt.alternate) visit(stmt.alternate, alternate, analysis, findings, seenFunctions, false);
      const merged = mergeMaps(consequent, alternate);
      records.clear();
      for (const [name, state] of merged) records.set(name, state);
      return;
    }
    case "SwitchStatement": {
      const stmt = node as ESTree.SwitchStatement;
      visit(stmt.discriminant, records, analysis, findings, seenFunctions, false);
      const before = snapshot(records);
      let merged: Map<string, RecordState> | undefined;
      for (const switchCase of stmt.cases) {
        const path = snapshot(before);
        visit(switchCase, path, analysis, findings, seenFunctions, false);
        merged = merged ? mergeMaps(merged, path) : path;
      }
      if (merged) {
        records.clear();
        for (const [name, state] of merged) records.set(name, state);
      }
      return;
    }
    case "WhileStatement":
    case "DoWhileStatement":
    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement": {
      const before = snapshot(records);
      visitChildren(node, records, analysis, findings, seenFunctions);
      const merged = mergeMaps(before, records);
      records.clear();
      for (const [name, state] of merged) records.set(name, state);
      return;
    }
    case "CallExpression": {
      const call = node as ESTree.CallExpression;
      const callee = call.callee;
      const property = staticPropertyName(callee);
      const objectName =
        isNode(callee) && callee.type === "MemberExpression"
          ? getName((callee as ESTree.MemberExpression).object)
          : null;
      if (objectName && property) {
        const state = records.get(objectName);
        if (state && !state.invalid && !state.escaped) {
          if (OPENERS.has(property) && state.queryState === "unopened") {
            state.queryState = "opened";
          }
          if (property === "next" && state.queryState === "unopened") {
            findings.push({ node: call, name: objectName });
          }
        }
      }
      for (const arg of call.arguments) {
        if (isNode(arg) && arg.type === "Identifier") {
          const name = getName(arg);
          if (name && records.has(name)) records.get(name)!.escaped = true;
        }
      }
      visitChildren(node, records, analysis, findings, seenFunctions);
      return;
    }
    default:
      visitChildren(node, records, analysis, findings, seenFunctions);
  }
}

function visitChildren(
  node: ESTree.Node,
  records: Map<string, RecordState>,
  analysis: ProvenanceQuery,
  findings: MissingQueryFinding[],
  seenFunctions: Set<ESTree.Node>,
): void {
  for (const key of Object.keys(node)) {
    if (WALK_SKIP_KEYS.has(key)) continue;
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const child of value) visit(child, records, analysis, findings, seenFunctions, false);
    } else {
      visit(value, records, analysis, findings, seenFunctions, false);
    }
  }
}

function isFunctionLikeNode(node: ESTree.Node): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}
