import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findAclQueries } from "../analysis/acl-query.js";
import { appliesOnSurface } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

export const noGliderecordQueryInAcl = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Review proven GlideRecord, GlideRecordSecure, and GlideAggregate query executions in ACL scripts. ServiceNow advises limiting GlideRecord queries in access control scripts because they can affect performance.",
      url: ruleDocsUrl("no-gliderecord-query-in-acl"),
    },
    messages: {
      query:
        "`{{name}}.{{method}}()` executes a {{kind}} database query during ACL evaluation. ServiceNow advises limiting these queries because they can affect performance; prefer roles, conditions, or already-loaded record fields when they express the same decision.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!appliesOnSurface(script, "acl", "filename")) return false;
      },
      Program(node) {
        const { analysis, file } = beginRuleFile(context);
        for (const finding of findAclQueries(node as ESTree.Node, analysis, file)) {
          context.report({
            node: finding.node,
            messageId: "query",
            data: {
              name: finding.name,
              method: finding.method,
              kind: finding.kind,
            },
          });
        }
      },
    };
  },
});
