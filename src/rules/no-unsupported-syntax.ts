import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, getStringValue } from "../utils/ast.js";
import { usesClassicEngine } from "../utils/filenames.js";

const LOGICAL_ASSIGN = new Set(["||=", "&&=", "??="]);
const LOOKBEHIND = /\(\?<[=!]/;

function regexPattern(node: ESTree.Node): string | null {
  const rec = node as {
    type?: string;
    regex?: { pattern?: string };
    value?: unknown;
  };
  if (rec.regex && typeof rec.regex.pattern === "string") return rec.regex.pattern;
  if ((rec.type === "Literal" || rec.type === "RegExpLiteral") && rec.value instanceof RegExp) {
    return rec.value.source;
  }
  return null;
}

export const noUnsupportedSyntax = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow ES-latest syntax that the classic ServiceNow JavaScript engine does not implement.",
      recommended: "recommended",
      url: ruleDocsUrl("no-unsupported-syntax"),
    },
    messages: {
      optional:
        "Optional chaining (`?.`) is not supported in the classic ServiceNow JavaScript engine. Use an explicit null check, or mark the file `@sn-es-latest`.",
      nullish:
        "Nullish coalescing (`??`) is not supported in the classic ServiceNow JavaScript engine. Use a ternary, or mark the file `@sn-es-latest`.",
      logicalAssign:
        "Logical assignment (`{{op}}`) is not supported in the classic ServiceNow JavaScript engine.",
      privateMember:
        "Private class members (`#{{name}}`) are not supported in the classic ServiceNow JavaScript engine.",
      lookbehind:
        "RegExp lookbehind (`(?<=` / `(?<!`) is not supported in the classic ServiceNow JavaScript engine.",
    },
  },
  createOnce(context) {
    return {
      before() {
        if (!usesClassicEngine(context)) return false;
      },
      ChainExpression(node) {
        context.report({ node, messageId: "optional" });
      },
      LogicalExpression(node) {
        if ((node as ESTree.LogicalExpression).operator === "??") {
          context.report({ node, messageId: "nullish" });
        }
      },
      AssignmentExpression(node) {
        const op = (node as ESTree.AssignmentExpression).operator;
        if (LOGICAL_ASSIGN.has(op)) {
          context.report({ node, messageId: "logicalAssign", data: { op } });
        }
      },
      PropertyDefinition: checkPrivate,
      MethodDefinition: checkPrivate,
      Literal(node) {
        const pattern = regexPattern(node);
        if (pattern && LOOKBEHIND.test(pattern)) {
          context.report({ node, messageId: "lookbehind" });
        }
      },
      NewExpression: checkRegExpCtor,
      CallExpression: checkRegExpCtor,
    };

    function checkPrivate(node: ESTree.Node) {
      const key = (node as { key?: ESTree.Node }).key;
      if (!key || (key as { type?: string }).type !== "PrivateIdentifier") return;
      context.report({
        node: key,
        messageId: "privateMember",
        data: { name: getName(key) ?? "" },
      });
    }

    function checkRegExpCtor(node: ESTree.NewExpression | ESTree.CallExpression) {
      if (getName(node.callee) !== "RegExp") return;
      const first = node.arguments[0];
      if (!first || first.type === "SpreadElement") return;
      const value = getStringValue(first);
      if (value && LOOKBEHIND.test(value)) {
        context.report({ node, messageId: "lookbehind" });
      }
    }
  },
});
