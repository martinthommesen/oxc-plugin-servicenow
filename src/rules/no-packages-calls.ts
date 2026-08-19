import { defineRule } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";

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
      Identifier(node) {
        if (getName(node) !== "Packages") return;
        context.report({ node, messageId: "packages" });
      },
    };
  },
});
