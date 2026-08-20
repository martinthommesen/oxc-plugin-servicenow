import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { getAncestors } from "../analysis/index.js";
import { isCanonicalNowId } from "../analysis/now-id.js";
import { ruleDocsUrl } from "../constants.js";
import { getStringValue, objectProperty } from "../utils/ast.js";
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
        "Require Fluent entities to declare `$id` when the selected SDK manifest marks the imported API as requiring an id. Prefer `Now.ID['descriptive-key']`.",
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

    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
        preferNowId =
          objectOptionAt<RequireFluentIdOptions>(context, 0, new Set(["preferNowId"]), {}).preferNowId !==
          false;
      },
      CallExpression(node) {
        const { file, analysis } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        const ancestors = getAncestors(context, call);
        const capability = file.fluent.resolveFactory(call.callee, ancestors);
        if (!capability || capability.idRequirement !== "required") return;
        const arg = call.arguments[0];
        if (!arg || arg.type !== "ObjectExpression") return;

        const idProp = objectProperty(arg, "$id");
        if (!idProp) {
          context.report({
            node: call.callee as unknown as ESTree.Node,
            messageId: "missing",
            data: { api: capability.name, hint: hintFrom(arg, capability.name) },
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
        if (isCanonicalNowId(value, analysis)) return;
        const kind = literal != null ? "string" : value.type === "Literal" ? "literal" : "value";
        context.report({ node: value, messageId: "preferNowId", data: { kind } });
      },
    };
  },
});

function hintFrom(arg: ESTree.ObjectExpression, api: string): string {
  const name = objectProperty(arg, "name");
  const nameValue = name ? getStringValue(name.value) : null;
  if (nameValue) return nameValue.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return api.toLowerCase();
}
