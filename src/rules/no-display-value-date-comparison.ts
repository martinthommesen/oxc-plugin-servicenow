import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  hasAuthoritativeConstructedMethod,
  staticPropertyName,
  type PlatformMethodAuthorityFacts,
} from "../analysis/internal.js";
import { isFluentContext, isInstanceScript } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { beginRuleFile } from "./helpers.js";

const RELATIONAL = new Set(["<", ">", "<=", ">=", "-"]);

function isDisplayValueCall(
  node: ESTree.Node,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
  authority: PlatformMethodAuthorityFacts,
): boolean {
  if (node.type !== "CallExpression") return false;
  const call = node as ESTree.CallExpression;
  if (staticPropertyName(call.callee) !== "getDisplayValue") return false;
  if (call.callee.type !== "MemberExpression") return false;
  const object = (call.callee as ESTree.MemberExpression).object;
  const proven = analysis.ofExpression(object);
  return (
    proven?.kind === "GlideDateTime" &&
    !proven.invalid &&
    !proven.escaped &&
    hasAuthoritativeConstructedMethod(authority, object, "GlideDateTime", "getDisplayValue")
  );
}

export const noDisplayValueDateComparison = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Do not relationally compare `GlideDateTime.getDisplayValue()` strings. They follow the session format, not chronological order. Use `getNumericValue()` or a date-aware API. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideDateTimeAPI.html",
      url: ruleDocsUrl("no-display-value-date-comparison"),
    },
    messages: {
      displayCompare:
        "`getDisplayValue()` is a locale-formatted string. Compare `getNumericValue()` or use a date API instead of `{{op}}`.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (isFluentContext(script) || !isInstanceScript(script)) return false;
      },
      BinaryExpression(node) {
        const { analysis, file } = beginRuleFile(context);
        const expr = node as ESTree.BinaryExpression;
        if (!RELATIONAL.has(expr.operator)) return;
        if (
          isDisplayValueCall(expr.left as ESTree.Node, analysis, file) ||
          isDisplayValueCall(expr.right as ESTree.Node, analysis, file)
        ) {
          context.report({ node, messageId: "displayCompare", data: { op: expr.operator } });
        }
      },
    };
  },
});
