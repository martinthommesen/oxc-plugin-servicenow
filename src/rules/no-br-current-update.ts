import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { staticPropertyName } from "../analysis/internal.js";
import { appliesOnSurface } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";
import { canonicalBusinessRuleWrapper } from "./require-business-rule-wrapper.js";

export const noBrCurrentUpdate = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `current.update()` in Business Rules. It retriggers other rules and can recurse. UI Actions and Script Includes are not Business Rules.",
      url: ruleDocsUrl("no-br-current-update"),
    },
    messages: {
      update:
        "Do not call `current.update()` in a Business Rule. Assign fields on `current` and let the platform save the record (use a *before* rule). Calling `update()` retriggers other Business Rules and can recurse.",
    },
  },
  createOnce(context) {
    let canonicalCurrent: ESTree.Node | null = null;
    let canonicalCurrentArgument: ESTree.Node | null = null;
    let canonicalCurrentBindingId: number | null = null;
    let canonicalCurrentObjectId: number | null = null;
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!appliesOnSurface(script, "business-rule")) return false;
        canonicalCurrent = null;
        canonicalCurrentArgument = null;
        canonicalCurrentBindingId = null;
        canonicalCurrentObjectId = null;
      },
      Program(node) {
        const { analysis, context: script } = beginRuleFile(context);
        if (script.businessRuleSourceFormat !== "full-script") return;
        const wrapper = canonicalBusinessRuleWrapper(node as ESTree.Program, analysis.bindings);
        canonicalCurrent = wrapper?.currentParam ?? null;
        canonicalCurrentArgument = (wrapper?.call.arguments[0] as ESTree.Node | undefined) ?? null;
        canonicalCurrentBindingId = canonicalCurrent
          ? (analysis.bindings.resolve("current", canonicalCurrent)?.id ?? null)
          : null;
        canonicalCurrentObjectId = canonicalCurrentArgument
          ? (analysis.ofExpression(canonicalCurrentArgument)?.objectId ?? null)
          : null;
      },
      CallExpression(node) {
        const { analysis, file } = beginRuleFile(context);
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        const member = call.callee as ESTree.MemberExpression;
        if (staticPropertyName(member) !== "update") return;
        const directGlobal =
          getName(member.object) === "current" &&
          analysis.isPlatformGlobal(member.object as ESTree.Node);
        const proven = analysis.ofExpression(member.object);
        const alias = proven?.kind === "current" && !proven.invalid && !proven.escaped;
        const name = getName(member.object);
        const binding = name ? analysis.bindings.resolve(name, member.object as ESTree.Node) : null;
        const wrapperParam =
          name === "current" &&
          canonicalCurrent !== null &&
          canonicalCurrentBindingId !== null &&
          binding?.node === canonicalCurrent &&
          binding.id === canonicalCurrentBindingId &&
          !file.bindingWrites.isWritten(binding.id) &&
          (!proven || (proven.kind === "current" && !proven.invalid && !proven.escaped));
        const wrapperAlias =
          alias &&
          canonicalCurrentObjectId !== null &&
          proven.objectId === canonicalCurrentObjectId;
        if (!directGlobal && !alias && !wrapperParam) return;
        if (file.bindingWrites.hasDynamicScope()) return;
        if (directGlobal && file.mutations.isGlobalAuthorityLost("current")) return;
        if (
          file.mutations.isGlobalPathAuthorityLost(
            ["current", "update"],
            wrapperParam || wrapperAlias ? (canonicalCurrentArgument ?? undefined) : undefined,
          ) ||
          file.mutations.isGlobalPathAuthorityLost(["GlideRecord", "prototype", "update"]) ||
          file.mutations.isObjectPropertyAuthorityLost(member.object, "update")
        ) {
          return;
        }
        context.report({ node, messageId: "update" });
      },
    };
  },
});
