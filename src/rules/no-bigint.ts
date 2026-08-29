import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";

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
      CallExpression(node) {
        reportCtor((node as ESTree.CallExpression).callee as ESTree.Node, node);
      },
      NewExpression(node) {
        reportCtor((node as ESTree.NewExpression).callee as ESTree.Node, node);
      },
    };

    function reportCtor(callee: ESTree.Node, node: ESTree.Node) {
      const { analysis } = beginRuleFile(context);
      if (getName(callee) !== "BigInt") return;
      if (!analysis.isPlatformGlobal(callee)) return;
      context.report({ node, messageId: "ctor" });
    }
  },
});
