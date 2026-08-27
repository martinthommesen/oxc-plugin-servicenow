import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { findStablePlatformConstructorCalls } from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { isUnsupportedGlobalInvocationProtected } from "./unsupported-constructor-rule.js";

const NAMES = ["BigInt"] as const;

export const noBigint = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow BigInt literals and the BigInt constructor in Compatibility and ES5 ServiceNow scripts.",
      url: ruleDocsUrl("no-bigint"),
    },
    messages: {
      literal:
        "BigInt literals (`{{raw}}`) are not supported in Compatibility or ES5 Standards mode. Use Number or String.",
      ctor: "`BigInt` is not supported in Compatibility or ES5 Standards mode. Use Number or String.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "bigint")) return false;
      },
      Literal(node) {
        const literal = node as { bigint?: string | null; raw?: string | null };
        if (literal.bigint != null) {
          context.report({
            node,
            messageId: "literal",
            data: { raw: literal.raw ?? `${literal.bigint}n` },
          });
        }
      },
      Program(node) {
        const { analysis, file } = beginRuleFile(context);
        for (const finding of findStablePlatformConstructorCalls({
          program: node as ESTree.Node,
          analysis,
          bindingWrites: file.bindingWrites,
          mutations: file.mutations,
          names: NAMES,
          namespaces: ["globalThis"],
          mutationSemantics: "callable",
        })) {
          if (isUnsupportedGlobalInvocationProtected(context, finding)) continue;
          context.report({ node: finding.node, messageId: "ctor" });
        }
      },
    };
  },
});
