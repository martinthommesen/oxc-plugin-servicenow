import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";

const CTORS = new Set(["WeakMap", "WeakSet"]);

export const noWeakCollections = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow WeakMap and WeakSet in Compatibility and ES5 ServiceNow scripts. ES2021 supports both.",
      url: ruleDocsUrl("no-weak-collections"),
    },
    messages: {
      weak: "`{{name}}` is not supported in Compatibility or ES5 Standards mode. Use `Map` or `Set`.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "weak-map") && !shouldDiagnoseFeature(script, "weak-set")) {
          return false;
        }
      },
      NewExpression: check,
      CallExpression: check,
    };

    function check(node: ESTree.NewExpression | ESTree.CallExpression) {
      const { analysis } = beginRuleFile(context);
      const callee = node.callee as ESTree.Node;
      const name = getName(callee);
      if (!name || !CTORS.has(name)) return;
      if (!analysis.isPlatformGlobal(callee)) return;
      context.report({ node, messageId: "weak", data: { name } });
    }
  },
});
