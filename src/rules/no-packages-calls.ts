import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { isMixedUiActionContext, isServerInstanceContext } from "../context/index.js";
import { getName } from "../utils/ast.js";
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
        "Review this `Packages.*` bridge use. ServiceNow documents planned prevention for calls to platform Java classes; other Java and MID Server uses require execution-context review.",
    },
  },
  createOnce(context) {
    let analysis: ReturnType<typeof beginRuleFile>["analysis"];
    let script: ReturnType<typeof beginRuleFile>["context"];
    return {
      before() {
        const file = beginRuleFile(context);
        if (!isServerInstanceContext(file.context) || isMixedUiActionContext(file.context)) {
          return false;
        }
        analysis = file.analysis;
        script = file.context;
      },
      MemberExpression(node) {
        const member = node as ESTree.MemberExpression;
        const root = rootIdentifier(member);
        if (
          !root ||
          getName(root) !== "Packages" ||
          !analysis.isPlatformGlobal(root) ||
          script.authoring !== "classic" ||
          script.sources.surfaces === "unknown"
        )
          return;
        const ancestors = context.sourceCode.getAncestors(node);
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
  let current: ESTree.Node = node as unknown as ESTree.Node;
  while (current.type === "MemberExpression") {
    current = (current as ESTree.MemberExpression).object as ESTree.Node;
  }
  return getName(current) ? current : null;
}
