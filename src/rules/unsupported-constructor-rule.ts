import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import type { EngineFeatureId } from "../engine/index.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { getName } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

interface UnsupportedConstructorRuleOptions {
  description: string;
  url: string;
  message: string;
  features: Readonly<Record<string, EngineFeatureId>>;
}

export function unsupportedConstructorRule(options: UnsupportedConstructorRuleOptions) {
  const names = new Set(Object.keys(options.features));
  return defineRule({
    meta: {
      type: "problem",
      docs: { description: options.description, url: options.url },
      messages: { weak: options.message },
    },
    createOnce(context) {
      return {
        before() {
          const { context: script } = beginRuleFile(context);
          if (![...names].some((name) => shouldDiagnoseFeature(script, options.features[name]!)))
            return false;
        },
        NewExpression: check,
        CallExpression: check,
      };

      function check(node: ESTree.NewExpression | ESTree.CallExpression) {
        const { analysis } = beginRuleFile(context);
        const callee = node.callee as ESTree.Node;
        const name = getName(callee);
        if (!name || !names.has(name) || !analysis.isPlatformGlobal(callee)) return;
        context.report({ node, messageId: "weak", data: { name } });
      }
    },
  });
}
