import type { ESTree } from "@oxlint/plugins";
import { getName, isNode } from "../utils/ast.js";
import { GLIDE_QUERY_EXECUTORS } from "../glide/query-methods.js";
import { staticPropertyName } from "./members.js";
import type { ProvenanceQuery } from "./provenance.js";
import { isFunctionLikeNode, visitChildren } from "./path-state.js";

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
  if (!isNode(node)) return false;
  if (node.type === "LogicalExpression") {
    const logical = node as ESTree.LogicalExpression;
    return isCursorNextCall(logical.left, analysis) || isCursorNextCall(logical.right, analysis);
  }
  if (node.type !== "CallExpression") return false;
  const call = node as ESTree.CallExpression;
  if (staticPropertyName(call.callee) !== "next") return false;
  if (call.callee.type !== "MemberExpression") return false;
  return isProvenCursor(analysis, (call.callee as ESTree.MemberExpression).object);
}

export function findQueriesInCursorLoops(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): QueryInLoopFinding[] {
  const findings: QueryInLoopFinding[] = [];
  visit(program, 0, analysis, findings);
  return findings;
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

  if (node.type === "WhileStatement" || node.type === "DoWhileStatement") {
    const stmt = node as ESTree.WhileStatement | ESTree.DoWhileStatement;
    const nextDepth = isCursorNextCall(stmt.test, analysis) ? cursorDepth + 1 : cursorDepth;
    visit(stmt.test, cursorDepth, analysis, findings);
    visit(stmt.body, nextDepth, analysis, findings);
    return;
  }

  if (node.type === "ForStatement") {
    const stmt = node as ESTree.ForStatement;
    const nextDepth = isCursorNextCall(stmt.test, analysis) ? cursorDepth + 1 : cursorDepth;
    if (stmt.init) visit(stmt.init, cursorDepth, analysis, findings);
    if (stmt.test) visit(stmt.test, cursorDepth, analysis, findings);
    if (stmt.update) visit(stmt.update, nextDepth, analysis, findings);
    visit(stmt.body, nextDepth, analysis, findings);
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
