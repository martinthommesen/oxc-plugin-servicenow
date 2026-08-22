import type { ESTree } from "@oxlint/plugins";
import { getName, isNode, unwrapExpression } from "../utils/ast.js";
import { GLIDE_QUERY_EXECUTORS } from "../glide/query-methods.js";
import { staticPropertyName } from "./members.js";
import type { ProvenanceQuery } from "./provenance.js";
import { isFunctionLikeNode, visitChildren } from "./path-state.js";
import {
  definitelySkipsDoWhileTest,
  truthyPathRequiresCursorNext,
} from "./cursor-condition.js";

export interface QueryInLoopFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
}

function isProvenCursor(analysis: ProvenanceQuery, node: unknown): boolean {
  const proven = analysis.ofExpression(node);
  return Boolean(
    proven &&
      (proven.kind === "GlideRecord" || proven.kind === "GlideAggregate") &&
      !proven.invalid &&
      !proven.escaped,
  );
}

/**
 * True only when a `.next()` call is proven to consume a GlideRecord or
 * GlideAggregate cursor. Unrelated iterators stay false.
 */
function isCursorNextCall(node: unknown, analysis: ProvenanceQuery): boolean {
  if (!isNode(node) || node.type !== "CallExpression") return false;
  const call = node as ESTree.CallExpression;
  if (staticPropertyName(call.callee) !== "next") return false;
  if (call.callee.type !== "MemberExpression") return false;
  return isProvenCursor(analysis, (call.callee as ESTree.MemberExpression).object);
}

function loopBodyRequiresCursor(test: unknown, analysis: ProvenanceQuery): boolean {
  return truthyPathRequiresCursorNext(test, (node) => isCursorNextCall(node, analysis));
}

export function findQueriesInCursorLoops(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): QueryInLoopFinding[] {
  const findings: QueryInLoopFinding[] = [];
  visit(program, 0, analysis, findings);
  const unique = new Set<ESTree.Node>();
  return findings.filter((finding) => {
    if (unique.has(finding.node)) return false;
    unique.add(finding.node);
    return true;
  });
}

function visit(
  node: unknown,
  cursorDepth: number,
  analysis: ProvenanceQuery,
  findings: QueryInLoopFinding[],
): void {
  if (!isNode(node)) return;
  if (node.type === "CallExpression") {
    const call = node as ESTree.CallExpression;
    const callee = unwrapExpression(call.callee);
    if (isNode(callee) && isFunctionLikeNode(callee)) {
      for (const argument of call.arguments) visit(argument, cursorDepth, analysis, findings);
      visit((callee as unknown as { body: ESTree.Node }).body, cursorDepth, analysis, findings);
      return;
    }
  }
  if (isFunctionLikeNode(node)) {
    visitChildren(node, (child) => visit(child, 0, analysis, findings));
    return;
  }

  if (node.type === "WhileStatement") {
    const stmt = node as ESTree.WhileStatement;
    const nextDepth = loopBodyRequiresCursor(stmt.test, analysis) ? cursorDepth + 1 : cursorDepth;
    visitLoopTest(stmt.test, cursorDepth, analysis, findings);
    visit(stmt.body, nextDepth, analysis, findings);
    return;
  }

  if (node.type === "DoWhileStatement") {
    const stmt = node as ESTree.DoWhileStatement;
    // The first do/while body runs before its test; only the subsequent path
    // is known to have passed a cursor condition.
    visit(stmt.body, cursorDepth, analysis, findings);
    visitLoopTest(stmt.test, cursorDepth, analysis, findings);
    if (
      loopBodyRequiresCursor(stmt.test, analysis) &&
      !definitelySkipsDoWhileTest(stmt.body)
    ) {
      visit(stmt.body, cursorDepth + 1, analysis, findings);
    }
    return;
  }

  if (node.type === "ForStatement") {
    const stmt = node as ESTree.ForStatement;
    const nextDepth = stmt.test && loopBodyRequiresCursor(stmt.test, analysis) ? cursorDepth + 1 : cursorDepth;
    if (stmt.init) visit(stmt.init, cursorDepth, analysis, findings);
    if (stmt.test) visitLoopTest(stmt.test, cursorDepth, analysis, findings);
    visit(stmt.body, nextDepth, analysis, findings);
    if (stmt.update) visit(stmt.update, nextDepth, analysis, findings);
    return;
  }

  if (node.type === "CallExpression" && cursorDepth > 0) {
    const call = node as ESTree.CallExpression;
    const property = staticPropertyName(call.callee);
    if (property && GLIDE_QUERY_EXECUTORS.has(property) && call.callee.type === "MemberExpression") {
      const object = (call.callee as ESTree.MemberExpression).object;
      if (isProvenCursor(analysis, object)) {
        findings.push({ node: call, name: getName(object) ?? "record", method: property });
      }
    }
  }

  visitChildren(node, (child) => visit(child, cursorDepth, analysis, findings));
}

function visitLoopTest(
  node: unknown,
  cursorDepth: number,
  analysis: ProvenanceQuery,
  findings: QueryInLoopFinding[],
): void {
  const expr = unwrapExpression(node);
  if (isNode(expr) && expr.type === "LogicalExpression" && expr.operator === "&&") {
    visitLoopTest(expr.left, cursorDepth, analysis, findings);
    const rightDepth = loopBodyRequiresCursor(expr.left, analysis)
      ? cursorDepth + 1
      : cursorDepth;
    visitLoopTest(expr.right, rightDepth, analysis, findings);
    return;
  }
  visit(expr, cursorDepth, analysis, findings);
}
