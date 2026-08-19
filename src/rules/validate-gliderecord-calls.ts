import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { GLIDE_MUTATING_METHODS, GLIDE_RECORD_CTORS, ruleDocsUrl } from "../constants.js";
import { declaredName, getName, isNewNamed, memberName } from "../utils/ast.js";

const CHECKED = new Set<string>(GLIDE_MUTATING_METHODS);
const OPENS = new Set(["query", "get", "getAsync", "chooseWindow"]);

interface GrState {
  opened: boolean;
}

function parentOf(
  context: { sourceCode: { getAncestors?: (node: ESTree.Node) => ESTree.Node[] } },
  node: ESTree.Node,
): ESTree.Node | undefined {
  const ancestors = context.sourceCode.getAncestors?.(node) as ESTree.Node[] | undefined;
  return ancestors?.[ancestors.length - 1];
}

export const validateGliderecordCalls = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require GlideRecord mutating / lookup methods to be queried first and their return values checked.",
      recommended: "recommended",
      url: ruleDocsUrl("validate-gliderecord-calls"),
    },
    messages: {
      unusedReturn:
        "The return value of `{{name}}.{{method}}()` is ignored. Check it so failed lookups, inserts, and updates are not silent.",
      missingQuery:
        "`{{name}}.next()` is called without a preceding `.query()` or `.get()`. The cursor will never move.",
    },
  },
  createOnce(context) {
    let bindings: Map<string, GrState>;

    return {
      before() {
        bindings = new Map();
      },
      VariableDeclarator(node) {
        const decl = node as ESTree.VariableDeclarator;
        const name = declaredName(decl);
        if (name && decl.init && GLIDE_RECORD_CTORS.some((ctor) => isNewNamed(decl.init, ctor))) {
          bindings.set(name, { opened: false });
        }
      },
      AssignmentExpression(node) {
        const assign = node as ESTree.AssignmentExpression;
        const name = getName(assign.left);
        if (name && GLIDE_RECORD_CTORS.some((ctor) => isNewNamed(assign.right, ctor))) {
          bindings.set(name, { opened: false });
        }
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        const member = memberName(call.callee);
        if (!member) return;
        const state = bindings.get(member.object);
        if (!state) return;

        if (OPENS.has(member.property)) {
          state.opened = true;
        }

        if (member.property === "next" && !state.opened) {
          context.report({
            node,
            messageId: "missingQuery",
            data: { name: member.object },
          });
        }

        if (!CHECKED.has(member.property)) return;

        const parent = parentOf(context as never, node);
        if (parent && parent.type === "ExpressionStatement") {
          context.report({
            node,
            messageId: "unusedReturn",
            data: { name: member.object, method: member.property },
          });
        }
      },
    };
  },
});
