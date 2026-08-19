import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, isNewNamed } from "../utils/ast.js";
import { classifyFromContext } from "../utils/filenames.js";

export const noClientGliderecord = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow GlideRecord in client scripts. Query on the server (GlideAjax, Scripted REST, or `g_form.getReference`).",
      recommended: "recommended",
      url: ruleDocsUrl("no-client-gliderecord"),
    },
    messages: {
      glideRecord:
        "Do not use `GlideRecord` in client scripts — it is slow, poorly supported, and often blocked. Call a Script Include via `GlideAjax`, a Scripted REST API, or use `g_form.getReference()`.",
    },
  },
  createOnce(context) {
    let active = false;

    return {
      before() {
        active = classifyFromContext(context) === "client";
        if (!active) return false;
      },
      NewExpression(node) {
        if (!active) return;
        if (isNewNamed(node, "GlideRecord") || isNewNamed(node, "GlideRecordSecure")) {
          context.report({ node, messageId: "glideRecord" });
        }
      },
      CallExpression(node) {
        if (!active) return;
        if (getName((node as ESTree.CallExpression).callee) === "GlideRecord") {
          context.report({ node, messageId: "glideRecord" });
        }
      },
    };
  },
});
