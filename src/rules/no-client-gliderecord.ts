import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { findStablePlatformConstructorCalls } from "../analysis/internal.js";
import { appliesOnSurface, isMixedUiActionContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

const CTORS = ["GlideRecord", "GlideRecordSecure"] as const;

export const noClientGliderecord = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow platform GlideRecord in scoped client scripts, where ServiceNow does not support the client API.",
      url: ruleDocsUrl("no-client-gliderecord"),
    },
    messages: {
      glideRecord:
        "Client GlideRecord is not supported in scoped applications. Query through a Script Include with `GlideAjax` or a Scripted REST API.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (
          script.scope !== "scoped" ||
          !appliesOnSurface(script, "client") ||
          isMixedUiActionContext(script)
        ) {
          return false;
        }
      },
      Program(node) {
        const { analysis, file } = beginRuleFile(context);
        for (const finding of findStablePlatformConstructorCalls({
          program: node as ESTree.Node,
          analysis,
          bindingWrites: file.bindingWrites,
          mutations: file.mutations,
          names: CTORS,
          namespaces: ["global"],
        })) {
          context.report({ node: finding.node, messageId: "glideRecord" });
        }
      },
    };
  },
});
