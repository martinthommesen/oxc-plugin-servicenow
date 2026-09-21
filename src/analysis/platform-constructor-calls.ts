import type { ESTree } from "@oxlint/plugins";
import {
  isNode,
  nodeEnd,
  nodeStart,
  propertyKeyName,
  unwrapExpression,
  walk,
} from "../utils/ast.js";
import type { BindingWriteQuery } from "./binding-writes.js";
import type { MutationQuery } from "./mutations.js";
import { definitelyPrecedes, staticPropertyName } from "./members.js";
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

export function isNewExpressionFinding(
  finding: PlatformConstructorCallFinding,
): finding is PlatformConstructorCallFinding & { node: ESTree.NewExpression } {
  return finding.node.type === "NewExpression";
}

export interface PlatformStaticMethodCallFinding {
  readonly aliasOrigin: PlatformGlobalAliasOrigin | null;
  /** Arguments received by the platform method after helper normalization. */
  readonly arguments: readonly ESTree.Node[] | null;
  readonly method: string;
  readonly name: string;
  readonly node: ESTree.CallExpression;
}

/** The per-file facts the resolver reads; `FileAnalysis` satisfies it. */
export interface PlatformCallFacts {
  readonly provenance: ProvenanceQuery;
  readonly bindingWrites: BindingWriteQuery;
  readonly mutations: MutationQuery;
}

interface PlatformConstructorCallOptions {
  readonly program: ESTree.Node;
  readonly file: PlatformCallFacts;
  readonly names: readonly string[];
  readonly namespaces?: readonly string[];
  /**
   * Platform API diagnostics require original authority. Engine-compatibility
   * diagnostics only need to know whether a callable polyfill may replace an
   * otherwise unavailable constructor.
   */
  readonly mutationSemantics?: "authority" | "callable";
}

interface PlatformStaticMethodCallOptions extends Omit<PlatformConstructorCallOptions, "names"> {
  readonly methods: Readonly<Record<string, readonly string[]>>;
}

interface DeclaratorFacts {
  readonly executionBoundary: ESTree.Node;
  readonly statementContainer: ESTree.Program | ESTree.BlockStatement | ESTree.ForStatement | null;
}

interface CallSite {
  readonly allowAliases: boolean;
  readonly callee: unknown;
  readonly executionBoundary: ESTree.Node;
  readonly node: ESTree.CallExpression | ESTree.NewExpression;
}

interface PlatformCallSyntaxIndex {
  readonly declarators: WeakMap<ESTree.VariableDeclarator, DeclaratorFacts>;
  readonly callSites: readonly CallSite[];
}

interface ResolvedPlatformGlobal {
  readonly aliasOrigin: PlatformGlobalAliasOrigin | null;
  readonly name: string;
}

interface StablePlatformGlobalResolver {
  readonly callSites: readonly CallSite[];
  readonly pathIdentityIsStable: (path: readonly string[]) => boolean;
  readonly resolve: (
    node: unknown,
    useBoundary: ESTree.Node,
    allowAliases?: boolean,
  ) => ResolvedPlatformGlobal | null;
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
): ESTree.Program | ESTree.BlockStatement | ESTree.ForStatement | null {
  const declaration = ancestors.at(-2);
  const container = ancestors.at(-3);
  if (declaration?.type !== "VariableDeclaration" || !container) return null;
  if (container.type === "Program" || container.type === "BlockStatement") return container;
  return container.type === "ForStatement" && container.init === declaration ? container : null;
}

function containsNode(container: ESTree.Node, node: ESTree.Node): boolean {
  const containerStart = nodeStart(container);
  const containerEnd = nodeEnd(container);
  const start = nodeStart(node);
  const end = nodeEnd(node);
  return (
    containerStart >= 0 &&
    containerEnd >= 0 &&
    start >= 0 &&
    end >= 0 &&
    containerStart <= start &&
    end <= containerEnd
  );
}

function platformCallSyntaxIndex(program: ESTree.Node): PlatformCallSyntaxIndex {
  const existing = syntaxIndexByProgram.get(program);
  if (existing) return existing;

  const declarators = new WeakMap<ESTree.VariableDeclarator, DeclaratorFacts>();
  const callSites: CallSite[] = [];
  const ancestors: ESTree.Node[] = [];

  const recordCallSite = (node: ESTree.CallExpression | ESTree.NewExpression): void => {
    const boundary = executionBoundary(ancestors);
    if (boundary) {
      callSites.push({
        allowAliases: callSites.length < MAX_PLATFORM_CALL_SITES,
        callee: node.callee,
        executionBoundary: boundary,
        node,
      });
    }
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

  const created = { declarators, callSites };
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
    file: { provenance: analysis, bindingWrites, mutations },
    names,
    namespaces = [],
    mutationSemantics = "authority",
  }: PlatformConstructorCallOptions,
  rootMutationSemantics = mutationSemantics,
): StablePlatformGlobalResolver | null {
  const nameSet = new Set(names);
  const namespaceSet = new Set(namespaces);
  const { declarators, callSites } = platformCallSyntaxIndex(program);

  if (bindingWrites.hasDynamicScope()) return null;

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
    allowAliases = true,
  ): ResolvedPlatformGlobal | null => {
    let current = unwrapExpression(node);
    let boundary = useBoundary;
    const seen = new Set<number>();
    while (isNode(current)) {
      if (current.type === "MemberExpression") {
        const name = staticPropertyName(current);
        const namespace = directNamespace(current.object);
        return name && namespace && nameSet.has(name) && globalIdentityIsStable(name)
          ? {
              aliasOrigin: seen.size > 0 ? { node: current, qualified: true } : null,
              name,
            }
          : null;
      }

      if (current.type !== "Identifier") return null;
      if (nameSet.has(current.name) && analysis.bindings.isPlatformGlobal(current)) {
        return globalIdentityIsStable(current.name)
          ? {
              aliasOrigin: seen.size > 0 ? { node: current, qualified: false } : null,
              name: current.name,
            }
          : null;
      }
      if (!allowAliases) return null;

      const binding = analysis.bindings.resolve(current.name, current);
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
        facts.executionBoundary !== boundary ||
        !containsNode(facts.statementContainer, current) ||
        !declaration.init ||
        !definitelyPrecedes(declaration.init, current)
      ) {
        return null;
      }

      const selected = destructuredName(declaration, binding.id);
      if (selected) return globalIdentityIsStable(selected.name) ? selected : null;
      if (declaration.id.type !== "Identifier" || declaration.id.name !== binding.name) return null;
      seen.add(binding.id);
      current = unwrapExpression(declaration.init);
      boundary = facts.executionBoundary;
    }
    return null;
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
export function findStablePlatformConstructorCalls(
  options: PlatformConstructorCallOptions,
): readonly PlatformConstructorCallFinding[] {
  const resolver = stablePlatformGlobalResolver(options);
  if (!resolver) return [];

  const findings: PlatformConstructorCallFinding[] = [];
  for (const callSite of resolver.callSites) {
    const resolved = resolver.resolve(
      callSite.callee,
      callSite.executionBoundary,
      callSite.allowAliases,
    );
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
  const reflectResolver = stablePlatformGlobalResolver({
    ...options,
    names: ["Reflect"],
    mutationSemantics: "authority",
  });
  if (!resolver || !reflectResolver) return [];

  const directArguments = (nodes: readonly ESTree.Node[]): readonly ESTree.Node[] | null =>
    nodes.some((node) => node.type === "SpreadElement") ? null : nodes;
  const arrayArguments = (node: unknown): readonly ESTree.Node[] | null => {
    const array = unwrapExpression(node);
    if (
      !isNode(array) ||
      array.type !== "ArrayExpression" ||
      array.elements.some((element) => element === null)
    ) {
      return null;
    }
    return directArguments(array.elements as ESTree.Node[]);
  };

  const findings: PlatformStaticMethodCallFinding[] = [];
  for (const callSite of resolver.callSites) {
    if (callSite.node.type !== "CallExpression") continue;
    const direct = unwrapExpression(callSite.callee);
    const targets: Array<{
      readonly arguments: readonly ESTree.Node[] | null;
      readonly helper: "apply" | "bind" | "call" | null;
      readonly member: ESTree.MemberExpression;
    }> = [];
    if (isNode(direct) && direct.type === "MemberExpression") {
      targets.push({
        arguments: directArguments(callSite.node.arguments),
        helper: null,
        member: direct,
      });
      const helper = staticPropertyName(direct);
      const wrapped = unwrapExpression(direct.object);
      const reflectApplyTarget = unwrapExpression(callSite.node.arguments[0]);
      if (
        helper === "apply" &&
        reflectResolver.resolve(direct.object, callSite.executionBoundary, callSite.allowAliases)
          ?.name === "Reflect" &&
        reflectResolver.pathIdentityIsStable(["Reflect", "apply"]) &&
        isNode(reflectApplyTarget) &&
        reflectApplyTarget.type === "MemberExpression"
      ) {
        targets.push({
          arguments: arrayArguments(callSite.node.arguments[2]),
          helper: null,
          member: reflectApplyTarget,
        });
      }
      if (
        (helper === "call" || helper === "apply") &&
        isNode(wrapped) &&
        wrapped.type === "MemberExpression"
      ) {
        targets.push({
          arguments:
            helper === "call"
              ? directArguments(callSite.node.arguments.slice(1))
              : arrayArguments(callSite.node.arguments[1]),
          helper,
          member: wrapped,
        });
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
        targets.push({
          arguments: directArguments([...direct.arguments.slice(1), ...callSite.node.arguments]),
          helper: "bind",
          member: wrapped,
        });
      }
    }

    for (const { arguments: semanticArguments, helper, member } of targets) {
      const method = staticPropertyName(member);
      if (!method) continue;
      const resolved = resolver.resolve(
        member.object,
        callSite.executionBoundary,
        callSite.allowAliases,
      );
      if (!resolved || !methodSets.get(resolved.name)?.has(method)) continue;
      if (!resolver.pathIdentityIsStable([resolved.name, method])) continue;
      if (
        helper &&
        (!resolver.pathIdentityIsStable([resolved.name, method, helper]) ||
          !resolver.pathIdentityIsStable(["Function", "prototype", helper]))
      ) {
        continue;
      }
      findings.push({
        ...resolved,
        arguments: semanticArguments,
        method,
        node: callSite.node,
      });
      break;
    }
  }
  return findings;
}
