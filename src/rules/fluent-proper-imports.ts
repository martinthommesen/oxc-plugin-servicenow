import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { getAncestors } from "../analysis/index.js";
import { importedBindingFor } from "../analysis/fluent-imports.js";
import { staticPropertyName } from "../analysis/members.js";
import { importOwnedApis } from "../fluent/index.js";
import { ruleDocsUrl } from "../constants.js";
import { getName } from "../utils/ast.js";
import { isFluentContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

export const fluentProperImports = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Fluent APIs to be imported from the module recorded in the selected SDK manifest. Resolves aliases and namespace imports by lexical binding identity.",
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
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
      },
      ImportDeclaration(node) {
        const { file } = beginRuleFile(context);
        const owned = importOwnedApis(file.fluent.manifest);
        const decl = node as ESTree.ImportDeclaration;
        for (const spec of decl.specifiers) {
          if (spec.type !== "ImportSpecifier") continue;
          const local = spec.local as ESTree.Node;
          const imported = importedBindingFor(local, [node, spec as unknown as ESTree.Node], file.bindings, file.fluent.imports);
          if (!imported || imported.exportedName === "*") continue;
          const expected = owned.get(imported.exportedName);
          if (!expected) continue;
          if (expected === imported.sourceModule) continue;
          context.report({
            node: decl.source as unknown as ESTree.Node,
            messageId: "wrongModule",
            data: {
              names: imported.exportedName,
              source: imported.sourceModule,
              expected,
            },
          });
        }
      },
      CallExpression(node) {
        const { file } = beginRuleFile(context);
        const owned = importOwnedApis(file.fluent.manifest);
        const call = node as ESTree.CallExpression;
        const ancestors = getAncestors(context, call);
        const capability = file.fluent.resolveFactory(call.callee, ancestors);
        if (capability) {
          const expected = capability.module === "unknown" ? undefined : capability.module;
          if (!expected) return;
          if (call.callee.type !== "MemberExpression") return;
          const member = call.callee as ESTree.MemberExpression;
          const imported = importedBindingFor(
            member.object as ESTree.Node,
            ancestors,
            file.bindings,
            file.fluent.imports,
          );
          if (imported && imported.exportedName === "*" && imported.sourceModule !== expected) {
            context.report({
              node: member.property as unknown as ESTree.Node,
              messageId: "wrongModule",
              data: { names: capability.name, source: imported.sourceModule, expected },
            });
          }
          return;
        }

        const direct = getName(call.callee);
        if (direct) {
          const expected = owned.get(direct);
          if (!expected) return;
          const binding = file.bindings.tree.resolve(direct, call.callee as ESTree.Node, ancestors);
          if (binding && binding.kind !== "import") return;
          context.report({
            node: call.callee as unknown as ESTree.Node,
            messageId: "missingCore",
            data: { name: direct, expected },
          });
          return;
        }

        if (call.callee.type !== "MemberExpression") return;
        const member = call.callee as ESTree.MemberExpression;
        const exported = staticPropertyName(member);
        const expected = exported ? owned.get(exported) : undefined;
        if (!exported || !expected) return;
        const object = member.object as ESTree.Node;
        const imported = importedBindingFor(object, ancestors, file.bindings, file.fluent.imports);
        if (imported && imported.exportedName === "*" && imported.sourceModule !== expected) {
          context.report({
            node: member.property as unknown as ESTree.Node,
            messageId: "wrongModule",
            data: { names: exported, source: imported.sourceModule, expected },
          });
        }
      },
    };
  },
});
