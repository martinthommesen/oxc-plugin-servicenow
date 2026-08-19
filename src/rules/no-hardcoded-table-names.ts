import { defineRule } from "@oxlint/plugins";
import type { Context, ESTree } from "@oxlint/plugins";
import { BUILTIN_TABLES, GLIDE_RECORD_CTORS, ruleDocsUrl } from "../constants.js";
import { getStringValue, isNewNamed } from "../utils/ast.js";
import { getSettings, optionAt } from "../utils/settings.js";

export interface NoHardcodedTableNamesOptions {
  allowedTables?: string[];
  allowBuiltins?: boolean;
}

function allowed(context: Context, options: NoHardcodedTableNamesOptions): Set<string> {
  const settings = getSettings(context);
  const names = [...(settings.allowedTables ?? []), ...(options.allowedTables ?? [])];
  if (options.allowBuiltins) names.push(...BUILTIN_TABLES);
  return new Set(names);
}

export const noHardcodedTableNames = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow string-literal table names in GlideRecord / GlideRecordSecure / GlideAggregate constructors. Prefer named constants.",
      recommended: "strict",
      url: ruleDocsUrl("no-hardcoded-table-names"),
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          allowedTables: { type: "array", items: { type: "string" } },
          allowBuiltins: { type: "boolean" },
        },
      },
    ],
    messages: {
      literal:
        "Hardcoded table name '{{table}}'. Use a named constant (or generated table export from Fluent) so renames stay type-safe.",
    },
  },
  createOnce(context) {
    let allow: Set<string>;

    return {
      before() {
        allow = allowed(context, optionAt<NoHardcodedTableNamesOptions>(context, 0, {}));
      },
      NewExpression(node) {
        if (
          !GLIDE_RECORD_CTORS.some((ctor) => isNewNamed(node, ctor)) &&
          !isNewNamed(node, "GlideAggregate")
        ) {
          return;
        }
        const first = (node as ESTree.NewExpression).arguments[0];
        if (!first || first.type === "SpreadElement") return;
        const table = getStringValue(first);
        if (!table || allow.has(table)) return;
        context.report({
          node: first as ESTree.Node,
          messageId: "literal",
          data: { table },
        });
      },
    };
  },
});
