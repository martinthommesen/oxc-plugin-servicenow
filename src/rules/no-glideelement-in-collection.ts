import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { getName, isNode, unwrapExpression } from "../utils/ast.js";
import {
  hasAuthoritativeGlideRecordMethod,
  staticPropertyName,
  type PlatformMethodAuthorityFacts,
} from "../analysis/internal.js";
import {
  analyzeGlideElementAliases,
  type GlideElementAliasFacts,
} from "../analysis/glideelement-aliases.js";
import { isFunctionLikeNode, visitChildren } from "../analysis/path-state.js";
import {
  definitelySkipsDoWhileTest,
  truthyPathRequiredCursorIds,
} from "../analysis/cursor-condition.js";
import { isServerInstanceContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

const COLLECTION_METHODS = new Set(["push", "unshift"]);
function isExtracted(
  node: unknown,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
): boolean {
  if (!isNode(node) || node.type !== "CallExpression") return false;
  const call = node as ESTree.CallExpression;
  if (
    getName(call.callee) === "String" &&
    isNode(call.callee) &&
    analysis.isPlatformGlobal(call.callee)
  ) {
    return true;
  }
  const property = staticPropertyName(call.callee);
  return (
    property === "toString" || (property !== null && analysis.glide.valueExtractors.has(property))
  );
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

function isCursorAdvanceCall(
  node: unknown,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
  authority: PlatformMethodAuthorityFacts,
): number | null {
  if (!isNode(node) || node.type !== "CallExpression") return null;
  const call = node as ESTree.CallExpression;
  const property = staticPropertyName(call.callee);
  if (
    !property ||
    !analysis.glide.cursorAdvancers.has(property) ||
    call.callee.type !== "MemberExpression"
  )
    return null;
  if (!hasAuthoritativeGlideRecordMethod(authority, call.callee.object, property)) return null;
  return objectIdOfCursor(analysis, call.callee.object);
}

function cursorIdsRequiredForBody(
  node: unknown,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
  authority: PlatformMethodAuthorityFacts,
): ReadonlySet<number> {
  return truthyPathRequiredCursorIds(node, (candidate) =>
    isCursorAdvanceCall(candidate, analysis, authority),
  );
}
function directGlideElementCursorId(
  node: unknown,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
  authority: PlatformMethodAuthorityFacts,
): number | null {
  const expr = unwrapExpression(node);
  if (!isNode(expr) || isExtracted(expr, analysis)) return null;
  if (expr.type === "CallExpression") {
    const call = expr as ESTree.CallExpression;
    if (
      staticPropertyName(call.callee) !== "getElement" ||
      call.callee.type !== "MemberExpression"
    ) {
      return null;
    }
    if (!hasAuthoritativeGlideRecordMethod(authority, call.callee.object, "getElement"))
      return null;
    const id = objectIdOfCursor(analysis, call.callee.object);
    return id;
  }
  if (expr.type !== "MemberExpression") return null;
  const member = expr as ESTree.MemberExpression;
  const property = staticPropertyName(member);
  if (!property || analysis.glide.knownMethods.has(property)) return null;
  return objectIdOfCursor(analysis, member.object);
}

function glideElementCursorId(
  node: unknown,
  cursorIds: ReadonlySet<number>,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
  aliases: GlideElementAliasFacts,
  authority: PlatformMethodAuthorityFacts,
): number | null {
  const expr = unwrapExpression(node);
  if (!isNode(expr) || isExtracted(expr, analysis)) return null;
  const id = directGlideElementCursorId(expr, analysis, authority) ?? aliases.cursorIdAt(expr);
  return id !== null && cursorIds.has(id) ? id : null;
}

function findRetainedElements(
  program: ESTree.Node,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
  authority: PlatformMethodAuthorityFacts,
): Array<{ node: ESTree.Node; name: string }> {
  const findings: Array<{ node: ESTree.Node; name: string }> = [];
  const aliases = analyzeGlideElementAliases(program, analysis, (node) =>
    directGlideElementCursorId(node, analysis, authority),
  );

  function retainedName(node: ESTree.Node): string {
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return "record";
    const alias = getName(expr);
    if (alias) return alias;
    if (expr.type === "MemberExpression") {
      const member = expr as ESTree.MemberExpression;
      const receiver = getName(member.object) ?? "record";
      const property = staticPropertyName(member);
      return property ? `${receiver}.${property}` : receiver;
    }
    if (expr.type === "CallExpression") {
      const call = expr as ESTree.CallExpression;
      if (call.callee.type === "MemberExpression") {
        const receiver = getName(call.callee.object) ?? "record";
        const method = staticPropertyName(call.callee);
        return method ? `${receiver}.${method}()` : receiver;
      }
    }
    return "record";
  }

  function retainedInValue(node: unknown, cursorIds: ReadonlySet<number>): ESTree.Node[] {
    const expr = unwrapExpression(node);
    if (!isNode(expr) || isExtracted(expr, analysis)) return [];
    if (glideElementCursorId(expr, cursorIds, analysis, aliases, authority) !== null) return [expr];
    if (
      expr.type === "CallExpression" &&
      getName((expr as ESTree.CallExpression).callee) === "String"
    ) {
      return (expr as ESTree.CallExpression).arguments.flatMap((argument) =>
        retainedInValue(argument, cursorIds),
      );
    }
    if (expr.type === "ArrayExpression") {
      return (expr as ESTree.ArrayExpression).elements.flatMap((item) =>
        retainedInValue(item, cursorIds),
      );
    }
    if (expr.type === "ObjectExpression") {
      return (expr as ESTree.ObjectExpression).properties.flatMap((property) => {
        if (!isNode(property)) return [];
        if (property.type === "SpreadElement") return retainedInValue(property.argument, cursorIds);
        if (property.type !== "Property") return [];
        return retainedInValue((property as ESTree.ObjectProperty).value, cursorIds);
      });
    }
    if (expr.type === "SpreadElement") return retainedInValue(expr.argument, cursorIds);
    return [];
  }

  const visitedIdSets = new WeakMap<ESTree.Node, Set<string>>();

  // The same Set instance threads unchanged through most of the traversal;
  // new instances appear only at loop heads and function boundaries. Caching
  // the canonical key per instance keeps the sort and join off the per-node
  // hot path. The key stays content-based: do/while re-entry relies on a
  // fresh set colliding with a content-equal earlier one.
  const idSetKeys = new WeakMap<ReadonlySet<number>, string>();
  const emptyIds: ReadonlySet<number> = new Set();

  function idSetKey(ids: ReadonlySet<number>): string {
    let key = idSetKeys.get(ids);
    if (key === undefined) {
      key = [...ids].sort((left, right) => left - right).join(",");
      idSetKeys.set(ids, key);
    }
    return key;
  }

  function visit(node: unknown, cursorIds: ReadonlySet<number>): void {
    if (!isNode(node)) return;
    // The visit is deterministic for a given (node, cursor-id set), so each
    // pair needs one traversal. Without this memo the do/while and for
    // branches re-visit each loop body, which composes exponentially for
    // nested loops (FINDINGS.md PER-002).
    const key = idSetKey(cursorIds);
    const seenKeys = visitedIdSets.get(node);
    if (seenKeys?.has(key)) return;
    if (seenKeys) seenKeys.add(key);
    else visitedIdSets.set(node, new Set([key]));
    if (node.type === "CallExpression") {
      const call = node as ESTree.CallExpression;
      const callee = unwrapExpression(call.callee);
      if (isNode(callee) && isFunctionLikeNode(callee)) {
        for (const argument of call.arguments) visit(argument, cursorIds);
        visit((callee as unknown as { body: ESTree.Node }).body, cursorIds);
        return;
      }
    }
    if (isFunctionLikeNode(node)) {
      visitChildren(node, (child) => visit(child, emptyIds));
      return;
    }
    if (node.type === "WhileStatement") {
      const statement = node as ESTree.WhileStatement;
      const nextIds = new Set([
        ...cursorIds,
        ...cursorIdsRequiredForBody(statement.test, analysis, authority),
      ]);
      visit(statement.test, cursorIds);
      // A while body is entered only after its test succeeds, even when that
      // first iteration exits unconditionally.
      visit(statement.body, nextIds);
      return;
    }
    if (node.type === "DoWhileStatement") {
      const statement = node as ESTree.DoWhileStatement;
      const nextIds = new Set([
        ...cursorIds,
        ...cursorIdsRequiredForBody(statement.test, analysis, authority),
      ]);
      visit(statement.body, cursorIds);
      visit(statement.test, cursorIds);
      if (!definitelySkipsDoWhileTest(statement.body)) visit(statement.body, nextIds);
      return;
    }
    if (node.type === "ForStatement") {
      const statement = node as ESTree.ForStatement;
      const nextIds = new Set(cursorIds);
      if (statement.test) {
        for (const id of cursorIdsRequiredForBody(statement.test, analysis, authority))
          nextIds.add(id);
      }
      const updateIds = statement.update
        ? cursorIdsRequiredForBody(statement.update, analysis, authority)
        : new Set<number>();
      if (statement.init) visit(statement.init, cursorIds);
      if (statement.test) visit(statement.test, cursorIds);
      if (statement.update) visit(statement.update, nextIds);
      visit(statement.body, nextIds);
      if (updateIds.size > 0) visit(statement.body, new Set([...nextIds, ...updateIds]));
      return;
    }
    if (node.type === "CallExpression" && cursorIds.size > 0) {
      const call = node as ESTree.CallExpression;
      if (staticPropertyName(call.callee) && call.callee.type === "MemberExpression") {
        const method = staticPropertyName(call.callee);
        if (method && COLLECTION_METHODS.has(method)) {
          for (const argument of call.arguments) {
            for (const retained of retainedInValue(argument, cursorIds)) {
              findings.push({
                node: retained,
                name: retainedName(retained),
              });
            }
          }
        }
      }
    }
    visitChildren(node, (child) => visit(child, cursorIds));
  }

  visit(program, emptyIds);
  const seen = new Set<ESTree.Node>();
  return findings.filter((finding) => {
    if (seen.has(finding.node)) return false;
    seen.add(finding.node);
    return true;
  });
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
        const { analysis, file } = beginRuleFile(context);
        for (const finding of findRetainedElements(node as ESTree.Node, analysis, file)) {
          context.report({
            node: finding.node,
            messageId: "retained",
            data: { name: finding.name },
          });
        }
      },
    };
  },
});
