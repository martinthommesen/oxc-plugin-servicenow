import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
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
      const statements =
        body.type === "BlockStatement" ? (body as ESTree.BlockStatement).body : [body];
      const meaningful = statements.filter((stmt) => stmt.type !== "EmptyStatement");
      const onlyIncremented =
        meaningful.length === 0 ||
        meaningful.every((stmt) => {
          if (stmt.type === "ExpressionStatement") {
            return isIncrement((stmt as ESTree.ExpressionStatement).expression as ESTree.Node);
          }
          return false;
        });
      if (onlyIncremented) {
        binding.onlyIncremented = true;
        binding.countNode = node;
      }
    }
  },
});
