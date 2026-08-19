import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, memberName } from "../utils/ast.js";
import { usesClassicEngine } from "../utils/filenames.js";

export const noProxy = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `Proxy` and `Proxy.revocable` in classic ServiceNow scripts.",
      recommended: "recommended",
      url: ruleDocsUrl("no-proxy"),
    },
    messages: {
      construct:
        "`Proxy` is not supported in the classic ServiceNow JavaScript engine. Use a plain object.",
      revocable:
        "`Proxy.revocable()` is not supported in the classic ServiceNow JavaScript engine.",
    },
  },
  createOnce(context) {
    return {
      before() {
        if (!usesClassicEngine(context)) return false;
      },
      NewExpression(node) {
        if (getName((node as ESTree.NewExpression).callee) === "Proxy") {
          context.report({ node, messageId: "construct" });
        }
      },
      CallExpression(node) {
        const member = memberName((node as ESTree.CallExpression).callee);
        if (member?.object === "Proxy" && member.property === "revocable") {
          context.report({ node, messageId: "revocable" });
        }
      },
    };
  },
});
