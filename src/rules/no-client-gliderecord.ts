import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getName, isNode, propertyKeyName, unwrapExpression } from "../utils/ast.js";
import { staticPropertyName } from "../analysis/internal.js";
import { appliesOnSurface, isMixedUiActionContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

const CTORS = ["GlideRecord", "GlideRecordSecure"] as const;

export const noClientGliderecord = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow platform GlideRecord in scoped client scripts, where ServiceNow does not support the client API.",
      url: ruleDocsUrl("no-client-gliderecord"),
    },
    messages: {
      glideRecord:
        "Client GlideRecord is not supported in scoped applications. Query through a Script Include with `GlideAjax` or a Scripted REST API.",
    },
  },
  createOnce(context) {
    const aliases = new Map<number, (typeof CTORS)[number]>();

    return {
      before() {
        aliases.clear();
        const { context: script } = beginRuleFile(context);
        if (
          script.scope !== "scoped" ||
          !appliesOnSurface(script, "client") ||
          isMixedUiActionContext(script)
        ) {
          return false;
        }
      },
      NewExpression(node) {
        report((node as ESTree.NewExpression).callee as ESTree.Node, node);
      },
      CallExpression(node) {
        report((node as ESTree.CallExpression).callee as ESTree.Node, node);
      },
      VariableDeclarator(node) {
        const { analysis } = beginRuleFile(context);
        const declaration = node as ESTree.VariableDeclarator;
        const id = unwrapExpression(declaration.id);
        if (isNode(id) && id.type === "Identifier") {
          setAlias(id, constructorName(declaration.init));
          return;
        }
        const init = unwrapExpression(declaration.init);
        if (
          !isNode(id) ||
          id.type !== "ObjectPattern" ||
          !isNode(init) ||
          getName(init) !== "global" ||
          !analysis.isPlatformGlobal(init)
        ) {
          return;
        }
        for (const item of (id as ESTree.ObjectPattern).properties) {
          if (!isNode(item) || item.type !== "Property") continue;
          const property = item as ESTree.ObjectProperty;
          const name = propertyKeyName(property);
          const value = unwrapExpression(property.value);
          if (
            name &&
            CTORS.includes(name as (typeof CTORS)[number]) &&
            isNode(value) &&
            value.type === "Identifier"
          ) {
            setAlias(value, name as (typeof CTORS)[number]);
          }
        }
      },
      AssignmentExpression(node) {
        const assignment = node as ESTree.AssignmentExpression;
        const left = unwrapExpression(assignment.left);
        if (isNode(left) && left.type === "Identifier") {
          setAlias(left, assignment.operator === "=" ? constructorName(assignment.right) : null);
        }
      },
    };

    function setAlias(node: ESTree.Node, name: (typeof CTORS)[number] | null) {
      const { analysis } = beginRuleFile(context);
      const binding = analysis.bindings.resolve(getName(node) ?? "", node);
      if (!binding) return;
      if (name) aliases.set(binding.id, name);
      else aliases.delete(binding.id);
    }

    function constructorName(node: unknown): (typeof CTORS)[number] | null {
      const { analysis } = beginRuleFile(context);
      const inner = unwrapExpression(node);
      if (!isNode(inner)) return null;
      const direct = getName(inner);
      if (direct) {
        if (CTORS.includes(direct as (typeof CTORS)[number]) && analysis.isPlatformGlobal(inner)) {
          return direct as (typeof CTORS)[number];
        }
        const binding = analysis.bindings.resolve(direct, inner);
        return binding ? (aliases.get(binding.id) ?? null) : null;
      }
      if (inner.type !== "MemberExpression") return null;
      const property = staticPropertyName(inner);
      const object = unwrapExpression((inner as ESTree.MemberExpression).object);
      if (
        property &&
        CTORS.includes(property as (typeof CTORS)[number]) &&
        isNode(object) &&
        getName(object) === "global" &&
        analysis.isPlatformGlobal(object)
      ) {
        return property as (typeof CTORS)[number];
      }
      return null;
    }

    function report(callee: ESTree.Node, node: ESTree.Node) {
      if (!constructorName(callee)) return;
      context.report({ node, messageId: "glideRecord" });
    }
  },
});
