import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { getAncestors } from "../analysis/internal.js";
import { ruleDocsUrl } from "../constants.js";
import { isMixedUiActionContext, isServerInstanceContext } from "../context/index.js";
import { getName, isValueReference } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

export const noPackagesCalls = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Review unresolved Rhino `Packages.*` bridge use before ServiceNow's planned restrictions.",
      url: ruleDocsUrl("no-packages-calls"),
    },
    messages: {
      packages:
        "Review this `Packages.*` bridge use. ServiceNow documents planned prevention for calls to ServiceNow Java classes beginning with the Australia release. Review other Java and MID Server calls against the execution context.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { script } = beginRuleFile(context);
        if (!isServerInstanceContext(script) || isMixedUiActionContext(script)) {
          return false;
        }
        // Per-file facts, so they decline the file rather than re-deciding
        // per node: the Rhino bridge only exists in classic server scripts,
        // and an unknown surface is not evidence of one.
        if (script.authoring !== "classic" || script.sources.surfaces === "unknown") return false;
        return undefined;
      },
      MemberExpression(node) {
        const { provenance } = beginRuleFile(context);
        const member = node as ESTree.MemberExpression;
        const root = rootIdentifier(member);
        if (!root || getName(root) !== "Packages" || !provenance.isPlatformGlobal(root)) return;
        const ancestors = getAncestors(context, node as ESTree.Node);
        const parent = ancestors[ancestors.length - 1] as ESTree.Node | undefined;
        if (
          parent?.type === "MemberExpression" &&
          (parent as ESTree.MemberExpression).object === node
        ) {
          return;
        }
        context.report({ node, messageId: "packages" });
      },
      Identifier(node) {
        const { provenance } = beginRuleFile(context);
        if (getName(node) !== "Packages" || !provenance.isPlatformGlobal(node as ESTree.Node)) {
          return;
        }
        const ancestors = getAncestors(context, node as ESTree.Node);
        if (!isValueReference(node as ESTree.Node, [...ancestors, node as ESTree.Node])) return;
        const parent = ancestors[ancestors.length - 1] as ESTree.Node | undefined;
        if (
          parent?.type === "MemberExpression" &&
          (parent as ESTree.MemberExpression).object === node
        ) {
          return;
        }
        context.report({ node, messageId: "packages" });
      },
    };
  },
});

function rootIdentifier(node: ESTree.MemberExpression): ESTree.Node | null {
  let current: ESTree.Node = node;
  while (current.type === "MemberExpression") {
    current = (current as ESTree.MemberExpression).object as ESTree.Node;
  }
  return getName(current) ? current : null;
}
