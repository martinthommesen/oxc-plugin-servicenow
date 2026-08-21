import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl, TYPED_ARRAY_CTORS } from "../constants.js";
import { getName } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";

const ALL = new Set<string>(TYPED_ARRAY_CTORS);
const BIGINT_ARRAYS = new Set(["BigInt64Array", "BigUint64Array"]);

export const noTypedArrays = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow TypedArray constructors that the configured ServiceNow JavaScript mode does not support.",
      url: ruleDocsUrl("no-typed-arrays"),
    },
    messages: {
      ctor: "`{{name}}` is not supported in Compatibility or ES5 Standards mode. Use a plain Array or a string of bytes.",
      bigintCtor:
        "`{{name}}` is not supported in ServiceNow instance scripts, including ES2021 mode. Use a plain Array.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        const es5 = shouldDiagnoseFeature(script, "typed-arrays");
        const bigint = shouldDiagnoseFeature(script, "bigint64-arrays");
        if (!es5 && !bigint) return false;
      },
      NewExpression: check,
      CallExpression: check,
    };

    function check(node: ESTree.NewExpression | ESTree.CallExpression) {
      const { analysis, context: script } = beginRuleFile(context);
      const callee = node.callee as ESTree.Node;
      const name = getName(callee);
      if (!name || !ALL.has(name)) return;
      if (!analysis.isPlatformGlobal(callee)) return;
      if (BIGINT_ARRAYS.has(name) && shouldDiagnoseFeature(script, "bigint64-arrays")) {
        context.report({ node, messageId: "bigintCtor", data: { name } });
        return;
      }
      if (shouldDiagnoseFeature(script, "typed-arrays")) {
        context.report({ node, messageId: "ctor", data: { name } });
      }
    }
  },
});
