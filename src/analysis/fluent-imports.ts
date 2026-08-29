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
      const binding = bindings.resolve(local, localNode, [
        program,
        decl,
        spec as unknown as ESTree.Node,
      ]);
      if (!binding) continue;
      let exportedName = "*";
      if (spec.type === "ImportSpecifier") {
        const imported = spec.imported;
        exportedName =
          getName(imported) ??
          getStringValue(imported) ??
          (imported as { name?: string }).name ??
          "*";
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
  if (binding.kind !== "const" && binding.kind !== "let" && binding.kind !== "var") return null;
  if (binding.node.type !== "VariableDeclarator") return null;
  const declaration = binding.node as ESTree.VariableDeclarator;
  // Only simple aliases are accepted.  Destructuring can bind several values
  // and needs a property-sensitive assignment model; treating it as a factory
  // would turn an unrelated object property into a false positive.
  if (!isNode(declaration.id) || declaration.id.type !== "Identifier") return null;
  return isNode(declaration.init) ? declaration.init : null;
}

const CONDITIONAL_WRITE_ANCESTORS = new Set([
  "IfStatement",
  "SwitchStatement",
  "SwitchCase",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "TryStatement",
  "CatchClause",
  "ConditionalExpression",
  "LogicalExpression",
]);

const FUNCTION_ANCESTORS = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function latestSimpleValue(
  binding: LexicalBinding,
  use: ESTree.Node,
  program: ESTree.Node | undefined,
  bindings: FileBindings,
  useInsideFunction: boolean,
): ESTree.Node | null {
  const useStart = (use as { start?: number }).start ?? Number.POSITIVE_INFINITY;
  let value = declarationInit(binding);
  let valueOffset = (binding.node as { start?: number }).start ?? -1;
  let uncertain = false;
  if (!program || binding.kind === "const") return value;
  const ancestors: ESTree.Node[] = [];
  walk(
    program,
    {
      AssignmentExpression(node) {
        const assignment = node as ESTree.AssignmentExpression;
        const left = unwrapExpression(assignment.left);
        if (!isNode(left) || left.type !== "Identifier") return;
        const resolved = bindings.resolve(getName(left) ?? "", left, ancestors);
        if (resolved?.id !== binding.id) return;
        // Source position is execution order only for straight-line
        // module-level code. A write inside any function can run at any
        // time relative to the use, and a use inside a function can run at
        // any time relative to module-level writes, so both make the alias
        // uncertain regardless of where they appear (FINDINGS.md COR-006).
        const insideFunction = ancestors
          .slice(0, -1)
          .some((ancestor) => FUNCTION_ANCESTORS.has(ancestor.type));
        if (insideFunction || useInsideFunction) {
          uncertain = true;
          return;
        }
        const start = (node as { start?: number }).start ?? Number.POSITIVE_INFINITY;
        if (start >= useStart) return;
        if (
          assignment.operator !== "=" ||
          ancestors.slice(0, -1).some((ancestor) => CONDITIONAL_WRITE_ANCESTORS.has(ancestor.type))
        ) {
          uncertain = true;
          return;
        }
        if (start > valueOffset) {
          value = isNode(assignment.right) ? assignment.right : null;
          valueOffset = start;
        }
      },
      UpdateExpression(node) {
        const argument = unwrapExpression((node as ESTree.UpdateExpression).argument);
        if (!isNode(argument) || argument.type !== "Identifier") return;
        const resolved = bindings.resolve(getName(argument) ?? "", argument, ancestors);
        if (resolved?.id === binding.id) uncertain = true;
      },
    },
    ancestors,
  );
  return uncertain ? null : value;
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
    const binding = bindings.resolve(name, expr, ancestors);
    if (!binding || seen.has(binding.id)) return null;
    const imported = imports.get(binding.id);
    if (imported) return imported;
    const useInsideFunction = ancestors.some((ancestor) =>
      FUNCTION_ANCESTORS.has(ancestor.type),
    );
    const init = latestSimpleValue(
      binding,
      expr,
      bindings.tree.root?.block,
      bindings,
      useInsideFunction,
    );
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

/** Resolve a direct import, a program-point alias, or a namespace member. */
export function resolveFluentBindingOrigin(
  node: ESTree.Node,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
): FluentBindingOrigin | null {
  return resolveBindingOrigin(node, ancestors, bindings, imports, new Set());
}

export function resolveFluentCandidate(
  callee: unknown,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
  manifest: FluentSdkManifest,
): { capability: FluentApiCapability; origin: FluentBindingOrigin } | null {
  const expr = unwrapExpression(callee);
  if (!isNode(expr)) return null;
  const apis = apisByName(manifest);
  const origin = resolveFluentBindingOrigin(expr, ancestors, bindings, imports);
  if (!origin || origin.exportedName === "*" || origin.exportedName === "default") return null;

  const capability = apis.get(origin.exportedName);
  return capability ? { capability, origin } : null;
}

/** Resolve only an authoritative factory from its owning module. */
export function resolveFluentFactory(
  callee: unknown,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
  manifest: FluentSdkManifest,
): FluentApiCapability | null {
  const candidate = resolveFluentCandidate(callee, ancestors, bindings, imports, manifest);
  if (!candidate) return null;
  const { capability, origin } = candidate;
  // A recognized symbol from another module is still a candidate for the
  // import-policy rule, but it is not an authoritative factory for semantic
  // rules. Cross-file re-exports are intentionally out of scope here.
  if (capability.module === "unknown" || origin.sourceModule !== capability.module) return null;
  return capability;
}
export function importedBindingFor(
  node: ESTree.Node,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
): FluentImportBinding | null {
  return resolveFluentBindingOrigin(node, ancestors, bindings, imports);
}
