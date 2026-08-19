import type { ESTree } from "@oxlint/plugins";
import { getName, isNode } from "../utils/ast.js";
import { GLIDE_VALUE_EXTRACTORS } from "../glide/query-methods.js";
import { isComputedUnknown, staticPropertyName } from "./members.js";
import type { ProvenanceQuery } from "./provenance.js";
import { isFunctionLikeNode, visitChildren } from "./path-state.js";

export interface GlideElementCollectionFinding {
  node: ESTree.Node;
  name: string;
}

const COLLECT = new Set(["push", "unshift"]);
const CURSOR_METHODS = new Set([
  "query",
  "get",
  "next",
  "getValue",
  "getDisplayValue",
  "getUniqueValue",
  "getElement",
  "addQuery",
  "addEncodedQuery",
  "addActiveQuery",
  "setLimit",
  "chooseWindow",
  "orderBy",
  "orderByDesc",
  "update",
  "insert",
  "deleteRecord",
  "initialize",
  "setValue",
]);

function isCursorLoopTest(node: unknown, cursorName: string): boolean {
  if (!isNode(node)) return false;
  if (node.type === "LogicalExpression") {
    const expr = node as ESTree.LogicalExpression;
    return isCursorLoopTest(expr.left, cursorName) || isCursorLoopTest(expr.right, cursorName);
  }
  if (node.type !== "CallExpression") return false;
  const call = node as ESTree.CallExpression;
  if (staticPropertyName(call.callee) !== "next") return false;
  if (call.callee.type !== "MemberExpression") return false;
  return getName((call.callee as ESTree.MemberExpression).object) === cursorName;
}

function isExtracted(node: unknown): boolean {
  if (!isNode(node)) return false;
  if (node.type === "CallExpression") {
    const call = node as ESTree.CallExpression;
    const calleeName = getName(call.callee);
    if (calleeName === "String") return true;
    const property = staticPropertyName(call.callee);
    if (property === "toString") return true;
    if (property && GLIDE_VALUE_EXTRACTORS.has(property)) return true;
  }
  return false;
}

function isGlideElementArg(
  node: unknown,
  cursorName: string,
  analysis: ProvenanceQuery,
): boolean {
  if (!isNode(node) || isExtracted(node)) return false;
  if (node.type === "CallExpression") {
    const call = node as ESTree.CallExpression;
    if (staticPropertyName(call.callee) !== "getElement") return false;
    if (call.callee.type !== "MemberExpression") return false;
    const object = (call.callee as ESTree.MemberExpression).object;
    return getName(object) === cursorName && analysis.ofExpression(object)?.kind === "GlideRecord";
  }
  if (node.type !== "MemberExpression") return false;
  const member = node as ESTree.MemberExpression;
  if (getName(member.object) !== cursorName) return false;
  if (isComputedUnknown(member)) return false;
  const property = staticPropertyName(member);
  if (property && CURSOR_METHODS.has(property)) return false;
  const proven = analysis.ofExpression(member.object);
  return proven?.kind === "GlideRecord" && !proven.invalid && !proven.escaped;
}

export function findGlideElementCollections(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): GlideElementCollectionFinding[] {
  const findings: GlideElementCollectionFinding[] = [];
  visit(program, new Set(), analysis, findings);
  return findings;
}

function visit(
  node: unknown,
  cursors: Set<string>,
  analysis: ProvenanceQuery,
  findings: GlideElementCollectionFinding[],
): void {
  if (!isNode(node)) return;
  if (isFunctionLikeNode(node)) {
    visitChildren(node, (child) => visit(child, new Set(), analysis, findings));
    return;
  }

  if (node.type === "WhileStatement" || node.type === "DoWhileStatement") {
    const stmt = node as ESTree.WhileStatement | ESTree.DoWhileStatement;
    const nextCursors = new Set(cursors);
    for (const name of provenRecordNames(analysis, stmt.test)) {
      if (isCursorLoopTest(stmt.test, name)) nextCursors.add(name);
    }
    visit(stmt.test, cursors, analysis, findings);
    visit(stmt.body, nextCursors, analysis, findings);
    return;
  }

  if (node.type === "ForStatement") {
    const stmt = node as ESTree.ForStatement;
    const nextCursors = new Set(cursors);
    if (stmt.test) {
      for (const name of provenRecordNames(analysis, stmt.test)) {
        if (isCursorLoopTest(stmt.test, name)) nextCursors.add(name);
      }
    }
    if (stmt.init) visit(stmt.init, cursors, analysis, findings);
    if (stmt.test) visit(stmt.test, cursors, analysis, findings);
    if (stmt.update) visit(stmt.update, nextCursors, analysis, findings);
    visit(stmt.body, nextCursors, analysis, findings);
    return;
  }

  if (node.type === "CallExpression" && cursors.size > 0) {
    const call = node as ESTree.CallExpression;
    const property = staticPropertyName(call.callee);
    if (property && COLLECT.has(property)) {
      for (const arg of call.arguments) {
        for (const cursor of cursors) {
          if (isGlideElementArg(arg, cursor, analysis)) {
            findings.push({ node: arg as ESTree.Node, name: cursor });
          }
        }
      }
    }
  }

  visitChildren(node, (child) => visit(child, cursors, analysis, findings));
}

function provenRecordNames(analysis: ProvenanceQuery, node: unknown): string[] {
  const names: string[] = [];
  if (!isNode(node)) return names;
  if (node.type === "CallExpression" && node.callee.type === "MemberExpression") {
    const object = (node.callee as ESTree.MemberExpression).object;
    const name = getName(object);
    if (name && analysis.ofExpression(object)?.kind === "GlideRecord") names.push(name);
  }
  if (node.type === "LogicalExpression") {
    names.push(
      ...provenRecordNames(analysis, (node as ESTree.LogicalExpression).left),
      ...provenRecordNames(analysis, (node as ESTree.LogicalExpression).right),
    );
  }
  return names;
}
