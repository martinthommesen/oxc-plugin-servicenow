import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findObjectMethodConstructions } from "../analysis/internal.js";
import { ruleDocsUrl } from "../constants.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { beginRuleFile } from "./helpers.js";

export const noObjectMethodConstructor = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow constructing shorthand object methods that are not constructors in ServiceNow Australia.",
      url: ruleDocsUrl("no-object-method-constructor"),
    },
    messages: {
      notConstructor:
        "Object method `{{method}}` is not a constructor in ServiceNow Australia. Use a function-valued property or a class for constructible behavior.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (
          script.javascriptMode !== "es2021" ||
          !shouldDiagnoseFeature(script, "object-method-construction")
        ) {
          return false;
        }
      },
      Program(node) {
        const { analysis, file } = beginRuleFile(context);
        for (const finding of findObjectMethodConstructions(
          node as ESTree.Node,
          analysis.bindings,
          file.bindingWrites,
        )) {
          context.report({
            node: finding.node,
            messageId: "notConstructor",
            data: { method: finding.method },
          });
        }
      },
    };
  },
});
