import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { FLUENT_LARGE_CONTENT_KEYS, ruleDocsUrl } from "../constants.js";
import { getStringValue, isNowIncludeCall, propertyKeyName } from "../utils/ast.js";
import { isFluentFile } from "../utils/filenames.js";
import { optionAt } from "../utils/settings.js";

export interface PreferNowIncludeOptions {
  maxLines?: number;
  maxChars?: number;
}

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
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          maxLines: { type: "integer", minimum: 1 },
          maxChars: { type: "integer", minimum: 1 },
        },
      },
    ],
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
        if (!isFluentFile(context.filename)) return false;
        const options = optionAt<PreferNowIncludeOptions>(context, 0, {});
        maxLines = options.maxLines ?? 8;
        maxChars = options.maxChars ?? 400;
      },
      Property(node) {
        const prop = node as unknown as ESTree.ObjectProperty;
        const key = propertyKeyName(prop);
        if (!key || !FLUENT_LARGE_CONTENT_KEYS.has(key)) return;
        if (isNowIncludeCall(prop.value)) return;
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
