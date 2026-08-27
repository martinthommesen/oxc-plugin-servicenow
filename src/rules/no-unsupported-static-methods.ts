import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findStablePlatformStaticMethodCalls } from "../analysis/internal.js";
import { ruleDocsUrl } from "../constants.js";
import { shouldDiagnoseFeature, type EngineFeatureId } from "../engine/index.js";
import { beginRuleFile } from "./helpers.js";
import { isUnsupportedStaticMethodInvocationProtected } from "./unsupported-constructor-rule.js";

const METHODS = {
  Error: ["isError"],
  Promise: ["try", "withResolvers"],
} as const;

const FEATURE_BY_METHOD = new Map<string, EngineFeatureId>([
  ["Error\0isError", "error-iserror"],
  ["Promise\0try", "promise-try"],
  ["Promise\0withResolvers", "promise-withresolvers"],
]);

const FEATURE_IDS = [...FEATURE_BY_METHOD.values()];

function featureFor(owner: string, method: string): EngineFeatureId | null {
  return FEATURE_BY_METHOD.get(`${owner}\0${method}`) ?? null;
}

export const noUnsupportedStaticMethods = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow static JavaScript engine methods that the configured ServiceNow release and mode do not support.",
      url: ruleDocsUrl("no-unsupported-static-methods"),
    },
    messages: {
      unsupported:
        "`{{owner}}.{{method}}()` is not supported by the configured ServiceNow release and JavaScript mode.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!FEATURE_IDS.some((feature) => shouldDiagnoseFeature(script, feature))) return false;
      },
      Program(node) {
        const { analysis, context: script, file } = beginRuleFile(context);
        for (const finding of findStablePlatformStaticMethodCalls({
          program: node as ESTree.Node,
          analysis,
          bindingWrites: file.bindingWrites,
          mutations: file.mutations,
          methods: METHODS,
          namespaces: ["globalThis"],
          mutationSemantics: "callable",
        })) {
          // no-promise owns every Promise use in classic modes. Keeping the
          // release-specific methods here ES2021-only avoids duplicate profile
          // diagnostics without changing no-promise's standalone contract.
          if (finding.name === "Promise" && script.javascriptMode !== "es2021") continue;
          const feature = featureFor(finding.name, finding.method);
          if (!feature || !shouldDiagnoseFeature(script, feature)) continue;
          if (isUnsupportedStaticMethodInvocationProtected(context, finding)) continue;
          context.report({
            node: finding.node,
            messageId: "unsupported",
            data: { owner: finding.name, method: finding.method },
          });
        }
      },
    };
  },
});
