import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { staticPropertyName } from "../analysis/index.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";

export const noProxy = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `Proxy` and `Proxy.revocable` in Compatibility and ES5 ServiceNow scripts.",
      url: ruleDocsUrl("no-proxy"),
    },
    messages: {
      construct: "`Proxy` is not supported in Compatibility or ES5 Standards mode. Use a plain object.",
      revocable: "`Proxy.revocable()` is not supported in Compatibility or ES5 Standards mode.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "proxy")) return false;
      },
      NewExpression(node) {
        const { analysis } = beginRuleFile(context);
        const callee = (node as ESTree.NewExpression).callee as ESTree.Node;
        if (getName(callee) !== "Proxy") return;
        if (!analysis.isPlatformGlobal(callee)) return;
        context.report({ node, messageId: "construct" });
      },
      CallExpression(node) {
        const { analysis } = beginRuleFile(context);
        const callee = (node as ESTree.CallExpression).callee;
        if (callee.type !== "MemberExpression") return;
        const member = callee as ESTree.MemberExpression;
        if (getName(member.object) !== "Proxy") return;
        if (!analysis.isPlatformGlobal(member.object as ESTree.Node)) return;
        if (staticPropertyName(member) !== "revocable") return;
        context.report({ node, messageId: "revocable" });
      },
    };
  },
});
