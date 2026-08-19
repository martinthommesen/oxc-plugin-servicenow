import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { FLUENT_ENTITIES_REQUIRING_ID, ruleDocsUrl } from "../constants.js";
import { getName, getStringValue, isNowIdAccess, objectProperty, objectPropertyValue } from "../utils/ast.js";
import { isFluentFile } from "../utils/filenames.js";
import { isSysId } from "../utils/sysid.js";

export interface RequireFluentIdOptions {
  preferNowId?: boolean;
}

export const requireFluentId = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Fluent entities to declare `$id`, preferably via `Now.ID['descriptive-key']`.",
      recommended: "recommended",
      url: ruleDocsUrl("require-fluent-id"),
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          preferNowId: { type: "boolean" },
        },
      },
    ],
    hasSuggestions: true,
    messages: {
      missing:
        "`{{api}}()` is missing `$id`. Fluent uses `$id` to track the record in `keys.ts` across syncs. Add `$id: Now.ID['{{hint}}']`.",
      preferNowId:
        "Prefer `$id: Now.ID['descriptive-key']` over a raw {{kind}}. Named IDs survive export / import and stay readable in diffs.",
      rawSysId:
        "Do not put a hardcoded sys_id in `$id`. Use `Now.ID['descriptive-key']` and let the SDK own the mapping.",
    },
  },
  createOnce(context) {
    let preferNowId: boolean;

    return {
      before() {
        if (!isFluentFile(context.filename)) return false;
        preferNowId = (context.options[0] as RequireFluentIdOptions | undefined)?.preferNowId !== false;
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        const api = getName(call.callee);
        if (!api || !FLUENT_ENTITIES_REQUIRING_ID.has(api)) return;
        const arg = call.arguments[0];
        if (!arg || arg.type !== "ObjectExpression") return;

        const idProp = objectProperty(arg, "$id");
        if (!idProp) {
          context.report({
            node: call.callee as unknown as ESTree.Node,
            messageId: "missing",
            data: { api, hint: hintFrom(arg, api) },
          });
          return;
        }

        const value = idProp.value as ESTree.Node;
        const literal = getStringValue(value);
        if (literal && isSysId(literal)) {
          context.report({ node: value, messageId: "rawSysId" });
          return;
        }

        if (!preferNowId) return;
        if (isNowIdAccess(value)) return;

        const kind = literal != null ? "string" : value.type === "Literal" ? "literal" : "value";
        context.report({
          node: value,
          messageId: "preferNowId",
          data: { kind },
        });
      },
    };
  },
});

function hintFrom(arg: ESTree.Node, api: string): string {
  const name = objectPropertyValue(arg, "name");
  const named = name ? getStringValue(name) : null;
  if (named) return kebab(named);
  return kebab(api);
}

function kebab(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}
