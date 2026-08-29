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
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!appliesOnSurface(script, "business-rule")) return false;
      },
      Program(node) {
        const { analysis, context: script } = beginRuleFile(context);
        if (script.businessRuleSourceFormat !== "full-script") return;
        canonicalCurrent =
          canonicalBusinessRuleWrapper(node as ESTree.Program, analysis.bindings)?.currentParam ??
          null;
      },
      CallExpression(node) {
        const { analysis } = beginRuleFile(context);
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
        const wrapperParam =
          name === "current" &&
          canonicalCurrent !== null &&
          analysis.bindings.resolve(name, member.object as ESTree.Node)?.node === canonicalCurrent;
        if (!directGlobal && !alias && !wrapperParam) return;
        context.report({ node, messageId: "update" });
      },
    };
  },
});
