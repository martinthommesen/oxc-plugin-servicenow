import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { findUnprotectedGlobalInvocations } from "./unsupported-constructor-rule.js";

const NAMES = ["Proxy"] as const;
const STATIC = { Proxy: ["revocable"] } as const;

export const noProxy = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `Proxy` and `Proxy.revocable` in Compatibility and ES5 ServiceNow scripts.",
      url: ruleDocsUrl("no-proxy"),
    },
    messages: {
      construct:
        "`Proxy` is not supported in Compatibility or ES5 Standards mode. Use a plain object.",
      revocable:
        "`Proxy.revocable()` is not supported in Compatibility or ES5 Standards mode. Use a plain object.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "proxy")) return false;
        return undefined;
      },
      Program(node) {
        for (const finding of findUnprotectedGlobalInvocations(context, node as ESTree.Node, {
          names: NAMES,
          constructorForm: "new",
          staticMethods: STATIC,
        })) {
          context.report({
            node: finding.node,
            messageId: finding.kind === "construct" ? "construct" : "revocable",
          });
        }
      },
    };
  },
});
