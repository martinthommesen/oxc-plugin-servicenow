import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";

const CTORS = new Set(["WeakRef", "FinalizationRegistry"]);

export const noWeakReferences = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow WeakRef and FinalizationRegistry in instance-executed ServiceNow scripts. Both remain disallowed in ES2021.",
      url: ruleDocsUrl("no-weak-references"),
    },
    messages: {
      weak: "`{{name}}` is disallowed on the ServiceNow JavaScript engine, including ES2021 mode. Use `Map` / `Set` only when those types are supported by the script mode.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (
          !shouldDiagnoseFeature(script, "weak-ref") &&
          !shouldDiagnoseFeature(script, "finalization-registry")
        ) {
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
