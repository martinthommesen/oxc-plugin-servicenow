import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import {
  findStablePlatformConstructorCalls,
  findStablePlatformStaticMethodCalls,
} from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { isUnsupportedGlobalInvocationProtected } from "./unsupported-constructor-rule.js";

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
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "proxy")) return false;
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
        const revocable = findStablePlatformStaticMethodCalls({
          program: node as ESTree.Node,
          analysis,
          bindingWrites: file.bindingWrites,
          mutations: file.mutations,
          methods: STATIC,
          namespaces: ["globalThis"],
          mutationSemantics: "callable",
        }).map((finding) => ({ ...finding, kind: "revocable" as const }));
        const findings = [...constructors, ...revocable].sort(
          (left, right) => (left.node.start ?? 0) - (right.node.start ?? 0),
        );
        for (const finding of findings) {
          if (isUnsupportedGlobalInvocationProtected(context, finding)) {
            continue;
          }
          context.report({ node: finding.node, messageId: finding.kind });
        }
      },
    };
  },
});
