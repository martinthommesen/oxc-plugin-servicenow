import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { usesClassicEngine } from "../utils/filenames.js";

export const noBigint = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow BigInt literals and the BigInt constructor in classic ServiceNow scripts.",
      recommended: "recommended",
      url: ruleDocsUrl("no-bigint"),
    },
    messages: {
      literal: "BigInt literals (`{{raw}}`) are not supported in the classic ServiceNow JavaScript engine.",
      ctor: "`BigInt` is not supported in the classic ServiceNow JavaScript engine. Use Number or String.",
    },
  },
  createOnce(context) {
    let active = false;

    return {
      before() {
        active = usesClassicEngine(context);
        if (!active) return false;
      },
      Literal(node) {
        if (!active) return;
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
        if (!active) return;
        if (getName((node as ESTree.CallExpression).callee) === "BigInt") {
          context.report({ node, messageId: "ctor" });
        }
      },
      NewExpression(node) {
        if (!active) return;
        if (getName((node as ESTree.NewExpression).callee) === "BigInt") {
          context.report({ node, messageId: "ctor" });
        }
      },
    };
  },
});
