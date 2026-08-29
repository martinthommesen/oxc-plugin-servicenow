import type { ESTree } from "@oxlint/plugins";
import { getName, isNode, unwrapExpression } from "../utils/ast.js";
import { isDefinitelyUndefinedValue, staticPropertyName } from "./members.js";
import type { ProvenanceQuery } from "./provenance.js";
import { visitChildren } from "./path-state.js";
import { definitelySkipsDoWhileTest, truthyPathRequiresCursorNext } from "./cursor-condition.js";
import {
  analyzeStableInvocations,
  isFunctionNode,
  type ImmediateFunction,
  type StableInvocationQuery,
} from "./stable-invocations.js";
import {
  hasAuthoritativeConstructedMethod,
  hasAuthoritativeGlideRecordMethod,
  type PlatformMethodAuthorityFacts,
} from "./platform-method-authority.js";

export interface QueryInLoopFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
}

type CursorKind = "GlideRecord" | "GlideAggregate";

interface CursorVisitState {
  readonly analysis: ProvenanceQuery;
  readonly authority: PlatformMethodAuthorityFacts;
  readonly findings: QueryInLoopFinding[];
  readonly invocations: StableInvocationQuery;
  readonly activeFunctions: Set<ImmediateFunction>;
  readonly visitedFunctionModes: WeakMap<ImmediateFunction, number>;
  readonly visitedNodeModes: WeakMap<ESTree.Node, number>;
}

const OUTSIDE_CURSOR = 1;
const INSIDE_CURSOR = 2;

function provenCursorKind(analysis: ProvenanceQuery, node: unknown): CursorKind | null {
  const proven = analysis.ofExpression(node);
  if (
    !proven ||
    (proven.kind !== "GlideRecord" && proven.kind !== "GlideAggregate") ||
    proven.invalid ||
    proven.escaped
  ) {
    return null;
  }
  return proven.kind;
}

function isQueryExecutor(kind: CursorKind, property: string, analysis: ProvenanceQuery): boolean {
  return kind === "GlideRecord" ? analysis.glide.executors.has(property) : property === "query";
}

function hasCursorMethodAuthority(
  kind: CursorKind,
  receiver: unknown,
  property: string,
  authority: PlatformMethodAuthorityFacts,
): boolean {
  return kind === "GlideRecord"
    ? hasAuthoritativeGlideRecordMethod(authority, receiver, property)
    : hasAuthoritativeConstructedMethod(authority, receiver, "GlideAggregate", property);
}

function isCursorAdvanceCall(
  node: unknown,
  analysis: ProvenanceQuery,
  authority: PlatformMethodAuthorityFacts,
): boolean {
  if (!isNode(node) || node.type !== "CallExpression") return false;
  const call = node as ESTree.CallExpression;
  const property = staticPropertyName(call.callee);
  if (!property) return false;
  if (call.callee.type !== "MemberExpression") return false;
  const receiver = (call.callee as ESTree.MemberExpression).object;
  const kind = provenCursorKind(analysis, receiver);
  if (!kind) return false;
  if (!hasCursorMethodAuthority(kind, receiver, property, authority)) return false;
  return kind === "GlideRecord"
    ? analysis.glide.cursorAdvancers.has(property)
    : property === "next";
}

function loopBodyRequiresCursor(
  test: unknown,
  analysis: ProvenanceQuery,
  authority: PlatformMethodAuthorityFacts,
): boolean {
  return truthyPathRequiresCursorNext(test, (node) =>
    isCursorAdvanceCall(node, analysis, authority),
  );
}

function containsCursorAdvance(
  node: unknown,
  analysis: ProvenanceQuery,
  authority: PlatformMethodAuthorityFacts,
): boolean {
  if (!isNode(node) || isFunctionNode(node)) return false;
  if (isCursorAdvanceCall(node, analysis, authority)) return true;
  let found = false;
  visitChildren(node, (child) => {
    if (!found && containsCursorAdvance(child, analysis, authority)) found = true;
  });
  return found;
}

export function findQueriesInCursorLoops(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  authority: PlatformMethodAuthorityFacts,
): QueryInLoopFinding[] {
  const findings: QueryInLoopFinding[] = [];
  const state: CursorVisitState = {
    analysis,
    authority,
    findings,
    invocations: analyzeStableInvocations(program, analysis.bindings, authority.bindingWrites),
    activeFunctions: new Set(),
    visitedFunctionModes: new WeakMap(),
    visitedNodeModes: new WeakMap(),
  };
  visit(program, 0, state);
  const unique = new Set<ESTree.Node>();
  return findings.filter((finding) => {
    if (unique.has(finding.node)) return false;
    unique.add(finding.node);
    return true;
  });
}

function visitFunctionBody(
  fn: ImmediateFunction,
  cursorDepth: number,
  state: CursorVisitState,
): void {
  if (state.activeFunctions.has(fn)) return;
  const mode = cursorDepth > 0 ? INSIDE_CURSOR : OUTSIDE_CURSOR;
  const visited = state.visitedFunctionModes.get(fn) ?? 0;
  if ((visited & mode) !== 0) return;
  state.visitedFunctionModes.set(fn, visited | mode);
  state.activeFunctions.add(fn);
  try {
    visit(fn.body, cursorDepth, state);
  } finally {
    state.activeFunctions.delete(fn);
  }
}

function visitMissingParameterDefaults(
  call: ESTree.CallExpression,
  fn: ImmediateFunction,
  cursorDepth: number,
  state: CursorVisitState,
): void {
  if (call.arguments.some((argument) => argument.type === "SpreadElement")) return;
  for (let index = 0; index < fn.params.length; index += 1) {
    const parameter = unwrapExpression(fn.params[index]);
    if (!isNode(parameter) || parameter.type !== "AssignmentPattern") continue;
    const argument = call.arguments[index];
    const definitelyUndefined =
      !argument || isDefinitelyUndefinedValue(argument, state.analysis.bindings);
    if (definitelyUndefined) visit(parameter.right, cursorDepth, state);
  }
}

function visit(node: unknown, cursorDepth: number, state: CursorVisitState): void {
  if (!isNode(node)) return;
  // Findings depend on cursorDepth only through `> 0`, so each node needs at
  // most one visit inside and one outside a cursor. Without this memo the
  // do/while and for branches re-visit each loop body, which composes
  // exponentially for nested loops (FINDINGS.md PER-002).
  const mode = cursorDepth > 0 ? INSIDE_CURSOR : OUTSIDE_CURSOR;
  const seen = state.visitedNodeModes.get(node) ?? 0;
  if ((seen & mode) !== 0) return;
  state.visitedNodeModes.set(node, seen | mode);
  if (node.type === "CallExpression") {
    const call = node as ESTree.CallExpression;
    const invoked = state.invocations.resolve(call.callee);
    if (invoked) {
      // An immediately invoked function executes at the caller's current
      // cursor depth. Arguments run before definitely selected parameter
      // defaults and the function body.
      for (const argument of call.arguments) visit(argument, cursorDepth, state);
      visitMissingParameterDefaults(call, invoked, cursorDepth, state);
      visitFunctionBody(invoked, cursorDepth, state);
      return;
    }
  }
  if (isFunctionNode(node)) {
    visitFunctionBody(node, 0, state);
    return;
  }

  if (node.type === "WhileStatement") {
    const stmt = node as ESTree.WhileStatement;
    const nextDepth = loopBodyRequiresCursor(stmt.test, state.analysis, state.authority)
      ? cursorDepth + 1
      : cursorDepth;
    visitCondition(stmt.test, cursorDepth, state);
    visit(stmt.body, nextDepth, state);
    return;
  }

  if (node.type === "DoWhileStatement") {
    const stmt = node as ESTree.DoWhileStatement;
    // The first do/while body runs before its test; only the subsequent path
    // is known to have passed a cursor condition.
    visit(stmt.body, cursorDepth, state);
    visitCondition(stmt.test, cursorDepth, state);
    if (
      loopBodyRequiresCursor(stmt.test, state.analysis, state.authority) &&
      !definitelySkipsDoWhileTest(stmt.body)
    ) {
      visit(stmt.body, cursorDepth + 1, state);
    }
    return;
  }

  if (node.type === "ForStatement") {
    const stmt = node as ESTree.ForStatement;
    const nextDepth =
      stmt.test && loopBodyRequiresCursor(stmt.test, state.analysis, state.authority)
        ? cursorDepth + 1
        : cursorDepth;
    if (stmt.init) visit(stmt.init, cursorDepth, state);
    if (stmt.test) visitCondition(stmt.test, cursorDepth, state);
    visit(stmt.body, nextDepth, state);
    if (stmt.update) visit(stmt.update, nextDepth, state);
    if (stmt.update && containsCursorAdvance(stmt.update, state.analysis, state.authority)) {
      visit(stmt.body, nextDepth + 1, state);
    }
    return;
  }

  if (node.type === "CallExpression" && cursorDepth > 0) {
    const call = node as ESTree.CallExpression;
    const property = staticPropertyName(call.callee);
    if (property && call.callee.type === "MemberExpression") {
      const object = (call.callee as ESTree.MemberExpression).object;
      const kind = provenCursorKind(state.analysis, object);
      if (
        kind &&
        isQueryExecutor(kind, property, state.analysis) &&
        hasCursorMethodAuthority(kind, object, property, state.authority)
      ) {
        state.findings.push({ node: call, name: getName(object) ?? "record", method: property });
      }
    }
  }

  visitChildren(node, (child) => visit(child, cursorDepth, state));
}

function visitCondition(node: unknown, cursorDepth: number, state: CursorVisitState): void {
  const expr = unwrapExpression(node);
  if (!isNode(expr)) return;
  if (expr.type === "LogicalExpression") {
    const logical = expr as ESTree.LogicalExpression;
    visitCondition(logical.left, cursorDepth, state);
    const rightDepth =
      logical.operator === "&&" &&
      loopBodyRequiresCursor(logical.left, state.analysis, state.authority)
        ? cursorDepth + 1
        : cursorDepth;
    visitCondition(logical.right, rightDepth, state);
    return;
  }
  if (expr.type === "SequenceExpression") {
    let depth = cursorDepth;
    for (const value of (expr as ESTree.SequenceExpression).expressions) {
      visit(value, depth, state);
      if (isCursorAdvanceCall(value, state.analysis, state.authority)) depth += 1;
    }
    return;
  }
  visit(expr, cursorDepth, state);
}
