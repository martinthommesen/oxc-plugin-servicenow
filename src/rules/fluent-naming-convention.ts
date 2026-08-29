import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { getAncestors } from "../analysis/internal.js";
import { getName, getStringValue, objectPropertyValue } from "../utils/ast.js";
import { basename } from "../utils/filenames.js";
import {
  parseRuleOptions,
  fluentNamingConventionOptions,
  schemaFromDescriptor,
} from "../options/index.js";
import type { FluentNamingOptions } from "../options/index.js";
import { isFluentContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

export type { FluentNamingOptions };

const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SNAKE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const TABLE = /^[a-z][a-z0-9_]*$/;

function matches(style: FluentNamingOptions["idStyle"], value: string): boolean {
  switch (style) {
    case "kebab-case":
      return KEBAB.test(value);
    case "snake_case":
      return SNAKE.test(value);
    case "either":
      return KEBAB.test(value) || SNAKE.test(value);
    default: {
      const unexpected: never = style;
      throw new Error(`unhandled naming style ${String(unexpected)}`);
    }
  }
}

export const fluentNamingConvention = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce Fluent naming conventions for files, `$id` keys, exported tables, and entity `name` fields.",
      url: ruleDocsUrl("fluent-naming-convention"),
    },
    schema: schemaFromDescriptor(fluentNamingConventionOptions),
    messages: {
      file: "Fluent file '{{file}}' should be {{style}} (e.g. `log-state-change.now.ts`).",
      nowId: "`Now.ID['{{key}}']` should be {{style}} so keys stay stable and readable.",
      tableExport: "Exported table `{{exportName}}` should match its `name` (`{{tableName}}`).",
      tableName: "Table name `{{tableName}}` should be snake_case{{scope}}.",
    },
  },
  createOnce(context) {
    let idStyle: NonNullable<FluentNamingOptions["idStyle"]>;
    let fileStyle: NonNullable<FluentNamingOptions["fileStyle"]>;
    let scopePrefix: string | undefined;

    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
        const options = parseRuleOptions(fluentNamingConventionOptions, context.options);
        idStyle = options.idStyle;
        fileStyle = options.fileStyle;
        scopePrefix = script.settings.scopePrefix;
      },
      Program() {
        const file = basename(context.filename);
        const stem = file.replace(/\.now\.tsx?$/i, "");
        if (stem !== "*" && !matches(fileStyle, stem)) {
          context.report({
            loc: { start: { line: 1, column: 0 } },
            messageId: "file",
            data: { file, style: fileStyle },
          });
        }
      },
      MemberExpression(node) {
        const { file } = beginRuleFile(context);
        const fact = file.nowIdAt.get(node);
        if (!fact || fact.kind !== "static") return;
        const key = fact.key;
        if (matches(idStyle, key)) return;
        context.report({
          node,
          messageId: "nowId",
          data: { key, style: idStyle },
        });
      },
      ExportNamedDeclaration(node) {
        const decl = node as ESTree.ExportNamedDeclaration;
        const declaration = decl.declaration;
        if (!declaration || declaration.type !== "VariableDeclaration") return;
        for (const item of (declaration as ESTree.VariableDeclaration).declarations) {
          const exportName = getName(item.id);
          if (!exportName || !item.init || item.init.type !== "CallExpression") continue;
          const call = item.init as ESTree.CallExpression;
          const { file } = beginRuleFile(context);
          const capability = file.fluent.resolveFactory(call.callee, getAncestors(context, call));
          if (capability?.name !== "Table") continue;
          const arg = call.arguments[0];
          if (!arg || arg.type !== "ObjectExpression") continue;
          const tableNameNode = objectPropertyValue(arg, "name");
          const tableName = tableNameNode ? getStringValue(tableNameNode) : null;
          if (!tableName) continue;

          if (!TABLE.test(tableName) || (scopePrefix && !tableName.startsWith(`${scopePrefix}_`))) {
            context.report({
              node: tableNameNode ?? call.callee,
              messageId: "tableName",
              data: {
                tableName,
                scope: scopePrefix ? ` and start with \`${scopePrefix}_\`` : "",
              },
            });
          }

          if (exportName !== tableName) {
            context.report({
              node: item.id as ESTree.Node,
              messageId: "tableExport",
              data: { exportName, tableName },
            });
          }
        }
      },
    };
  },
});
