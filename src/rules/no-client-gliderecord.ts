import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { appliesOnSurface } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

const CTORS = ["GlideRecord", "GlideRecordSecure"] as const;

export const noClientGliderecord = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow platform GlideRecord in client scripts. Query on the server (GlideAjax, Scripted REST, or `g_form.getReference`).",
      url: ruleDocsUrl("no-client-gliderecord"),
    },
    messages: {
      glideRecord:
        "Do not use `GlideRecord` in client scripts — it is slow, poorly supported, and often blocked. Call a Script Include via `GlideAjax`, a Scripted REST API, or use `g_form.getReference()`.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!appliesOnSurface(script, "client")) return false;
      },
      NewExpression(node) {
        report((node as ESTree.NewExpression).callee as ESTree.Node, node);
      },
      CallExpression(node) {
        report((node as ESTree.CallExpression).callee as ESTree.Node, node);
      },
    };

    function report(callee: ESTree.Node, node: ESTree.Node) {
      const { analysis } = beginRuleFile(context);
      const name = getName(callee);
      if (!name || !CTORS.includes(name as (typeof CTORS)[number])) return;
      if (!analysis.isPlatformGlobal(callee)) return;
      context.report({ node, messageId: "glideRecord" });
    }
  },
});
