import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { declaredName, getName, isNewNamed, memberName } from "../utils/ast.js";

interface GrBinding {
  counted: boolean;
  iterated: boolean;
  onlyIncremented: boolean;
  countNode: ESTree.Node | null;
}

function emptyBinding(): GrBinding {
  return { counted: false, iterated: false, onlyIncremented: true, countNode: null };
}

function isIncrement(node: ESTree.Node): boolean {
  if (node.type === "UpdateExpression") return true;
  if (node.type === "AssignmentExpression") {
    const op = (node as ESTree.AssignmentExpression).operator;
    return op === "+=";
  }
  return false;
}

export const preferGlideaggregate = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer GlideAggregate for counting records instead of GlideRecord.getRowCount() or iterate-to-count loops.",
      recommended: "recommended",
      url: ruleDocsUrl("prefer-glideaggregate"),
    },
    hasSuggestions: true,
    messages: {
      getRowCount:
        "`{{name}}.getRowCount()` loads every matching row. Use `GlideAggregate` with `addAggregate('COUNT')` instead.",
      iterateCount:
        "`{{name}}` is only iterated to count rows. Use `GlideAggregate` — it is dramatically faster on large tables.",
    },
  },
  createOnce(context) {
    let bindings: Map<string, GrBinding>;

    return {
      before() {
        bindings = new Map();
      },
      VariableDeclarator(node) {
        const decl = node as ESTree.VariableDeclarator;
        const name = declaredName(decl);
        if (name && decl.init && isNewNamed(decl.init, "GlideRecord")) {
          bindings.set(name, emptyBinding());
        }
      },
      AssignmentExpression(node) {
        const assign = node as ESTree.AssignmentExpression;
        const name = getName(assign.left);
        if (name && isNewNamed(assign.right, "GlideRecord")) {
          bindings.set(name, emptyBinding());
        }
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        const member = memberName(call.callee);
        if (!member) return;
        const binding = bindings.get(member.object);
        if (!binding) return;

        if (member.property === "getRowCount") {
          binding.counted = true;
          binding.countNode = node;
          context.report({
            node,
            messageId: "getRowCount",
            data: { name: member.object },
            suggest: [
              {
                desc: `Replace with GlideAggregate COUNT on ${member.object}`,
                fix(fixer) {
                  return fixer.replaceText(
                    node,
                    `(function () { var __ga = new GlideAggregate(${member.object}.getTableName ? ${member.object}.getTableName() : '/* table */'); __ga.addAggregate('COUNT'); __ga.query(); return __ga.next() ? parseInt(__ga.getAggregate('COUNT'), 10) : 0; })()`,
                  );
                },
              },
            ],
          });
        }

        if (member.property === "next") {
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
        for (const [name, binding] of bindings) {
          if (binding.iterated && binding.onlyIncremented && !binding.counted) {
            context.report({
              node: binding.countNode ?? (context.sourceCode.ast as unknown as ESTree.Node),
              messageId: "iterateCount",
              data: { name },
            });
          }
        }
      },
    };

    function checkLoopBody(node: ESTree.WhileStatement | ESTree.ForStatement) {
      const test = node.test;
      if (!test || test.type !== "CallExpression") return;
      const member = memberName((test as ESTree.CallExpression).callee);
      if (!member || member.property !== "next") return;
      const binding = bindings.get(member.object);
      if (!binding) return;

      const body = node.body;
      const statements =
        body.type === "BlockStatement" ? (body as ESTree.BlockStatement).body : [body];
      const meaningful = statements.filter((stmt) => stmt.type !== "EmptyStatement");
      if (meaningful.length === 0) {
        binding.onlyIncremented = true;
        return;
      }
      binding.onlyIncremented = meaningful.every((stmt) => {
        if (stmt.type === "ExpressionStatement") {
          return isIncrement((stmt as ESTree.ExpressionStatement).expression as ESTree.Node);
        }
        return false;
      });
    }
  },
});
