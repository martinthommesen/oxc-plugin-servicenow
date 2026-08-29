import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { findStablePlatformConstructorCalls } from "../analysis/internal.js";
import { getName, getStringValue } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";
import { shouldDiagnoseFeature, type EngineFeatureId } from "../engine/index.js";

const LOGICAL_ASSIGN = new Set(["||=", "&&=", "??="]);
const LOOKBEHIND = /\(\?<[=!]/;
const REGEXP_NAMES = ["RegExp"] as const;

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
        "Disallow JavaScript syntax that the configured ServiceNow release and mode do not support.",
      url: ruleDocsUrl("no-unsupported-syntax"),
    },
    messages: {
      optional:
        "Optional chaining (`?.`) is not supported in Compatibility or ES5 Standards mode. Use an explicit null check, or set `javascriptMode` to `es2021`.",
      nullish:
        "Nullish coalescing (`??`) is not supported in Compatibility or ES5 Standards mode. Use a ternary, or set `javascriptMode` to `es2021`.",
      logicalAssign:
        "Logical assignment (`{{op}}`) is not supported in Compatibility or ES5 Standards mode. Use an explicit assignment and condition.",
      privateInstance:
        "Private instance class members (`#{{name}}`) are not supported on the ServiceNow JavaScript engine. Use a public property or a closure.",
      privateStatic:
        "Private static class members (`#{{name}}`) are not supported in Compatibility or ES5 Standards mode. Use a public static property or a closure.",
      lookbehind:
        "RegExp lookbehind (`(?<=` / `(?<!`) is not supported in Compatibility or ES5 Standards mode. Rewrite the expression with supported capture groups or string operations.",
      objectMethod:
        "Object literal shorthand methods are not available in Compatibility or ES5 Standards mode. Use a function-valued property, or set `javascriptMode` to `es2021`.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        const ids: EngineFeatureId[] = [
          "optional-chaining",
          "nullish-coalescing",
          "logical-assignment",
          "object-method-syntax",
          "async-object-method-syntax",
          "generator-object-method-syntax",
          "private-instance-members",
          "private-static-members",
          "lookbehind",
        ];
        if (!ids.some((id) => shouldDiagnoseFeature(script, id))) return false;
      },
      ChainExpression(node) {
        if (featureOn("optional-chaining")) context.report({ node, messageId: "optional" });
      },
      LogicalExpression(node) {
        if (
          (node as ESTree.LogicalExpression).operator === "??" &&
          featureOn("nullish-coalescing")
        ) {
          context.report({ node, messageId: "nullish" });
        }
      },
      AssignmentExpression(node) {
        const op = (node as ESTree.AssignmentExpression).operator;
        if (LOGICAL_ASSIGN.has(op) && featureOn("logical-assignment")) {
          context.report({ node, messageId: "logicalAssign", data: { op } });
        }
      },
      PropertyDefinition: checkPrivate,
      MethodDefinition: checkPrivate,
      Property(node) {
        const property = node as ESTree.ObjectProperty;
        if (property.kind !== "init" || !property.method) return;
        const method = property.value as { async?: boolean; generator?: boolean };
        const feature: EngineFeatureId = method.async
          ? "async-object-method-syntax"
          : method.generator
            ? "generator-object-method-syntax"
            : "object-method-syntax";
        if (featureOn(feature)) {
          context.report({ node, messageId: "objectMethod" });
        }
      },
      Literal(node) {
        if (!featureOn("lookbehind")) return;
        const pattern = regexPattern(node);
        if (pattern && LOOKBEHIND.test(pattern)) {
          context.report({ node, messageId: "lookbehind" });
        }
      },
      Program(node) {
        if (!featureOn("lookbehind")) return;
        const { analysis, file } = beginRuleFile(context);
        for (const finding of findStablePlatformConstructorCalls({
          program: node as ESTree.Node,
          analysis,
          bindingWrites: file.bindingWrites,
          mutations: file.mutations,
          names: REGEXP_NAMES,
          namespaces: ["globalThis"],
          mutationSemantics: "authority",
        })) {
          const first = finding.node.arguments[0];
          if (!first || first.type === "SpreadElement") continue;
          const value = getStringValue(first);
          if (value && LOOKBEHIND.test(value)) {
            context.report({ node: finding.node, messageId: "lookbehind" });
          }
        }
      },
    };

    function featureOn(id: EngineFeatureId): boolean {
      return shouldDiagnoseFeature(beginRuleFile(context).context, id);
    }

    function checkPrivate(node: ESTree.Node) {
      const rec = node as { key?: ESTree.Node; static?: boolean };
      const key = rec.key;
      if (!key || (key as { type?: string }).type !== "PrivateIdentifier") return;
      const name = getName(key) ?? "";
      if (rec.static) {
        if (featureOn("private-static-members")) {
          context.report({ node: key, messageId: "privateStatic", data: { name } });
        }
        return;
      }
      if (featureOn("private-instance-members")) {
        context.report({ node: key, messageId: "privateInstance", data: { name } });
      }
    }
  },
});
