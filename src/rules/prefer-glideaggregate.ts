import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { staticPropertyName } from "../analysis/index.js";
import { isServerInstanceContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

interface GrBinding {
  counted: boolean;
  iterated: boolean;
  onlyIncremented: boolean;
  countNode: ESTree.Node | null;
}

function emptyBinding(): GrBinding {
  return { counted: false, iterated: false, onlyIncremented: false, countNode: null };
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
    let bindings: Map<string, GrBinding>;

    return {
      before() {
        bindings = new Map();
        if (!isServerInstanceContext(beginRuleFile(context).context)) return false;
      },
      VariableDeclarator(node) {
        const { analysis } = beginRuleFile(context);
        const decl = node as ESTree.VariableDeclarator;
        const name = getName(decl.id);
        if (!name || !decl.init) return;
        const proven = analysis.ofExpression(decl.init);
        if (proven?.kind === "GlideRecord" && !proven.invalid) {
          bindings.set(name, emptyBinding());
        }
      },
      AssignmentExpression(node) {
        const { analysis } = beginRuleFile(context);
        const assign = node as ESTree.AssignmentExpression;
        const name = getName(assign.left);
        if (!name) return;
        const proven = analysis.ofExpression(assign.right);
        if (proven?.kind === "GlideRecord" && !proven.invalid) {
          bindings.set(name, emptyBinding());
        } else if (name && bindings.has(name)) {
          bindings.delete(name);
        }
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        const member = call.callee as ESTree.MemberExpression;
        const object = getName(member.object);
        const property = staticPropertyName(member);
        if (!object || !property) return;
        const binding = bindings.get(object);
        if (!binding) return;

        if (property === "getRowCount") {
          binding.counted = true;
          binding.countNode = node;
          context.report({
            node,
            messageId: "getRowCount",
            data: { name: object },
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
      const callee = (test as ESTree.CallExpression).callee;
      if (callee.type !== "MemberExpression") return;
      const object = getName((callee as ESTree.MemberExpression).object);
      const property = staticPropertyName(callee);
      if (!object || property !== "next") return;
      const binding = bindings.get(object);
      if (!binding) return;

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
