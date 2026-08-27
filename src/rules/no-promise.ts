import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { PROMISE_STATIC_METHODS, ruleDocsUrl } from "../constants.js";
import {
  findStablePlatformConstructorCalls,
  findStablePlatformStaticMethodCalls,
} from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { isUnsupportedGlobalInvocationProtected } from "./unsupported-constructor-rule.js";

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
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "promise")) return false;
      },
      Program(node) {
        const { analysis, file } = beginRuleFile(context);
        const constructors = findStablePlatformConstructorCalls({
          program: node as ESTree.Node,
          analysis,
          bindingWrites: file.bindingWrites,
          mutations: file.mutations,
          names: NAMES,
          namespaces: ["globalThis"],
          mutationSemantics: "callable",
        })
          .filter(
            (finding): finding is typeof finding & { node: ESTree.NewExpression } =>
              finding.node.type === "NewExpression",
          )
          .map((finding) => ({ ...finding, kind: "construct" as const }));
        const staticMethods = findStablePlatformStaticMethodCalls({
          program: node as ESTree.Node,
          analysis,
          bindingWrites: file.bindingWrites,
          mutations: file.mutations,
          methods: STATIC,
          namespaces: ["globalThis"],
          mutationSemantics: "callable",
        }).map((finding) => ({ ...finding, kind: "staticMethod" as const }));
        const findings = [...constructors, ...staticMethods].sort(
          (left, right) => (left.node.start ?? 0) - (right.node.start ?? 0),
        );
        for (const finding of findings) {
          if (isUnsupportedGlobalInvocationProtected(context, finding)) {
            continue;
          }
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
