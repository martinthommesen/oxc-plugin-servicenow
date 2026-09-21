import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, isNode, nodeEnd, nodeStart } from "../utils/ast.js";
import {
  getAncestors,
  hasAuthoritativeGlideRecordMethod,
  provenReceiver,
  staticPropertyName,
  type FileAnalysis,
  type ProvenanceQuery,
} from "../analysis/internal.js";
import { isServerInstanceContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

export const preferGlideaggregate = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer GlideAggregate for counting records instead of proven GlideRecord.getRowCount() or iterate-to-count loops.",
      url: ruleDocsUrl("prefer-glideaggregate"),
    },
    messages: {
      getRowCount:
        "`{{name}}.getRowCount()` loads every matching row. Use `GlideAggregate` with `addAggregate('COUNT')` instead. This diagnostic does not rewrite the query; copy filters by hand.",
      iterateCount:
        "This loop only counts rows from `{{name}}`. Use `GlideAggregate` with `addAggregate('COUNT')` instead.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { script } = beginRuleFile(context);
        if (!isServerInstanceContext(script)) return false;
        return undefined;
      },
      CallExpression(node) {
        const file = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        const member = call.callee as ESTree.MemberExpression;
        const property = staticPropertyName(member);
        if (property !== "getRowCount") return;
        const receiver = glideRecordReceiver(file.provenance, member.object);
        if (!receiver) return;
        if (!hasAuthoritativeGlideRecordMethod(file, member.object, property)) return;
        context.report({
          node,
          messageId: "getRowCount",
          data: { name: receiver.name },
        });
      },
      WhileStatement(node) {
        checkLoopBody(node as ESTree.WhileStatement);
      },
      ForStatement(node) {
        checkLoopBody(node as ESTree.ForStatement);
      },
    };

    function glideRecordReceiver(
      analysis: ProvenanceQuery,
      node: unknown,
    ): { id: number; name: string } | null {
      const proven = provenReceiver(analysis, node, "GlideRecord");
      if (!proven || proven.objectId === undefined) return null;
      return { id: proven.objectId, name: getName(node) ?? "record" };
    }

    function checkLoopBody(node: ESTree.WhileStatement | ESTree.ForStatement) {
      const file = beginRuleFile(context);
      const test = node.test;
      if (!test || test.type !== "CallExpression") return;
      const callee = (test as ESTree.CallExpression).callee;
      if (callee.type !== "MemberExpression") return;
      const property = staticPropertyName(callee);
      if (!property || !file.glide.byKind.GlideRecord.cursorAdvancers.has(property)) return;
      const receiver = glideRecordReceiver(file.provenance, callee.object);
      if (!receiver) return;
      if (!hasAuthoritativeGlideRecordMethod(file, callee.object, property)) return;

      const body = node.body;
      const statements = body.type === "BlockStatement" ? [...body.body] : [body];
      const meaningful = statements.filter((stmt) => stmt.type !== "EmptyStatement");
      const updates: ESTree.Node[] = [];
      if (node.type === "ForStatement" && node.update) updates.push(node.update as ESTree.Node);
      for (const statement of meaningful) {
        if (statement.type !== "ExpressionStatement") return;
        updates.push((statement as ESTree.ExpressionStatement).expression as ESTree.Node);
      }
      // An empty loop proves no counting behavior. Every reachable statement
      // must be one of the three exact numeric counter forms.
      if (updates.length === 0) return;
      let counterId: number | undefined;
      for (const update of updates) {
        const target = counterUpdateTarget(update, file.provenance);
        if (!target) return;
        if (counterId === undefined) counterId = target;
        if (counterId !== target) return;
      }
      if (counterId === undefined) return;
      if (
        !counterDeclaration(counterId, file) ||
        !counterHasOnlyAllowedUses(counterId, node, new Set(updates), file)
      )
        return;
      context.report({ node, messageId: "iterateCount", data: { name: receiver.name } });
    }

    function counterUpdateTarget(node: ESTree.Node, analysis: ProvenanceQuery): number | null {
      if (node.type === "UpdateExpression") {
        const update = node as ESTree.UpdateExpression;
        if (
          update.operator !== "++" ||
          !isNode(update.argument) ||
          update.argument.type !== "Identifier"
        )
          return null;
        const name = getName(update.argument);
        const resolved = name
          ? analysis.bindings.resolve(name, update.argument, getAncestors(context, node))
          : null;
        return resolved?.id ?? null;
      }
      if (node.type !== "AssignmentExpression") return null;
      const assignment = node as ESTree.AssignmentExpression;
      if (
        assignment.operator !== "+=" ||
        !isNode(assignment.left) ||
        assignment.left.type !== "Identifier"
      )
        return null;
      const value = assignment.right as { type?: string; value?: unknown };
      if (value.type !== "Literal" || value.value !== 1) return null;
      const name = getName(assignment.left);
      const resolved = name
        ? analysis.bindings.resolve(name, assignment.left, getAncestors(context, node))
        : null;
      return resolved?.id ?? null;
    }

    function counterDeclaration(id: number, file: FileAnalysis): ESTree.VariableDeclarator | null {
      const declarators = file.bindingReferences.declaratorsFor(id);
      const declaration = declarators[declarators.length - 1];
      if (!declaration) return null;
      const init = declaration.init as { type?: string; value?: unknown } | null;
      return init && init.type === "Literal" && typeof init.value === "number" ? declaration : null;
    }

    function counterHasOnlyAllowedUses(
      id: number,
      loop: ESTree.Node,
      allowedUpdates: ReadonlySet<ESTree.Node>,
      file: FileAnalysis,
    ): boolean {
      const end = nodeEnd(loop);
      // The fallback keeps `loopEnd >= loopStart`, so a reference before the
      // loop is also `<= loopEnd`: one comparison rejects both.
      const loopEnd = end >= 0 ? end : nodeStart(loop);
      for (const { node, parent, start } of file.bindingReferences.referencesFor(id)) {
        if (parent && allowedUpdates.has(parent)) continue;
        if (start <= loopEnd) return false;
        const writesAfter =
          (parent?.type === "UpdateExpression" &&
            (parent as ESTree.UpdateExpression).argument === node) ||
          (parent?.type === "AssignmentExpression" &&
            (parent as ESTree.AssignmentExpression).left === node);
        if (writesAfter) return false;
      }
      return true;
    }
  },
});
