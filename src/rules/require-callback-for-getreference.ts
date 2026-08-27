import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  hasAuthoritativeGlobalObjectMethod,
  isDefinitelyNullishValue,
  resolveDominatingConstValue,
  staticPropertyName,
  type BindingWriteQuery,
  type ProvenanceQuery,
} from "../analysis/internal.js";
import { isClientCapableContext } from "../context/index.js";
import { ruleDocsUrl } from "../constants.js";
import { getName, isNode } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

function isNullishCallback(node: unknown, analysis: ProvenanceQuery): boolean {
  if (!node) return true;
  return isDefinitelyNullishValue(node, analysis.bindings);
}

function callbackKind(
  node: unknown,
  analysis: ProvenanceQuery,
  bindingWrites: BindingWriteQuery,
): "callable" | "invalid" | "unknown" {
  const value = resolveDominatingConstValue(node, analysis.bindings);
  if (!isNode(value)) return "unknown";
  if (value.type === "FunctionExpression" || value.type === "ArrowFunctionExpression")
    return "callable";
  if (value.type === "Identifier") {
    const name = getName(value);
    if (!name) return "unknown";
    const binding = analysis.bindings.resolve(name, value);
    if (!binding) return "unknown";
    if (binding.kind === "function") {
      return bindingWrites.isWritten(binding.id) ? "unknown" : "callable";
    }
    if (binding.kind === "class") {
      return bindingWrites.isWritten(binding.id) ? "unknown" : "invalid";
    }
    return "unknown";
  }
  if (
    value.type === "Literal" ||
    value.type === "TemplateLiteral" ||
    value.type === "ObjectExpression" ||
    value.type === "ArrayExpression" ||
    value.type === "ClassExpression"
  ) {
    return "invalid";
  }
  return "unknown";
}

export const requireCallbackForGetreference = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a callback on `g_form.getReference()`. The one-argument form is a synchronous server request. Evidence: https://www.servicenow.com/docs/r/api-reference/c_GlideFormAPI.html",
      url: ruleDocsUrl("require-callback-for-getreference"),
    },
    messages: {
      missingCallback:
        "`getReference()` without a callback blocks the browser. Pass a function as the second argument.",
      invalidCallback:
        "`getReference()` received a value that is not callable. Pass a function as the second argument.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isClientCapableContext(script)) return false;
      },
      CallExpression(node) {
        const { analysis, file } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        if (staticPropertyName(call.callee) !== "getReference") return;
        const object = (call.callee as ESTree.MemberExpression).object;
        const proven = analysis.ofExpression(object);
        if (proven?.kind !== "g_form" || proven.invalid || proven.escaped) return;
        if (
          !hasAuthoritativeGlobalObjectMethod(file, object, "g_form", "getReference", {
            prototypeConstructor: "GlideForm",
            runtime: "browser",
          })
        ) {
          return;
        }
        // A spread has unknown runtime arity. It may supply a callback even
        // when no syntactic second argument is present.
        if (call.arguments.some((argument) => argument.type === "SpreadElement")) return;
        const callback = call.arguments[1];
        if (call.arguments.length >= 2 && !isNullishCallback(callback, analysis)) {
          if (callbackKind(callback, analysis, file.bindingWrites) === "invalid") {
            context.report({ node, messageId: "invalidCallback" });
          }
          return;
        }
        context.report({ node, messageId: "missingCallback" });
      },
    };
  },
});
