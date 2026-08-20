import { defineRule } from "@oxlint/plugins";
import type { Context, ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, getStringValue } from "../utils/ast.js";
import { parseRuleOptions, noHardcodedSysidOptions, schemaFromDescriptor } from "../options/index.js";
import type { NoHardcodedSysIdOptions } from "../options/index.js";
import { beginRuleFile } from "./helpers.js";
import { findSysIds, looksLikeMd5Context } from "../utils/sysid.js";

export type { NoHardcodedSysIdOptions };

function allowedSet(context: Context, options: NoHardcodedSysIdOptions): Set<string> {
  const { context: script } = beginRuleFile(context);
  return new Set(
    [...script.settings.allowedSysIds, ...(options.allowedSysIds ?? [])].map((id) =>
      id.toLowerCase(),
    ),
  );
}

function reportSysIds(
  context: Context,
  node: ESTree.Node,
  value: string,
  allowed: Set<string>,
  bindingName: string | null,
  ignoreHashNames: boolean,
): void {
  if (ignoreHashNames && looksLikeMd5Context(bindingName)) return;

  for (const id of findSysIds(value)) {
    if (allowed.has(id.toLowerCase())) continue;
    context.report({
      node,
      messageId: "hardcoded",
      data: { id },
    });
  }
}

export const noHardcodedSysid = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hardcoded ServiceNow sys_ids. Store them in system properties, constants, or Fluent `Now.ID`.",
      recommended: "recommended",
      url: ruleDocsUrl("no-hardcoded-sysid"),
    },
    schema: schemaFromDescriptor(noHardcodedSysidOptions),
    messages: {
      hardcoded:
        "Hardcoded sys_id '{{id}}' is brittle across instances. Use a system property, a named constant, or Fluent `Now.ID['…']`.",
    },
  },
  createOnce(context) {
    let allowed: Set<string>;
    let ignoreHashNames: boolean;
    let lastBinding: string | null;

    return {
      before() {
        const options = parseRuleOptions(noHardcodedSysidOptions, context.options);
        allowed = allowedSet(context, options);
        ignoreHashNames = options.ignoreHashNames;
        lastBinding = null;
      },
      VariableDeclarator(node) {
        lastBinding = getName((node as ESTree.VariableDeclarator).id);
      },
      "VariableDeclarator:exit"() {
        lastBinding = null;
      },
      Property(node) {
        const prop = node as unknown as ESTree.ObjectProperty;
        lastBinding = getName(prop.key) ?? getStringValue(prop.key);
      },
      "Property:exit"() {
        lastBinding = null;
      },
      Literal(node) {
        const value = getStringValue(node);
        if (value) reportSysIds(context, node, value, allowed, lastBinding, ignoreHashNames);
      },
      TemplateLiteral(node) {
        const value = getStringValue(node);
        if (value) reportSysIds(context, node, value, allowed, lastBinding, ignoreHashNames);
      },
    };
  },
});
