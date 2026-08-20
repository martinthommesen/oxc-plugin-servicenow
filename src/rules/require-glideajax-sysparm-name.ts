import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findGlideAjaxParamIssues } from "../analysis/index.js";
import { isClientCapableContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const requireGlideajaxSysparmName = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a non-empty `addParam(\"sysparm_name\", method)` before GlideAjax request calls. Extra static keys must use the `sysparm_` prefix. Evidence: https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html",
      url: ruleDocsUrl("require-glideajax-sysparm-name"),
    },
    messages: {
      missingName:
        "`{{name}}` starts a GlideAjax request without `addParam(\"sysparm_name\", ...)`. The Script Include method will not run.",
      emptyValue:
        "`{{name}}` sets `sysparm_name` to a missing, empty, or null method. Pass a non-empty Script Include method name.",
      badPrefix:
        "GlideAjax parameter `{{param}}` must start with `sysparm_`. Use `sysparm_{{param}}`.",
      afterTerminal:
        "`addParam()` after `getXML` / `getXMLAnswer` / `getXMLWait` does not affect that request.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isClientCapableContext(script)) return false;
      },
      Program(node) {
        const { analysis } = beginRuleFile(context);
        for (const finding of findGlideAjaxParamIssues(node as ESTree.Node, analysis)) {
          context.report({
            node: finding.node,
            messageId: finding.messageId,
            data: { name: finding.name, param: finding.param ?? "" },
          });
        }
      },
    };
  },
});
