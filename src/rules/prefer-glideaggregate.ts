import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, isNode, isValueReference, walk } from "../utils/ast.js";
import { staticPropertyName } from "../analysis/index.js";
import { isServerInstanceContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

interface GrBinding {
  name: string;
  counted: boolean;
  iterated: boolean;
  onlyIncremented: boolean;
  countNode: ESTree.Node | null;
}

function emptyBinding(name: string): GrBinding {
  return { name, counted: false, iterated: false, onlyIncremented: false, countNode: null };
}

function isIncrement(node: ESTree.Node): boolean {
  if (node.type === "UpdateExpression") return true;
  if (node.type === "AssignmentExpression") {
    return (node as ESTree.AssignmentExpression).operator === "+=";
  }
  return false;
}

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
        "`{{name}}` is only iterated to count rows. Use `GlideAggregate` — it is dramatically faster on large tables.",
    },
  },
  createOnce(context) {
    // Key state by the analysis ObjectId, not by identifier spelling. A
    // shadowed parameter and an outer alias may have the same name while
    // referring to different runtime cursors.
    let bindings: Map<number, GrBinding>;

    return {
      before() {
        bindings = new Map();
        if (!isServerInstanceContext(beginRuleFile(context).context)) return false;
      },
      VariableDeclarator(node) {
        const { analysis } = beginRuleFile(context);
        const decl = node as ESTree.VariableDeclarator;
        if (!decl.init) return;
        const receiver = glideRecordReceiver(analysis, decl.init);
        if (receiver) ensureBinding(receiver.id, receiver.name);
      },
      AssignmentExpression(node) {
        const { analysis } = beginRuleFile(context);
        const assign = node as ESTree.AssignmentExpression;
        const receiver = glideRecordReceiver(analysis, assign.right);
        if (receiver) ensureBinding(receiver.id, receiver.name);
      },
      CallExpression(node) {
        const { analysis } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        const member = call.callee as ESTree.MemberExpression;
        const property = staticPropertyName(member);
        if (!property) return;
        const receiver = glideRecordReceiver(analysis, member.object);
        if (!receiver) return;
        const binding = ensureBinding(receiver.id, receiver.name);

        if (property === "getRowCount") {
          binding.counted = true;
          binding.countNode = node;
          context.report({
            node,
            messageId: "getRowCount",
            data: { name: receiver.name },
          });
        }

        if (property === "next") {
          binding.iterated = true;
        }
      },
      WhileStatement(node) {
        checkLoopBody(node as ESTree.WhileStatement);
      },
      ForStatement(node) {
        checkLoopBody(node as ESTree.ForStatement);
      },
      after() {
        for (const binding of bindings.values()) {
          if (binding.iterated && binding.onlyIncremented && !binding.counted) {
            context.report({
              node: binding.countNode ?? (context.sourceCode.ast as unknown as ESTree.Node),
              messageId: "iterateCount",
              data: { name: binding.name },
            });
          }
        }
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

    function ensureBinding(id: number, name: string): GrBinding {
      const existing = bindings.get(id);
      if (existing) {
        if (existing.name === "record" && name !== "record") existing.name = name;
        return existing;
      }
      const created = emptyBinding(name);
      bindings.set(id, created);
      return created;
    }

    function checkLoopBody(node: ESTree.WhileStatement | ESTree.ForStatement) {
      const { analysis } = beginRuleFile(context);
      const test = node.test;
      if (!test || test.type !== "CallExpression") return;
      const callee = (test as ESTree.CallExpression).callee;
      if (callee.type !== "MemberExpression") return;
      if (staticPropertyName(callee) !== "next") return;
      const receiver = glideRecordReceiver(analysis, callee.object);
      if (!receiver) return;
      const binding = ensureBinding(receiver.id, receiver.name);

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
      if (counterId === undefined || !numericCounterDeclaration(counterId, analysis)) return;
      if (!counterHasOnlyAllowedUses(counterId, analysis)) return;
      binding.onlyIncremented = true;
      binding.countNode = node;
    }

    function counterUpdateTarget(node: ESTree.Node, analysis: ReturnType<typeof beginRuleFile>["analysis"]): number | null {
      if (node.type === "UpdateExpression") {
        const update = node as ESTree.UpdateExpression;
        if (update.operator !== "++" || !isNode(update.argument) || update.argument.type !== "Identifier") return null;
        const name = getName(update.argument);
        const resolved = name ? analysis.bindings.tree.resolve(name, update.argument) : null;
        return resolved?.id ?? null;
      }
      if (node.type !== "AssignmentExpression") return null;
      const assignment = node as ESTree.AssignmentExpression;
      if (assignment.operator !== "+=" || !isNode(assignment.left) || assignment.left.type !== "Identifier") return null;
      const value = assignment.right as { type?: string; value?: unknown };
      if (value.type !== "Literal" || value.value !== 1) return null;
      const name = getName(assignment.left);
      const resolved = name ? analysis.bindings.tree.resolve(name, assignment.left) : null;
      return resolved?.id ?? null;
    }

    function numericCounterDeclaration(id: number, analysis: ReturnType<typeof beginRuleFile>["analysis"]): boolean {
      for (const scope of analysis.bindings.tree.root ? [analysis.bindings.tree.root] : []) {
        const stack = [scope];
        while (stack.length > 0) {
          const current = stack.pop()!;
          const binding = [...current.bindings.values()].find((candidate) => candidate.id === id);
          if (binding) {
            if (binding.node.type !== "VariableDeclarator") return false;
            const init = (binding.node as ESTree.VariableDeclarator).init as { type?: string; value?: unknown } | null;
            return Boolean(init && init.type === "Literal" && typeof init.value === "number");
          }
          // ScopeTree does not expose children; declaration spans let the
          // fallback below resolve the binding and inspect its node.
        }
      }
      // Resolve through any reference carrying the binding identity when the
      // root-only traversal cannot see nested scope maps.
      let declaration: ESTree.Node | null = null;
      walk(context.sourceCode.ast as unknown as ESTree.Node, {
        VariableDeclarator(node) {
          const candidate = node as ESTree.VariableDeclarator;
          if (!isNode(candidate.id) || candidate.id.type !== "Identifier") return;
          const resolved = analysis.bindings.tree.resolve(getName(candidate.id) ?? "", candidate.id);
          if (resolved?.id === id) declaration = candidate;
        },
      });
      if (!declaration) return false;
      const init = (declaration as ESTree.VariableDeclarator).init as { type?: string; value?: unknown } | null;
      return Boolean(init && init.type === "Literal" && typeof init.value === "number");
    }

    function counterHasOnlyAllowedUses(id: number, analysis: ReturnType<typeof beginRuleFile>["analysis"]): boolean {
      let valid = true;
      const ancestors: ESTree.Node[] = [];
      walk(context.sourceCode.ast as unknown as ESTree.Node, {
        Identifier(node) {
          if (!isValueReference(node, ancestors)) return;
          const name = getName(node);
          const resolved = name ? analysis.bindings.tree.resolve(name, node, ancestors) : null;
          if (resolved?.id !== id) return;
          const parent = ancestors[ancestors.length - 2];
          const isDeclaration = parent?.type === "VariableDeclarator" &&
            (parent as ESTree.VariableDeclarator).id === node;
          const isUpdate = parent?.type === "UpdateExpression" &&
            (parent as ESTree.UpdateExpression).argument === node;
          const isAssignment = parent?.type === "AssignmentExpression" &&
            (parent as ESTree.AssignmentExpression).left === node;
          if (!isDeclaration && !isUpdate && !isAssignment) valid = false;
        },
      }, ancestors);
      return valid;
    }
  },
});
