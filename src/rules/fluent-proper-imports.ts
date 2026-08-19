import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, getStringValue } from "../utils/ast.js";
import { staticPropertyName } from "../analysis/index.js";
import { importOwnedApis } from "../fluent/index.js";
import { isFluentContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

function importedNames(node: ESTree.ImportDeclaration): Array<{ exported: string; local: string }> {
  const names: Array<{ exported: string; local: string }> = [];
  for (const spec of node.specifiers) {
    if (spec.type === "ImportSpecifier") {
      const imported = spec.imported;
      const exported =
        getName(imported) ??
        getStringValue(imported) ??
        (imported as { name?: string }).name ??
        null;
      const local = getName(spec.local);
      if (exported && local) names.push({ exported, local });
    } else if (spec.type === "ImportNamespaceSpecifier") {
      const local = getName(spec.local);
      if (local) names.push({ exported: "*", local });
    }
  }
  return names;
}

export const fluentProperImports = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Fluent APIs to be imported from the module recorded in the versioned SDK manifest. Does not rewrite whole import declarations.",
      url: ruleDocsUrl("fluent-proper-imports"),
    },
    messages: {
      wrongModule:
        "Import `{{names}}` from `{{expected}}`, not `{{source}}`. Ownership comes from the Fluent SDK manifest.",
      missingCore:
        "`{{name}}` is a Fluent API and must be imported from `{{expected}}`.",
    },
  },
  createOnce(context) {
    let importedLocals: Set<string>;
    let namespaceSources: Map<string, string>;
    let pendingCalls: Array<{ node: ESTree.Node; name: string; expected: string }>;
    const owned = importOwnedApis();

    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
        importedLocals = new Set();
        namespaceSources = new Map();
        pendingCalls = [];
      },
      ImportDeclaration(node) {
        const decl = node as ESTree.ImportDeclaration;
        const source = getStringValue(decl.source);
        if (!source) return;
        const names = importedNames(decl);

        for (const item of names) {
          if (item.exported === "*") {
            namespaceSources.set(item.local, source);
          }
        }

        const ownedNames = names.filter((item) => item.exported !== "*" && owned.has(item.exported));
        if (ownedNames.length === 0) return;

        const mismatched = ownedNames.filter((item) => owned.get(item.exported) !== source);
        for (const item of ownedNames) {
          importedLocals.add(item.local);
        }

        if (mismatched.length === 0) return;
        const expected = owned.get(mismatched[0]!.exported) ?? "@servicenow/sdk/core";
        context.report({
          node: decl.source as unknown as ESTree.Node,
          messageId: "wrongModule",
          data: {
            names: mismatched.map((item) => item.exported).join(", "),
            source,
            expected,
          },
        });
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        const callee = call.callee;
        const direct = getName(callee);
        if (direct) {
          if (importedLocals.has(direct)) return;
          const expected = owned.get(direct);
          if (!expected) return;
          pendingCalls.push({
            node: callee as unknown as ESTree.Node,
            name: direct,
            expected,
          });
          return;
        }

        if (callee.type !== "MemberExpression") return;
        const member = callee as ESTree.MemberExpression;
        const namespaceName = getName(member.object);
        const exported = staticPropertyName(member);
        if (!namespaceName || !exported) return;
        const nsSource = namespaceSources.get(namespaceName);
        if (!nsSource) return;
        const expected = owned.get(exported);
        if (!expected) return;
        if (expected === nsSource) return;
        context.report({
          node: member.property as unknown as ESTree.Node,
          messageId: "wrongModule",
          data: { names: exported, source: nsSource, expected },
        });
      },
      after() {
        for (const { node, name, expected } of pendingCalls) {
          if (importedLocals.has(name)) continue;
          context.report({ node, messageId: "missingCore", data: { name, expected } });
        }
      },
    };
  },
});
