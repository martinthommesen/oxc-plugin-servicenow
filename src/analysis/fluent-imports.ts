import type { ESTree } from "@oxlint/plugins";
import { apisByName, type FluentApiCapability, type FluentSdkManifest } from "../fluent/index.js";
import { getName, getStringValue, isNode, unwrapExpression, walk } from "../utils/ast.js";
import { staticPropertyName } from "./members.js";
import type { FileBindings, LexicalBinding } from "./bindings.js";

/** The identity of an import is its lexical binding, not its spelling. */
export interface FluentImportBinding {
  bindingId: number;
  /** `*` denotes a namespace import. */
  exportedName: string;
  sourceModule: string;
}

/**
 * Resolve the origin of a factory/namespace value.  This intentionally keeps
 * the source module in the result: a local alias does not make an import from
 * an unrelated module a ServiceNow factory.
 */
export interface FluentBindingOrigin {
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

function declarationInit(binding: LexicalBinding): ESTree.Node | null {
  if (binding.kind !== "const" && binding.kind !== "let") return null;
  if (binding.node.type !== "VariableDeclarator") return null;
  const declaration = binding.node as ESTree.VariableDeclarator;
  // Only simple aliases are accepted.  Destructuring can bind several values
  // and needs a property-sensitive assignment model; treating it as a factory
  // would turn an unrelated object property into a false positive.
  if (!isNode(declaration.id) || declaration.id.type !== "Identifier") return null;
  return isNode(declaration.init) ? declaration.init : null;
}

function resolveBindingOrigin(
  node: ESTree.Node,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
  seen: Set<number>,
): FluentImportBinding | null {
  const expr = unwrapExpression(node);
  if (!isNode(expr)) return null;

  if (expr.type === "Identifier") {
    const name = getName(expr);
    if (!name) return null;
    const binding = bindings.tree.resolve(name, expr, ancestors);
    if (!binding || seen.has(binding.id)) return null;
    const imported = imports.get(binding.id);
    if (imported) return imported;
    const init = declarationInit(binding);
    if (!init) return null;
    seen.add(binding.id);
    // A declaration node has enough source/span information for ScopeTree to
    // resolve its initializer.  The caller's ancestors are retained for
    // hosts that provide richer lexical scope data.
    return resolveBindingOrigin(init, [...ancestors, binding.node], bindings, imports, seen);
  }

  if (expr.type !== "MemberExpression") return null;
  const member = expr as ESTree.MemberExpression;
  const exported = staticPropertyName(member);
  if (!exported) return null;
  const namespace = resolveBindingOrigin(
    unwrapExpression(member.object) as ESTree.Node,
    ancestors,
    bindings,
    imports,
    seen,
  );
  if (!namespace || namespace.exportedName !== "*") return null;
  return { ...namespace, exportedName: exported };
}

/**
 * Resolve a direct import, a proven const/let alias, or a namespace member.
 * `let` aliases are accepted only while their declaration is the sole known
 * assignment; later assignments are conservatively rejected by the binding
 * identity check in `resolveFactory` (see `isStableAlias`).
 */
export function resolveFluentBindingOrigin(
  node: ESTree.Node,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
): FluentBindingOrigin | null {
  return resolveBindingOrigin(node, ancestors, bindings, imports, new Set());
}

function isStableAlias(
  node: ESTree.Node,
  binding: LexicalBinding,
  program: ESTree.Node | undefined,
  bindings: FileBindings,
): boolean {
  if (binding.kind === "const" || binding.kind === "import") return true;
  if (binding.kind !== "let" || !program) return false;
  // A let alias is safe when no write other than its declaration exists.  Do
  // not infer stability from identifier spelling; resolve every write to the
  // lexical BindingId so shadowed aliases remain independent.
  let writes = 0;
  const ancestors: ESTree.Node[] = [];
  walk(
    program,
    {
      AssignmentExpression(current) {
        const assignment = current as ESTree.AssignmentExpression;
        const left = unwrapExpression(assignment.left);
        if (!isNode(left) || left.type !== "Identifier") return;
        const name = getName(left);
        if (!name) return;
        const resolved = bindings.tree.resolve(name, left, ancestors);
        if (resolved?.id === binding.id) writes += 1;
      },
      UpdateExpression(current) {
        const argument = unwrapExpression((current as ESTree.UpdateExpression).argument);
        if (!isNode(argument) || argument.type !== "Identifier") return;
        const name = getName(argument);
        const resolved = name ? bindings.tree.resolve(name, argument, ancestors) : null;
        if (resolved?.id === binding.id) writes += 1;
      },
    },
    ancestors,
  );
  return writes === 0 && node.start !== undefined;
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
  const origin = resolveFluentBindingOrigin(expr, ancestors, bindings, imports);
  if (!origin) return null;

  // For a mutable alias, resolve only an import itself.  The declaration
  // initializer is still useful for namespace aliases, but a reassigned
  // variable must not continue to identify the old factory.
  if (expr.type === "Identifier") {
    const binding = bindings.tree.resolve(getName(expr) ?? "", expr, ancestors);
    const program = ancestors.find((ancestor) => ancestor.type === "Program");
    if (binding && !isStableAlias(expr, binding, program, bindings)) return null;
  }
  if (origin.exportedName === "*" || origin.exportedName === "default") return null;
  return apis.get(origin.exportedName) ?? null;
}

export function importedBindingFor(
  node: ESTree.Node,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
): FluentImportBinding | null {
  return resolveFluentBindingOrigin(node, ancestors, bindings, imports);
}
