import type { ESTree } from "@oxlint/plugins";
import { isNode, propertyKeyName, unwrapExpression, walk } from "../utils/ast.js";
import type { BindingWriteQuery } from "./binding-writes.js";
import type { MutationQuery } from "./mutations.js";
import { staticPropertyName } from "./members.js";
import type { ProvenanceQuery } from "./provenance.js";

const MAX_PLATFORM_CALL_SITES = 20_000;

export interface PlatformGlobalAliasOrigin {
  readonly node: ESTree.Node;
  readonly qualified: boolean;
}

export interface PlatformConstructorCallFinding {
  readonly aliasOrigin: PlatformGlobalAliasOrigin | null;
  readonly name: string;
  readonly node: ESTree.CallExpression | ESTree.NewExpression;
}

export interface PlatformStaticMethodCallFinding {
  readonly aliasOrigin: PlatformGlobalAliasOrigin | null;
  readonly method: string;
  readonly name: string;
  readonly node: ESTree.CallExpression;
}

export interface PlatformConstructorCallOptions {
  readonly program: ESTree.Node;
  readonly analysis: ProvenanceQuery;
  readonly bindingWrites: BindingWriteQuery;
  readonly mutations: MutationQuery;
  readonly names: readonly string[];
  readonly namespaces?: readonly string[];
  /**
   * Platform API diagnostics require original authority. Engine-compatibility
   * diagnostics only need to know whether a callable polyfill may replace an
   * otherwise unavailable constructor.
   */
  readonly mutationSemantics?: "authority" | "callable";
}

export interface PlatformStaticMethodCallOptions extends Omit<
  PlatformConstructorCallOptions,
  "names"
> {
  readonly methods: Readonly<Record<string, readonly string[]>>;
}

interface DeclaratorFacts {
  readonly executionBoundary: ESTree.Node;
  readonly statementContainer: ESTree.Program | ESTree.BlockStatement | null;
}

interface CallSite {
  readonly callee: unknown;
  readonly executionBoundary: ESTree.Node;
  readonly node: ESTree.CallExpression | ESTree.NewExpression;
}

interface PlatformCallSyntaxIndex {
  readonly declarators: WeakMap<ESTree.VariableDeclarator, DeclaratorFacts>;
  readonly callSites: readonly CallSite[];
  readonly callBudgetExceeded: boolean;
}

interface ResolvedPlatformGlobal {
  readonly aliasOrigin: PlatformGlobalAliasOrigin | null;
  readonly name: string;
}

interface StablePlatformGlobalResolver {
  readonly callSites: readonly CallSite[];
  readonly pathIdentityIsStable: (path: readonly string[]) => boolean;
  readonly resolve: (node: unknown, useBoundary: ESTree.Node) => ResolvedPlatformGlobal | null;
}

const syntaxIndexByProgram = new WeakMap<ESTree.Node, PlatformCallSyntaxIndex>();

function functionLike(node: ESTree.Node | undefined): boolean {
  return (
    node?.type === "FunctionDeclaration" ||
    node?.type === "FunctionExpression" ||
    node?.type === "ArrowFunctionExpression"
  );
}

function executionBoundary(ancestors: readonly ESTree.Node[]): ESTree.Node | null {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    if (ancestor && (ancestor.type === "Program" || functionLike(ancestor))) return ancestor;
  }
  return null;
}

function directStatementContainer(
  ancestors: readonly ESTree.Node[],
): ESTree.Program | ESTree.BlockStatement | null {
  const declaration = ancestors.at(-2);
  const container = ancestors.at(-3);
  if (declaration?.type !== "VariableDeclaration" || !container) return null;
  return container.type === "Program" || container.type === "BlockStatement" ? container : null;
}

function definitelyPrecedes(left: unknown, right: ESTree.Node): boolean {
  const leftEnd = isNode(left) ? (left as { end?: number }).end : undefined;
  const rightStart = (right as { start?: number }).start;
  return typeof leftEnd === "number" && typeof rightStart === "number" && leftEnd <= rightStart;
}

function containsNode(container: ESTree.Node, node: ESTree.Node): boolean {
  const containerStart = (container as { start?: number }).start;
  const containerEnd = (container as { end?: number }).end;
  const nodeStart = (node as { start?: number }).start;
  const nodeEnd = (node as { end?: number }).end;
  return (
    typeof containerStart === "number" &&
    typeof containerEnd === "number" &&
    typeof nodeStart === "number" &&
    typeof nodeEnd === "number" &&
    containerStart <= nodeStart &&
    nodeEnd <= containerEnd
  );
}

function platformCallSyntaxIndex(program: ESTree.Node): PlatformCallSyntaxIndex {
  const existing = syntaxIndexByProgram.get(program);
  if (existing) return existing;

  const declarators = new WeakMap<ESTree.VariableDeclarator, DeclaratorFacts>();
  const callSites: CallSite[] = [];
  const ancestors: ESTree.Node[] = [];
  let callBudgetExceeded = false;

  const recordCallSite = (node: ESTree.CallExpression | ESTree.NewExpression): void => {
    if (callSites.length >= MAX_PLATFORM_CALL_SITES) {
      callBudgetExceeded = true;
      return;
    }
    const boundary = executionBoundary(ancestors);
    if (boundary) callSites.push({ callee: node.callee, executionBoundary: boundary, node });
  };

  walk(
    program,
    {
      VariableDeclarator(node) {
        const boundary = executionBoundary(ancestors);
        if (!boundary) return;
        declarators.set(node as ESTree.VariableDeclarator, {
          executionBoundary: boundary,
          statementContainer: directStatementContainer(ancestors),
        });
      },
      NewExpression(node) {
        recordCallSite(node as ESTree.NewExpression);
      },
      CallExpression(node) {
        recordCallSite(node as ESTree.CallExpression);
      },
    },
    ancestors,
  );

  const created = { declarators, callSites, callBudgetExceeded };
  syntaxIndexByProgram.set(program, created);
  return created;
}

function mutationPathChanged(
  mutations: MutationQuery,
  path: readonly string[],
  semantics: "authority" | "callable",
): boolean {
  return semantics === "authority"
    ? mutations.isGlobalPathAuthorityLost(path)
    : mutations.isGlobalPathWritten(path);
}

function stablePlatformGlobalResolver(
  {
    program,
    analysis,
    bindingWrites,
    mutations,
    names,
    namespaces = [],
    mutationSemantics = "authority",
  }: PlatformConstructorCallOptions,
  rootMutationSemantics = mutationSemantics,
): StablePlatformGlobalResolver | null {
  const nameSet = new Set(names);
  const namespaceSet = new Set(namespaces);
  const { declarators, callSites, callBudgetExceeded } = platformCallSyntaxIndex(program);

  if (bindingWrites.hasDynamicScope() || callBudgetExceeded) return null;

  const pathIdentityIsStable = (path: readonly string[]): boolean =>
    !mutationPathChanged(mutations, path, mutationSemantics) &&
    !namespaces.some((namespace) =>
      mutationPathChanged(mutations, [namespace, ...path], mutationSemantics),
    );

  const globalIdentityIsStable = (name: string): boolean => {
    const globalChanged =
      rootMutationSemantics === "authority"
        ? mutations.isGlobalAuthorityLost(name)
        : mutations.isGlobalWritten(name);
    return (
      !globalChanged &&
      !mutationPathChanged(mutations, [name], rootMutationSemantics) &&
      !namespaces.some((namespace) =>
        mutationPathChanged(mutations, [namespace, name], rootMutationSemantics),
      )
    );
  };

  const directNamespace = (node: unknown): string | null => {
    const value = unwrapExpression(node);
    if (!isNode(value) || value.type !== "Identifier" || !namespaceSet.has(value.name)) {
      return null;
    }
    if (!analysis.bindings.isPlatformGlobal(value)) return null;
    return mutations.isGlobalAuthorityLost(value.name) ? null : value.name;
  };

  const destructuredName = (
    declaration: ESTree.VariableDeclarator,
    bindingId: number,
  ): ResolvedPlatformGlobal | null => {
    if (declaration.id.type !== "ObjectPattern" || !directNamespace(declaration.init)) return null;
    const facts = declarators.get(declaration);
    if (!facts) return null;
    for (const item of declaration.id.properties) {
      if (item.type !== "Property") continue;
      const property = item as ESTree.ObjectProperty;
      if (property.value.type !== "Identifier") continue;
      const local = property.value;
      const localBinding = analysis.bindings.resolve(local.name, local);
      if (localBinding?.id !== bindingId) continue;
      const name = propertyKeyName(property);
      return name && nameSet.has(name) && declaration.init
        ? { aliasOrigin: { node: declaration.init, qualified: true }, name }
        : null;
    }
    return null;
  };

  const resolve = (
    node: unknown,
    useBoundary: ESTree.Node,
    seen: ReadonlySet<number> = new Set(),
  ): ResolvedPlatformGlobal | null => {
    const value = unwrapExpression(node);
    if (!isNode(value)) return null;

    if (value.type === "MemberExpression") {
      const name = staticPropertyName(value);
      const namespace = directNamespace(value.object);
      return name && namespace && nameSet.has(name) && globalIdentityIsStable(name)
        ? {
            aliasOrigin: seen.size > 0 ? { node: value, qualified: true } : null,
            name,
          }
        : null;
    }

    if (value.type !== "Identifier") return null;
    if (nameSet.has(value.name) && analysis.bindings.isPlatformGlobal(value)) {
      return globalIdentityIsStable(value.name)
        ? {
            aliasOrigin: seen.size > 0 ? { node: value, qualified: false } : null,
            name: value.name,
          }
        : null;
    }

    const binding = analysis.bindings.resolve(value.name, value);
    if (
      !binding ||
      seen.has(binding.id) ||
      bindingWrites.isWritten(binding.id) ||
      binding.declarations.length !== 1 ||
      binding.node.type !== "VariableDeclarator"
    ) {
      return null;
    }
    const declaration = binding.node as ESTree.VariableDeclarator;
    const facts = declarators.get(declaration);
    if (
      !facts?.statementContainer ||
      facts.executionBoundary !== useBoundary ||
      !containsNode(facts.statementContainer, value) ||
      !declaration.init ||
      !definitelyPrecedes(declaration.init, value)
    ) {
      return null;
    }

    const selected = destructuredName(declaration, binding.id);
    if (selected) return globalIdentityIsStable(selected.name) ? selected : null;
    if (declaration.id.type !== "Identifier" || declaration.id.name !== binding.name) return null;
    const next = new Set(seen);
    next.add(binding.id);
    return resolve(declaration.init, facts.executionBoundary, next);
  };

  return { callSites, pathIdentityIsStable, resolve };
}

/**
 * Find calls to platform constructors whose identity is structurally stable.
 *
 * Mutable and path-dependent aliases deliberately stay unknown. This analysis
 * is intended for high-confidence diagnostics where silence is safer than
 * attributing a local replacement to the ServiceNow API or engine.
 */
export function findStablePlatformConstructorCalls({
  program,
  analysis,
  bindingWrites,
  mutations,
  names,
  namespaces = [],
  mutationSemantics = "authority",
}: PlatformConstructorCallOptions): readonly PlatformConstructorCallFinding[] {
  const resolver = stablePlatformGlobalResolver({
    program,
    analysis,
    bindingWrites,
    mutations,
    names,
    namespaces,
    mutationSemantics,
  });
  if (!resolver) return [];

  const findings: PlatformConstructorCallFinding[] = [];
  for (const callSite of resolver.callSites) {
    const resolved = resolver.resolve(callSite.callee, callSite.executionBoundary);
    if (resolved) findings.push({ ...resolved, node: callSite.node });
  }
  return findings;
}

/** Find calls to static methods on structurally stable platform globals. */
export function findStablePlatformStaticMethodCalls({
  methods,
  ...options
}: PlatformStaticMethodCallOptions): readonly PlatformStaticMethodCallFinding[] {
  const methodSets = new Map(
    Object.entries(methods).map(([name, candidates]) => [name, new Set(candidates)]),
  );
  const resolver = stablePlatformGlobalResolver(
    {
      ...options,
      names: [...methodSets.keys()],
    },
    "authority",
  );
  if (!resolver) return [];

  const findings: PlatformStaticMethodCallFinding[] = [];
  for (const callSite of resolver.callSites) {
    if (callSite.node.type !== "CallExpression") continue;
    const direct = unwrapExpression(callSite.callee);
    const targets: Array<{
      readonly helper: "apply" | "bind" | "call" | null;
      readonly member: ESTree.MemberExpression;
    }> = [];
    if (isNode(direct) && direct.type === "MemberExpression") {
      targets.push({ helper: null, member: direct });
      const helper = staticPropertyName(direct);
      const wrapped = unwrapExpression(direct.object);
      if (
        (helper === "call" || helper === "apply") &&
        isNode(wrapped) &&
        wrapped.type === "MemberExpression"
      ) {
        targets.push({ helper, member: wrapped });
      }
    } else if (isNode(direct) && direct.type === "CallExpression") {
      const bindCallee = unwrapExpression(direct.callee);
      const wrapped =
        isNode(bindCallee) &&
        bindCallee.type === "MemberExpression" &&
        staticPropertyName(bindCallee) === "bind"
          ? unwrapExpression(bindCallee.object)
          : null;
      if (isNode(wrapped) && wrapped.type === "MemberExpression") {
        targets.push({ helper: "bind", member: wrapped });
      }
    }

    for (const { helper, member } of targets) {
      const method = staticPropertyName(member);
      if (!method) continue;
      const resolved = resolver.resolve(member.object, callSite.executionBoundary);
      if (!resolved || !methodSets.get(resolved.name)?.has(method)) continue;
      if (!resolver.pathIdentityIsStable([resolved.name, method])) continue;
      if (
        helper &&
        (!resolver.pathIdentityIsStable([resolved.name, method, helper]) ||
          !resolver.pathIdentityIsStable(["Function", "prototype", helper]))
      ) {
        continue;
      }
      findings.push({ ...resolved, method, node: callSite.node });
      break;
    }
  }
  return findings;
}
