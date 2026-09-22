import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { PROMISE_STATIC_METHODS, ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { findUnprotectedGlobalInvocations } from "./unsupported-constructor-rule.js";

const NAMES = ["Promise"] as const;
const STATIC = { Promise: PROMISE_STATIC_METHODS } as const;

export const noPromise = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Promise usage in Compatibility and ES5 ServiceNow scripts. ES2021 instance scripts support Promise.",
      url: ruleDocsUrl("no-promise"),
    },
    messages: {
      construct:
        "Promises are not supported in Compatibility or ES5 Standards mode. Use synchronous Glide APIs, or set `settings.servicenow.javascriptMode` to `es2021` when the script runs in that mode.",
      staticMethod:
        "`Promise.{{method}}()` is not supported in Compatibility or ES5 Standards mode. Use synchronous Glide APIs, or set `settings.servicenow.javascriptMode` to `es2021` when the script runs in that mode.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "promise")) return false;
        return undefined;
      },
      Program(node) {
        for (const finding of findUnprotectedGlobalInvocations(context, node as ESTree.Node, {
          names: NAMES,
          constructorForm: "new",
          staticMethods: STATIC,
        })) {
          if (finding.kind === "construct") {
            context.report({ node: finding.node, messageId: "construct" });
          } else {
            context.report({
              node: finding.node,
              messageId: "staticMethod",
              data: { method: finding.method },
            });
          }
        }
      },
    };
  },
});
