import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { getName, isNode } from "../utils/ast.js";
import { staticPropertyName } from "../analysis/index.js";
import { isFunctionLikeNode, visitChildren } from "../analysis/path-state.js";
import { GLIDE_VALUE_EXTRACTORS } from "../glide/query-methods.js";
import { isServerInstanceContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

const COLLECTION_METHODS = new Set(["push", "unshift"]);
const CURSOR_MEMBERS = new Set([
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

function isExtracted(node: unknown): boolean {
  if (!isNode(node) || node.type !== "CallExpression") return false;
  const call = node as ESTree.CallExpression;
  if (getName(call.callee) === "String") return true;
  const property = staticPropertyName(call.callee);
  return property === "toString" || (property !== null && GLIDE_VALUE_EXTRACTORS.has(property));
}

function objectIdOfCursor(
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
  node: unknown,
): number | null {
  const proven = analysis.ofExpression(node);
  if (
    !proven ||
    proven.kind !== "GlideRecord" ||
    proven.invalid ||
    proven.escaped ||
    proven.objectId === undefined
  ) {
    return null;
  }
  return proven.objectId;
}

function isCursorNext(
  node: unknown,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
): number | null {
  if (!isNode(node)) return null;
  if (node.type === "LogicalExpression") {
    const expr = node as ESTree.LogicalExpression;
    return isCursorNext(expr.left, analysis) ?? isCursorNext(expr.right, analysis);
  }
  if (node.type !== "CallExpression") return null;
  const call = node as ESTree.CallExpression;
  if (staticPropertyName(call.callee) !== "next" || call.callee.type !== "MemberExpression") {
    return null;
  }
  return objectIdOfCursor(analysis, call.callee.object);
}

function isGlideElement(
  node: unknown,
  cursorIds: ReadonlySet<number>,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
): number | null {
  if (!isNode(node) || isExtracted(node)) return null;
  if (node.type === "CallExpression") {
    const call = node as ESTree.CallExpression;
    if (staticPropertyName(call.callee) !== "getElement" || call.callee.type !== "MemberExpression") {
      return null;
    }
    const id = objectIdOfCursor(analysis, call.callee.object);
    return id !== null && cursorIds.has(id) ? id : null;
  }
  if (node.type !== "MemberExpression") return null;
  const member = node as ESTree.MemberExpression;
  const property = staticPropertyName(member);
  if (!property || CURSOR_MEMBERS.has(property)) return null;
  const id = objectIdOfCursor(analysis, member.object);
  return id !== null && cursorIds.has(id) ? id : null;
}

function findRetainedElements(
  program: ESTree.Node,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
): Array<{ node: ESTree.Node; name: string }> {
  const findings: Array<{ node: ESTree.Node; name: string }> = [];

  function visit(node: unknown, cursorIds: ReadonlySet<number>): void {
    if (!isNode(node)) return;
    if (isFunctionLikeNode(node)) {
      visitChildren(node, (child) => visit(child, new Set()));
      return;
    }
    if (node.type === "WhileStatement" || node.type === "DoWhileStatement") {
      const statement = node as ESTree.WhileStatement | ESTree.DoWhileStatement;
      const id = isCursorNext(statement.test, analysis);
      const nextIds = new Set(cursorIds);
      if (id !== null) nextIds.add(id);
      visit(statement.test, cursorIds);
      visit(statement.body, nextIds);
      return;
    }
    if (node.type === "ForStatement") {
      const statement = node as ESTree.ForStatement;
      const nextIds = new Set(cursorIds);
      if (statement.test) {
        const id = isCursorNext(statement.test, analysis);
        if (id !== null) nextIds.add(id);
      }
      if (statement.init) visit(statement.init, cursorIds);
      if (statement.test) visit(statement.test, cursorIds);
      if (statement.update) visit(statement.update, nextIds);
      visit(statement.body, nextIds);
      return;
    }
    if (node.type === "CallExpression" && cursorIds.size > 0) {
      const call = node as ESTree.CallExpression;
      if (staticPropertyName(call.callee) && call.callee.type === "MemberExpression") {
        const method = staticPropertyName(call.callee);
        if (method && COLLECTION_METHODS.has(method)) {
          for (const argument of call.arguments) {
            const id = isGlideElement(argument, cursorIds, analysis);
            if (id !== null) {
              findings.push({
                node: argument as ESTree.Node,
                name: getName(call.callee.object) ?? "record",
              });
            }
          }
        }
      }
    }
    visitChildren(node, (child) => visit(child, cursorIds));
  }

  visit(program, new Set());
  return findings;
}

export const noGlideelementInCollection = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Do not push a GlideElement from a GlideRecord cursor into a collection. The element follows the cursor. Extract `getValue()`, `getDisplayValue()`, or `toString()`. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html",
      url: ruleDocsUrl("no-glideelement-in-collection"),
    },
    messages: {
      retained:
        "`{{name}}` field access yields a GlideElement bound to the current cursor. Extract a value before `push` / `unshift`.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isServerInstanceContext(script)) return false;
      },
      Program(node) {
        const { analysis } = beginRuleFile(context);
        for (const finding of findRetainedElements(node as ESTree.Node, analysis)) {
          context.report({ node: finding.node, messageId: "retained", data: { name: finding.name } });
        }
      },
    };
  },
});
