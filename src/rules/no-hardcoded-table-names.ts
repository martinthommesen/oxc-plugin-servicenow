import { defineRule } from "@oxlint/plugins";
import type { Context, ESTree } from "@oxlint/plugins";
import { BUILTIN_TABLES, ruleDocsUrl } from "../constants.js";
import { getName, getStringValue } from "../utils/ast.js";
import { parseRuleOptions, noHardcodedTableNamesOptions, schemaFromDescriptor } from "../options/index.js";
import type { NoHardcodedTableNamesOptions } from "../options/index.js";
import { beginRuleFile } from "./helpers.js";

export type { NoHardcodedTableNamesOptions };

function allowed(context: Context, options: NoHardcodedTableNamesOptions): Set<string> {
  const { context: script } = beginRuleFile(context);
  const names = [...script.settings.allowedTables, ...(options.allowedTables ?? [])];
  if (options.allowBuiltins) names.push(...BUILTIN_TABLES);
  return new Set(names);
}

const CTORS = ["GlideRecord", "GlideRecordSecure", "GlideAggregate"] as const;

export const noHardcodedTableNames = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow string-literal table names in platform GlideRecord / GlideRecordSecure / GlideAggregate constructors. Prefer named constants.",
      url: ruleDocsUrl("no-hardcoded-table-names"),
    },
    schema: schemaFromDescriptor(noHardcodedTableNamesOptions),
    messages: {
      literal:
        "Hardcoded table name '{{table}}'. Use a named constant (or generated table export from Fluent) so renames stay type-safe.",
    },
  },
  createOnce(context) {
    let allow: Set<string>;

    return {
      before() {
        allow = allowed(context, parseRuleOptions(noHardcodedTableNamesOptions, context.options));
      },
      NewExpression(node) {
        const { analysis } = beginRuleFile(context);
        const callee = (node as ESTree.NewExpression).callee as ESTree.Node;
        const name = getName(callee);
        if (!name || !CTORS.includes(name as (typeof CTORS)[number])) return;
        if (!analysis.isPlatformGlobal(callee)) return;
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
