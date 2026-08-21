import { defineRule } from "@oxlint/plugins";
import type { Context, ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, getStaticStringValue, getStringValue } from "../utils/ast.js";
import {
  parseRuleOptions,
  noHardcodedSysidOptions,
  schemaFromDescriptor,
} from "../options/index.js";
import type { NoHardcodedSysIdOptions } from "../options/index.js";
import { isInstanceScript } from "../context/index.js";
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
  if (ignoreHashNames && looksLikeMd5Context(bindingName, value)) return;

  for (const id of findSysIds(value)) {
    if (allowed.has(id.toLowerCase())) continue;
    context.report({
      node,
      messageId: "hardcoded",
      data: { id },
    });
  }
}

interface StaticSegment {
  node: ESTree.Node;
  value: string;
  child: boolean;
}

function reportStaticSegments(
  context: Context,
  node: ESTree.Node,
  segments: readonly StaticSegment[],
  allowed: Set<string>,
  bindingName: string | null,
  ignoreHashNames: boolean,
): void {
  const value = segments.map((segment) => segment.value).join("");
  if (ignoreHashNames && looksLikeMd5Context(bindingName, value)) return;

  let offset = 0;
  const ranges = segments.map((segment) => {
    const start = offset;
    offset += segment.value.length;
    return { ...segment, start, end: offset };
  });

  for (const match of value.matchAll(/\b[0-9a-f]{32}\b/gi)) {
    const id = match[0];
    if (allowed.has(id.toLowerCase())) continue;
    const start = match.index;
    const end = start + id.length;
    const segment = ranges.find((candidate) => start >= candidate.start && end <= candidate.end);
    if (segment?.child) continue;
    context.report({
      node: segment?.node ?? node,
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
        const { context: script } = beginRuleFile(context);
        // An ordinary unclassified JavaScript file is not evidence of a
        // ServiceNow script. Keep this rule conservative rather than treating
        // every unrelated 32-hex token as a sys_id.
        if (!isInstanceScript(script)) return false;
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
        const template = node as ESTree.TemplateLiteral;
        const segments: StaticSegment[] = [];
        for (let index = 0; index < template.quasis.length; index += 1) {
          const quasi = template.quasis[index];
          if (!quasi) return;
          segments.push({
            node: quasi as unknown as ESTree.Node,
            value: quasi.value.cooked ?? quasi.value.raw,
            child: false,
          });
          const expression = template.expressions[index];
          if (!expression) continue;
          const value = getStaticStringValue(expression);
          if (value === null) {
            reportSysIds(
              context,
              quasi as unknown as ESTree.Node,
              quasi.value.cooked ?? quasi.value.raw,
              allowed,
              lastBinding,
              ignoreHashNames,
            );
            return;
          }
          segments.push({ node: expression, value, child: true });
        }
        reportStaticSegments(context, node, segments, allowed, lastBinding, ignoreHashNames);
      },
      BinaryExpression(node) {
        const expression = node as ESTree.BinaryExpression;
        if (expression.operator !== "+") return;
        const left = getStaticStringValue(expression.left);
        const right = getStaticStringValue(expression.right);
        if (left === null || right === null) return;
        reportStaticSegments(
          context,
          node,
          [
            { node: expression.left, value: left, child: true },
            { node: expression.right, value: right, child: true },
          ],
          allowed,
          lastBinding,
          ignoreHashNames,
        );
      },
    };
  },
});
