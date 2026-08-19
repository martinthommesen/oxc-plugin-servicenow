import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { FLUENT_CORE_MODULE, FLUENT_IMPORT_SET, ruleDocsUrl } from "../constants.js";
import { getName, getStringValue } from "../utils/ast.js";
import { isFluentFile } from "../utils/filenames.js";

function importedNames(node: ESTree.ImportDeclaration): string[] {
  const names: string[] = [];
  for (const spec of node.specifiers) {
    if (spec.type === "ImportSpecifier") {
      const imported = spec.imported;
      const name =
        getName(imported) ??
        getStringValue(imported) ??
        (imported as { name?: string }).name ??
        null;
      if (name) names.push(name);
    }
  }
  return names;
}

export const fluentProperImports = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Fluent entity and column APIs to be imported from `@servicenow/sdk/core`.",
      recommended: "recommended",
      url: ruleDocsUrl("fluent-proper-imports"),
    },
    fixable: "code",
    messages: {
      wrongModule:
        "Import `{{names}}` from `@servicenow/sdk/core`, not `{{source}}`. Fluent entity APIs live on the `/core` entry.",
      missingCore:
        "`{{name}}` is a Fluent API and must be imported from `@servicenow/sdk/core`.",
    },
  },
  createOnce(context) {
    let importedFromCore: Set<string>;
    let importedElsewhere: Map<string, ESTree.Node>;

    return {
      before() {
        if (!isFluentFile(context.filename)) return false;
        importedFromCore = new Set();
        importedElsewhere = new Map();
      },
      ImportDeclaration(node) {
        const decl = node as ESTree.ImportDeclaration;
        const source = getStringValue(decl.source);
        if (!source) return;
        const names = importedNames(decl).filter((name) => FLUENT_IMPORT_SET.has(name));
        if (names.length === 0) return;

        if (source === FLUENT_CORE_MODULE) {
          for (const name of names) importedFromCore.add(name);
          return;
        }

        for (const name of names) importedElsewhere.set(name, node);
        context.report({
          node: decl.source as unknown as ESTree.Node,
          messageId: "wrongModule",
          data: { names: names.join(", "), source },
          fix(fixer) {
            return fixer.replaceText(decl.source as unknown as ESTree.Node, `"${FLUENT_CORE_MODULE}"`);
          },
        });
      },
      CallExpression(node) {
        const name = getName((node as ESTree.CallExpression).callee);
        if (!name || !FLUENT_IMPORT_SET.has(name)) return;
        if (importedFromCore.has(name) || importedElsewhere.has(name)) return;
        context.report({
          node: (node as ESTree.CallExpression).callee as unknown as ESTree.Node,
          messageId: "missingCore",
          data: { name },
        });
      },
    };
  },
});
