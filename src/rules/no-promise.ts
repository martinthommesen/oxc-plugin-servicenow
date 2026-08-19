import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { PROMISE_STATIC_METHODS, ruleDocsUrl } from "../constants.js";
import { getName, memberName, propertyName } from "../utils/ast.js";
import { usesClassicEngine } from "../utils/filenames.js";

const STATIC = new Set<string>(PROMISE_STATIC_METHODS);

export const noPromise = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Promise usage in classic ServiceNow scripts. The legacy engine does not implement Promises.",
      recommended: "recommended",
      url: ruleDocsUrl("no-promise"),
    },
    messages: {
      construct:
        "Promises are not supported in the classic ServiceNow JavaScript engine. Use synchronous Glide APIs, or mark the file `@sn-es-latest` / `$meta.useEsLatest` if this script runs on ES latest.",
      staticMethod:
        "`Promise.{{method}}()` is not supported in the classic ServiceNow JavaScript engine.",
      thenable:
        "`.{{method}}()` looks like a Promise chain. Classic ServiceNow scripts must stay synchronous.",
    },
  },
  createOnce(context) {
    let active = false;

    return {
      before() {
        active = usesClassicEngine(context);
        if (!active) return false;
      },
      NewExpression(node) {
        if (!active) return;
        if (getName((node as ESTree.NewExpression).callee) === "Promise") {
          context.report({ node, messageId: "construct" });
        }
      },
      CallExpression(node) {
        if (!active) return;
        const callee = (node as ESTree.CallExpression).callee;
        const member = memberName(callee);
        const prop = propertyName(callee);

        if (member?.object === "Promise" && STATIC.has(member.property)) {
          context.report({ node, messageId: "staticMethod", data: { method: member.property } });
          return;
        }

        if (prop === "then" || prop === "catch" || prop === "finally") {
          context.report({ node, messageId: "thenable", data: { method: prop } });
        }
      },
    };
  },
});
