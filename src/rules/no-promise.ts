import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { PROMISE_STATIC_METHODS, ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { staticPropertyName } from "../analysis/internal.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature } from "../engine/index.js";

const STATIC = new Set<string>(PROMISE_STATIC_METHODS);

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
      NewExpression(node) {
        const { analysis } = beginRuleFile(context);
        const callee = (node as ESTree.NewExpression).callee as ESTree.Node;
        if (getName(callee) !== "Promise") return;
        if (!analysis.isPlatformGlobal(callee)) return;
        context.report({ node, messageId: "construct" });
      },
      CallExpression(node) {
        const { analysis } = beginRuleFile(context);
        const callee = (node as ESTree.CallExpression).callee;
        if (callee.type !== "MemberExpression") return;
        const member = callee as ESTree.MemberExpression;
        if (getName(member.object) !== "Promise") return;
        if (!analysis.isPlatformGlobal(member.object as ESTree.Node)) return;
        const method = staticPropertyName(member);
        if (!method || !STATIC.has(method)) return;
        context.report({ node, messageId: "staticMethod", data: { method } });
      },
    };
  },
});
