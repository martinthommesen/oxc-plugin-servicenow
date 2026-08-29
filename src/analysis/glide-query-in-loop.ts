import type { ESTree } from "@oxlint/plugins";
import { getName, isNode } from "../utils/ast.js";
import { staticPropertyName } from "./members.js";
import type { ProvenanceQuery } from "./provenance.js";
import { iifeCallee, isFunctionLikeNode, isSynchronousIife, visitChildren } from "./path-state.js";
import { truthyPathRequiresCursorNext } from "./cursor-condition.js";

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

function containsCursorNext(node: unknown, analysis: ProvenanceQuery): boolean {
  if (!isNode(node) || isFunctionLikeNode(node)) return false;
  if (isCursorNextCall(node, analysis)) return true;
  let found = false;
  visitChildren(node, (child) => {
    if (!found && containsCursorNext(child, analysis)) found = true;
  });
  return found;
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
  if (isFunctionLikeNode(node)) {
    visitChildren(node, (child) => visit(child, 0, analysis, findings));
    return;
  }

  if (node.type === "WhileStatement") {
    const stmt = node as ESTree.WhileStatement;
    const nextDepth = loopBodyRequiresCursor(stmt.test, analysis) ? cursorDepth + 1 : cursorDepth;
    visit(stmt.test, cursorDepth, analysis, findings);
    visit(stmt.body, nextDepth, analysis, findings);
    return;
  }

  if (node.type === "DoWhileStatement") {
    const stmt = node as ESTree.DoWhileStatement;
    // The first do/while body runs before its test; only the subsequent path
    // is known to have passed a cursor condition.
    visit(stmt.body, cursorDepth, analysis, findings);
    visit(stmt.test, cursorDepth, analysis, findings);
    if (loopBodyRequiresCursor(stmt.test, analysis)) {
      visit(stmt.body, cursorDepth + 1, analysis, findings);
    }
    return;
  }

  if (node.type === "ForStatement") {
    const stmt = node as ESTree.ForStatement;
    const nextDepth =
      stmt.test && loopBodyRequiresCursor(stmt.test, analysis) ? cursorDepth + 1 : cursorDepth;
    if (stmt.init) visit(stmt.init, cursorDepth, analysis, findings);
    if (stmt.test) visit(stmt.test, cursorDepth, analysis, findings);
    visit(stmt.body, nextDepth, analysis, findings);
    if (stmt.update) visit(stmt.update, nextDepth, analysis, findings);
    if (stmt.update && containsCursorNext(stmt.update, analysis)) {
      visit(stmt.body, nextDepth + 1, analysis, findings);
    }
    return;
  }

  if (isSynchronousIife(node)) {
    // The IIFE body runs inside the loop right now: keep the cursor depth.
    const call = node as ESTree.CallExpression;
    for (const argument of call.arguments) visit(argument, cursorDepth, analysis, findings);
    visit(iifeCallee(call)!.body, cursorDepth, analysis, findings);
    return;
  }

  if (node.type === "CallExpression" && cursorDepth > 0) {
    const call = node as ESTree.CallExpression;
    const property = staticPropertyName(call.callee);
    if (
      property &&
      analysis.glide.executors.has(property) &&
      call.callee.type === "MemberExpression"
    ) {
      const object = (call.callee as ESTree.MemberExpression).object;
      if (isProvenCursor(analysis, object)) {
        findings.push({ node: call, name: getName(object) ?? "record", method: property });
      }
    }
  }

  visitChildren(node, (child) => visit(child, cursorDepth, analysis, findings));
}
