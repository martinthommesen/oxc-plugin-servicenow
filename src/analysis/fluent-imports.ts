import type { ESTree } from "@oxlint/plugins";
import { apisByName, type FluentApiCapability, type FluentSdkManifest } from "../fluent/index.js";
import { getName, getStringValue, isNode, nodeStart, unwrapExpression } from "../utils/ast.js";
import type { BindingWriteQuery } from "./binding-writes.js";
import { staticPropertyName } from "./members.js";
import type { FileBindings, LexicalBinding } from "./bindings.js";

/**
 * The identity of an import is its lexical binding, not its spelling. The
 * source module stays in the result: a local alias does not make an import
 * from an unrelated module a ServiceNow factory.
 */
export interface FluentImportBinding {
  bindingId: number;
  /** `*` denotes a namespace import. */
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
        exportedName = getName(imported) ?? getStringValue(imported) ?? "*";
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
  // Only simple aliases are accepted. Destructuring can bind several values
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

// Source position is execution order only for straight-line module-level
// code. A write inside any function can run at any time relative to the use,
// and a use inside a function at any time relative to module-level writes,
// so both make the alias uncertain wherever they appear (FINDINGS.md COR-006).
function isFunctionScopedWrite(ancestorTypes: readonly string[]): boolean {
  return ancestorTypes.some((ancestor) => FUNCTION_ANCESTORS.has(ancestor));
}

function isConditionalWrite(ancestorTypes: readonly string[]): boolean {
  return ancestorTypes.some((ancestor) => CONDITIONAL_WRITE_ANCESTORS.has(ancestor));
}

/**
 * The value a mutable alias holds at `use`, or null when execution order or
 * intervening writes make it uncertain. Ordering comes from portable node
 * offsets: a host that supplies only `range` must resolve exactly like one
 * that supplies `start`, and a node with no offset at all suppresses the
 * fact instead of silently keeping the first initializer (FINDINGS.md COR-007).
 * Initialized `var` redeclarations are ordinary writes in the index, so
 * `var T = A; var T = B;` resolves to `B` (FINDINGS.md COR-009).
 */
function latestSimpleValue(
  binding: LexicalBinding,
  use: ESTree.Node,
  useInsideFunction: boolean,
  writes: BindingWriteQuery,
): ESTree.Node | null {
  let value = declarationInit(binding);
  if (binding.kind === "const") return value;
  const indexed = writes.writesFor(binding.id);
  if (indexed.length === 0) return value;
  const useStart = nodeStart(use);
  let valueOffset = nodeStart(binding.node);
  if (useStart < 0 || valueOffset < 0) return null;
  for (const write of indexed) {
    if (write.kind === "for" || !write.simple) continue;
    if (write.kind === "update") return null;
    if (isFunctionScopedWrite(write.ancestorTypes) || useInsideFunction) return null;
    if (write.start < 0) return null;
    if (write.start >= useStart) continue;
    if (write.operator !== "=" || isConditionalWrite(write.ancestorTypes)) return null;
    if (write.start > valueOffset) {
      value = write.right;
      valueOffset = write.start;
    }
  }
  return value;
}

function resolveBindingOrigin(
  node: ESTree.Node,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
  seen: Set<number>,
  writes: BindingWriteQuery,
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
    const useInsideFunction = ancestors.some((ancestor) => FUNCTION_ANCESTORS.has(ancestor.type));
    const init = latestSimpleValue(binding, expr, useInsideFunction, writes);
    if (!init) return null;
    seen.add(binding.id);
    // The declaration node has enough source/span data for ScopeTree; the
    // caller's ancestors are retained for hosts with richer scope data.
    return resolveBindingOrigin(
      init,
      [...ancestors, binding.node],
      bindings,
      imports,
      seen,
      writes,
    );
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
    writes,
  );
  if (!namespace || namespace.exportedName !== "*") return null;
  return { ...namespace, exportedName: exported };
}

/** Resolve a direct import, a program-point alias, or a namespace member. */
export function importedBindingFor(
  node: ESTree.Node,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
  writes: BindingWriteQuery,
): FluentImportBinding | null {
  return resolveBindingOrigin(node, ancestors, bindings, imports, new Set(), writes);
}

// Manifests are cached per SDK version, so their identity is stable and the
// ~50-entry name index can be built once instead of per call expression.
const apiIndexByManifest = new WeakMap<
  FluentSdkManifest,
  ReadonlyMap<string, FluentApiCapability>
>();

function fluentApiIndex(manifest: FluentSdkManifest): ReadonlyMap<string, FluentApiCapability> {
  let apis = apiIndexByManifest.get(manifest);
  if (!apis) {
    apis = apisByName(manifest);
    apiIndexByManifest.set(manifest, apis);
  }
  return apis;
}

export function resolveFluentCandidate(
  callee: unknown,
  ancestors: readonly ESTree.Node[],
  bindings: FileBindings,
  imports: ReadonlyMap<number, FluentImportBinding>,
  manifest: FluentSdkManifest,
  writes: BindingWriteQuery,
): { capability: FluentApiCapability; origin: FluentImportBinding } | null {
  const expr = unwrapExpression(callee);
  if (!isNode(expr)) return null;
  const apis = fluentApiIndex(manifest);
  const origin = importedBindingFor(expr, ancestors, bindings, imports, writes);
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
  writes: BindingWriteQuery,
): FluentApiCapability | null {
  const candidate = resolveFluentCandidate(callee, ancestors, bindings, imports, manifest, writes);
  if (!candidate) return null;
  const { capability, origin } = candidate;
  // A recognized symbol from another module is still a candidate for the
  // import-policy rule, but it is not an authoritative factory for semantic
  // rules. Cross-file re-exports are intentionally out of scope here.
  if (capability.module === "unknown" || origin.sourceModule !== capability.module) return null;
  return capability;
}
