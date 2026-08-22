import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { isInstanceScript } from "../context/index.js";
import { getName } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

export const noPackagesCalls = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow the Rhino `Packages.*` bridge when `Packages` is the unresolved platform global.",
      url: ruleDocsUrl("no-packages-calls"),
    },
    messages: {
      packages:
        "Do not use the `Packages.*` Java bridge. It is unavailable in scoped applications and will break under the modern JavaScript engine. Use Glide / scoped APIs instead.",
    },
  },
  createOnce(context) {
    let analysis: ReturnType<typeof beginRuleFile>["analysis"];
    return {
      before() {
        const file = beginRuleFile(context);
        if (!isInstanceScript(file.context)) return false;
        analysis = file.analysis;
      },
      MemberExpression(node) {
        const member = node as ESTree.MemberExpression;
        const root = rootIdentifier(member);
        if (!root || getName(root) !== "Packages" || !analysis.isPlatformGlobal(root)) return;
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
