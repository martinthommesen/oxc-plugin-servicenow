import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { FLUENT_LARGE_CONTENT_KEYS, ruleDocsUrl } from "../constants.js";
import { isCanonicalNowInclude } from "../analysis/internal.js";
import { getStringValue, propertyKeyName } from "../utils/ast.js";
import {
  parseRuleOptions,
  preferNowIncludeOptions,
  schemaFromDescriptor,
} from "../options/index.js";
import type { PreferNowIncludeOptions } from "../options/index.js";
import { isFluentContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

export type { PreferNowIncludeOptions };

function lineCount(value: string): number {
  return value.split(/\r?\n/).length;
}

export const preferNowInclude = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `Now.include()` (or an imported server module) for large Fluent script / markup fields.",
      recommended: "recommended",
      url: ruleDocsUrl("prefer-now-include"),
    },
    schema: schemaFromDescriptor(preferNowIncludeOptions),
    messages: {
      large:
        "This `{{key}}` payload is {{lines}} lines / {{chars}} chars. Move it to a `.js` / `.html` / `.css` file and load it with `Now.include('./file')` so Fluent stays declarative and the editor can syntax-highlight the payload.",
    },
  },
  createOnce(context) {
    let maxLines: number;
    let maxChars: number;

    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
        const options = parseRuleOptions(preferNowIncludeOptions, context.options);
        maxLines = options.maxLines;
        maxChars = options.maxChars;
      },
      Property(node) {
        const prop = node as unknown as ESTree.ObjectProperty;
        const key = propertyKeyName(prop);
        if (!key || !FLUENT_LARGE_CONTENT_KEYS.has(key)) return;
        const { analysis } = beginRuleFile(context);
        if (isCanonicalNowInclude(prop.value, analysis)) return;
        if (prop.value.type === "Identifier") return;

        const text = getStringValue(prop.value);
        if (text == null) return;
        const lines = lineCount(text);
        if (lines < maxLines && text.length < maxChars) return;

        context.report({
          node: prop.value as ESTree.Node,
          messageId: "large",
          data: { key, lines: String(lines), chars: String(text.length) },
        });
      },
    };
  },
});
