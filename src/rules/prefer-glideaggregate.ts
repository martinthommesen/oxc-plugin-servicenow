import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, isNode, isValueReference, nodeStart, walk } from "../utils/ast.js";
import { hasAuthoritativeGlideRecordMethod, staticPropertyName } from "../analysis/internal.js";
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
        if (!isServerInstanceContext(beginRuleFile(context).context)) return false;
      },
      CallExpression(node) {
        const { analysis, file } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        const member = call.callee as ESTree.MemberExpression;
        const property = staticPropertyName(member);
        if (property !== "getRowCount") return;
        const receiver = glideRecordReceiver(analysis, member.object);
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
      analysis: ReturnType<typeof beginRuleFile>["analysis"],
      node: unknown,
    ): { id: number; name: string } | null {
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
      return { id: proven.objectId, name: getName(node) ?? "record" };
    }

    function checkLoopBody(node: ESTree.WhileStatement | ESTree.ForStatement) {
      const { analysis, file } = beginRuleFile(context);
      const test = node.test;
      if (!test || test.type !== "CallExpression") return;
      const callee = (test as ESTree.CallExpression).callee;
      if (callee.type !== "MemberExpression") return;
      const property = staticPropertyName(callee);
      if (!property || !analysis.glide.cursorAdvancers.has(property)) return;
      const receiver = glideRecordReceiver(analysis, callee.object);
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
        const target = counterUpdateTarget(update, analysis);
        if (!target) return;
        if (counterId === undefined) counterId = target;
        if (counterId !== target) return;
      }
      if (counterId === undefined) return;
      const declaration = counterDeclaration(counterId, analysis);
      if (
        !declaration ||
        !counterHasOnlyAllowedUses(counterId, declaration, node, new Set(updates), analysis)
      )
        return;
      context.report({ node, messageId: "iterateCount", data: { name: receiver.name } });
    }

    function counterUpdateTarget(
      node: ESTree.Node,
      analysis: ReturnType<typeof beginRuleFile>["analysis"],
    ): number | null {
      if (node.type === "UpdateExpression") {
        const update = node as ESTree.UpdateExpression;
        if (
          update.operator !== "++" ||
          !isNode(update.argument) ||
          update.argument.type !== "Identifier"
        )
          return null;
        const name = getName(update.argument);
        const resolved = name ? analysis.bindings.resolve(name, update.argument) : null;
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
      const resolved = name ? analysis.bindings.resolve(name, assignment.left) : null;
      return resolved?.id ?? null;
    }

    function counterDeclaration(
      id: number,
      analysis: ReturnType<typeof beginRuleFile>["analysis"],
    ): ESTree.VariableDeclarator | null {
      let declaration: ESTree.Node | null = null;
      walk(context.sourceCode.ast as unknown as ESTree.Node, {
        VariableDeclarator(node) {
          const candidate = node as ESTree.VariableDeclarator;
          if (!isNode(candidate.id) || candidate.id.type !== "Identifier") return;
          const resolved = analysis.bindings.resolve(getName(candidate.id) ?? "", candidate.id);
          if (resolved?.id === id) declaration = candidate;
        },
      });
      if (!declaration) return null;
      const init = (declaration as ESTree.VariableDeclarator).init as {
        type?: string;
        value?: unknown;
      } | null;
      return init && init.type === "Literal" && typeof init.value === "number"
        ? (declaration as ESTree.VariableDeclarator)
        : null;
    }

    function counterHasOnlyAllowedUses(
      id: number,
      declaration: ESTree.VariableDeclarator,
      loop: ESTree.Node,
      allowedUpdates: ReadonlySet<ESTree.Node>,
      analysis: ReturnType<typeof beginRuleFile>["analysis"],
    ): boolean {
      let valid = true;
      const loopStart = nodeStart(loop);
      const loopEnd =
        (loop as { end?: number; range?: readonly number[] }).end ??
        (loop as { range?: readonly number[] }).range?.[1] ??
        loopStart;
      const ancestors: ESTree.Node[] = [];
      walk(
        context.sourceCode.ast as unknown as ESTree.Node,
        {
          Identifier(node) {
            if (!isValueReference(node, ancestors)) return;
            const name = getName(node);
            const resolved = name ? analysis.bindings.resolve(name, node, ancestors) : null;
            if (resolved?.id !== id) return;
            const parent = ancestors[ancestors.length - 2];
            const isDeclaration =
              parent?.type === "VariableDeclarator" &&
              (parent as ESTree.VariableDeclarator).id === node;
            if (isDeclaration && parent === declaration) return;
            if (parent && allowedUpdates.has(parent)) return;
            const position = nodeStart(node);
            if (position < loopStart || position <= loopEnd) {
              valid = false;
              return;
            }
            const writesAfter =
              (parent?.type === "UpdateExpression" &&
                (parent as ESTree.UpdateExpression).argument === node) ||
              (parent?.type === "AssignmentExpression" &&
                (parent as ESTree.AssignmentExpression).left === node);
            if (writesAfter) valid = false;
          },
        },
        ancestors,
      );
      return valid;
    }
  },
});
