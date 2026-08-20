import type { ESTree } from "@oxlint/plugins";
import { apisByName, type FluentApiCapability, type FluentSdkManifest } from "../fluent/index.js";
import { getName, getStringValue, isNode, unwrapExpression } from "../utils/ast.js";
import { staticPropertyName } from "./members.js";
import type { FileBindings } from "./bindings.js";

export interface FluentImportBinding {
  bindingId: number;
  exportedName: string;
  sourceModule: string;
}

export function collectFluentImports(
  program: ESTree.Node,
  bindings: FileBindings,
): Map<number, FluentImportBinding> {
  const imports = new Map<number, FluentImportBinding>();
  if (program.type !== "Program") return imports;
  for (const statement of (program as ESTree.Program).body) {
    if (statement.type !== "ImportDeclaration") continue;
    const decl = statement as ESTree.ImportDeclaration;
    const source = getStringValue(decl.source);
    if (!source) continue;
    for (const spec of decl.specifiers) {
      const localNode = (spec as { local?: ESTree.Node }).local;
      const local = getName(localNode);
      if (!local || !localNode) continue;
      const binding = bindings.tree.resolve(local, localNode, [program, decl, spec as unknown as ESTree.Node]);
      if (!binding) continue;
      let exportedName = "*";
      if (spec.type === "ImportSpecifier") {
        const imported = spec.imported;
        exportedName =
          getName(imported) ?? getStringValue(imported) ?? (imported as { name?: string }).name ?? "*";
      } else if (spec.type === "ImportDefaultSpecifier") {
        exportedName = "default";
      }
      imports.set(binding.id, {
        bindingId: binding.id,
        exportedName,
        sourceModule: source,
      });
    }
  }
  return imports;
}

export function resolveFluentFactory(
  callee: unknown,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
  manifest: FluentSdkManifest,
): FluentApiCapability | null {
  const expr = unwrapExpression(callee);
  if (!isNode(expr)) return null;
  const apis = apisByName(manifest);

  if (expr.type === "Identifier") {
    const name = getName(expr);
    if (!name) return null;
    const binding = bindings.tree.resolve(name, expr, ancestors);
    if (!binding || binding.kind !== "import") return null;
    const imported = imports.get(binding.id);
    if (!imported || imported.exportedName === "*" || imported.exportedName === "default") {
      return null;
    }
    return apis.get(imported.exportedName) ?? null;
  }

  if (expr.type !== "MemberExpression") return null;
  const member = expr as ESTree.MemberExpression;
  const object = unwrapExpression(member.object);
  const exported = staticPropertyName(member);
  const namespaceName = getName(object);
  if (!isNode(object) || !namespaceName || !exported) return null;
  const binding = bindings.tree.resolve(namespaceName, object, ancestors);
  if (!binding || binding.kind !== "import") return null;
  const imported = imports.get(binding.id);
  if (!imported || imported.exportedName !== "*") return null;
  return apis.get(exported) ?? null;
}

export function importedBindingFor(
  node: ESTree.Node,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
): FluentImportBinding | null {
  const name = getName(node);
  if (!name) return null;
  const binding = bindings.tree.resolve(name, node, ancestors);
  if (!binding) return null;
  return imports.get(binding.id) ?? null;
}
