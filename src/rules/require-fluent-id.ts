import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, getStringValue, isNowIdAccess, objectProperty, objectPropertyValue } from "../utils/ast.js";
import { apisByName } from "../fluent/index.js";
import { isFluentContext } from "../context/index.js";
import { objectOptionAt } from "../settings/index.js";
import { isSysId } from "../utils/sysid.js";
import { beginRuleFile } from "./helpers.js";

export interface RequireFluentIdOptions {
  preferNowId?: boolean;
}

export const requireFluentId = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Fluent entities to declare `$id` when the SDK manifest marks the API as requiring an id. Prefer `Now.ID['descriptive-key']`.",
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
    messages: {
      missing:
        "`{{api}}()` is missing `$id`. The Fluent SDK manifest requires `$id` for this API so `keys.ts` can track the record. Add `$id: Now.ID['{{hint}}']`.",
      preferNowId:
        "Prefer `$id: Now.ID['descriptive-key']` over a raw {{kind}}. Named IDs survive export / import and stay readable in diffs.",
      rawSysId:
        "Do not put a hardcoded sys_id in `$id`. Use `Now.ID['descriptive-key']` and let the SDK own the mapping.",
    },
  },
  createOnce(context) {
    let preferNowId: boolean;
    const apis = apisByName();

    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
        preferNowId =
          objectOptionAt<RequireFluentIdOptions>(context, 0, new Set(["preferNowId"]), {}).preferNowId !==
          false;
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        const api = getName(call.callee);
        if (!api) return;
        const capability = apis.get(api);
        if (!capability || capability.idRequirement !== "required") return;
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
