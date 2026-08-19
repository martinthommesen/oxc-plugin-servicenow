import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { staticMemberChain } from "../utils/ast.js";

export const noPackagesCalls = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow the Rhino `Packages.*` bridge. It is unsupported in scoped apps and on modern runtimes.",
      recommended: "recommended",
      url: ruleDocsUrl("no-packages-calls"),
    },
    messages: {
      packages:
        "Do not use the `Packages.*` Java bridge. It is unavailable in scoped applications and will break under the modern JavaScript engine. Use Glide / scoped APIs instead.",
    },
  },
  createOnce(context) {
    return {
      MemberExpression(node) {
        const member = node as ESTree.MemberExpression;
        const chain = staticMemberChain(member);
        if (!chain || chain[0] !== "Packages") return;
        // Only report the outermost member expression of the chain so
        // Packages.java.lang.String yields one diagnostic, not three.
        const ancestors = context.sourceCode.getAncestors(node);
        const parent = ancestors[ancestors.length - 1] as ESTree.Node | undefined;
        if (parent?.type === "MemberExpression" && parent.object === node) {
          return;
        }
        context.report({ node, messageId: "packages" });
      },
    };
  },
});
