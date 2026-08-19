import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findNowIdMisuses } from "../analysis/index.js";
import { isFluentContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const noNowIdAsReference = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Use `Now.ID[...]` only as a Fluent `$id`. Same-app references should use the factory object; external records should use `Now.ref()`. Evidence: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html",
      url: ruleDocsUrl("no-now-id-as-reference"),
    },
    messages: {
      asReference:
        "`Now.ID` defines a metadata identity. Do not use it as a reference. Pass the factory object or `Now.ref()`.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
      },
      Program(node) {
        const { analysis } = beginRuleFile(context);
        for (const finding of findNowIdMisuses(node as ESTree.Node, analysis)) {
          context.report({ node: finding.node, messageId: "asReference" });
        }
      },
    };
  },
});
