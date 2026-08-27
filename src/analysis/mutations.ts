import type { ESTree } from "@oxlint/plugins";
import {
  getName,
  getStaticStringValue,
  isNode,
  nodeEnd,
  nodeStart,
  propertyKeyName,
  unwrapExpression,
  walk,
} from "../utils/ast.js";
import type { FileBindings } from "./bindings.js";
import type { BindingWriteQuery } from "./binding-writes.js";
import {
  GLOBAL_OBJECT_NAMES,
  platformGlobalNamespaceAccess,
  resolvePlatformGlobalName,
} from "./globals.js";
import {
  isDefinitelyNonCallable,
  isDefinitelyNullishValue,
  resolveConstValue,
  resolveDestructuredConstMember,
  staticPropertyName,
} from "./members.js";
import type { ProvenanceQuery } from "./provenance.js";
import type { JavaScriptMode } from "../types.js";
import {
  type BuiltinCall,
  resolveBuiltinBindCall,
  resolveBuiltinCall,
  resolveBuiltinReference,
} from "./builtin-calls.js";

export interface MutationQuery {
  /** True when a callable replacement may have been installed for the global. */
  isGlobalWritten(name: string): boolean;
  /** True when a callable replacement may have been installed for the path. */
  isGlobalPathWritten(path: readonly string[]): boolean;
  /** True when a callable replacement may have been installed on the object. */
  isObjectPropertyWritten(object: unknown, property: string): boolean;
  /** True when any write or escape makes the platform global's identity uncertain. */
  isGlobalAuthorityLost(name: string): boolean;
  /**
   * True when any write or escape makes the platform path's identity uncertain.
   * A trusted source can be ignored only when it is the sole origin of every matching fact.
   */
  isGlobalPathAuthorityLost(path: readonly string[], ignoredSource?: ESTree.Node): boolean;
  /** True when any write or escape makes the object's platform method identity uncertain. */
  isObjectPropertyAuthorityLost(object: unknown, property: string): boolean;
}

export type MutationRuntime = "instance" | "browser";

interface MutationIndex {
  globals: ReadonlySet<string>;
  globalPaths: ReadonlySet<string>;
  objectProperties: ReadonlySet<string>;
  objectPropertyWildcards: ReadonlySet<string>;
  authorityGlobals: ReadonlySet<string>;
  authorityGlobalPaths: ReadonlySet<string>;
  authorityGlobalPathSources: ReadonlyMap<string, ReadonlySet<ESTree.Node | null>>;
  authorityObjectProperties: ReadonlySet<string>;
  authorityObjectPropertyWildcards: ReadonlySet<string>;
}

interface MutableMutationFacts {
  readonly globals: Set<string>;
  readonly globalPaths: Set<string>;
  readonly objectProperties: Set<string>;
  readonly objectPropertyWildcards: Set<string>;
}

const MAX_NAMESPACE_ESCAPE_DEPTH = 32;
const MAX_REFLECT_APPLY_DEPTH = 16;

function pathKey(path: readonly string[]): string {
  return JSON.stringify(path);
}

function objectPropertyKey(objectId: number, property: string): string {
  return `${objectId}\0${property}`;
}

function pathWasWritten(paths: ReadonlySet<string>, path: readonly string[]): boolean {
  for (const key of affectingPathKeys(path)) {
    if (paths.has(key)) return true;
  }
  return false;
}

function affectingPathKeys(path: readonly string[]): readonly string[] {
  const keys = new Set([pathKey(["*"]), pathKey(path)]);
  if (path.length > 0) keys.add(pathKey(["*", path[path.length - 1]!]));
  for (let length = 1; length < path.length; length += 1) {
    keys.add(pathKey([...path.slice(0, length), "*"]));
  }
  return [...keys];
}

function emptyMutationFacts(): MutableMutationFacts {
  return {
    globals: new Set(),
    globalPaths: new Set(),
    objectProperties: new Set(),
    objectPropertyWildcards: new Set(),
  };
}

function staticGlobalPath(node: unknown, bindings: FileBindings): readonly string[] | null {
  const value = resolveConstValue(node, bindings);
  if (!value) return null;
  if (value.type === "Identifier") {
    const name = resolvePlatformGlobalName(value, bindings);
    return name ? [name] : null;
  }
  if (value.type !== "MemberExpression") return null;
  const property = staticPropertyName(value);
  if (!property) return null;
  const base = staticGlobalPath(value.object, bindings);
  return base ? [...base, property] : null;
}

function staticGlobalRoot(node: unknown, bindings: FileBindings): string | null {
  const value = resolveConstValue(node, bindings);
  if (!value) return null;
  if (value.type === "Identifier") {
    return resolvePlatformGlobalName(value, bindings);
  }
  return value.type === "MemberExpression" ? staticGlobalRoot(value.object, bindings) : null;
}

function buildIndex(
  program: ESTree.Node | undefined,
  bindings: FileBindings,
  bindingWrites: BindingWriteQuery,
  provenance: ProvenanceQuery,
  javascriptMode: JavaScriptMode,
  runtime: MutationRuntime,
): MutationIndex {
  const callable = emptyMutationFacts();
  const authority = emptyMutationFacts();
  const authorityGlobalPathSources = new Map<string, Set<ESTree.Node | null>>();
  const { globalPaths, globals, objectProperties, objectPropertyWildcards } = callable;
  const result = (): MutationIndex => ({
    globals,
    globalPaths,
    objectProperties,
    objectPropertyWildcards,
    authorityGlobals: authority.globals,
    authorityGlobalPaths: authority.globalPaths,
    authorityGlobalPathSources,
    authorityObjectProperties: authority.objectProperties,
    authorityObjectPropertyWildcards: authority.objectPropertyWildcards,
  });
  if (!program) return result();

  const browserRuntime = runtime === "browser";
  const globalThisCanExist =
    browserRuntime || (javascriptMode !== "es5" && javascriptMode !== "compatibility");
  const recordGlobalPathInto = (
    path: readonly string[],
    facts: MutableMutationFacts,
    source?: ESTree.Node,
  ): void => {
    const addPath = (recordedPath: readonly string[]): void => {
      const key = pathKey(recordedPath);
      facts.globalPaths.add(key);
      if (facts !== authority) return;
      const sources = authorityGlobalPathSources.get(key) ?? new Set<ESTree.Node | null>();
      sources.add(source ?? null);
      authorityGlobalPathSources.set(key, sources);
    };
    addPath(path);
    if (!GLOBAL_OBJECT_NAMES.has(path[0] ?? "")) return;
    if (path[0] === "globalThis" && !globalThisCanExist) return;
    const normalized = path.slice(1);
    if (normalized.length === 0 || normalized.includes("*")) {
      facts.globals.add("*");
      addPath(["*"]);
    } else if (normalized.length === 1) {
      facts.globals.add(normalized[0]!);
    } else {
      addPath(normalized);
    }
  };

  const aliasValue = (node: unknown, temporal: boolean): ESTree.Node | null => {
    let value = unwrapExpression(node);
    const seen = new Set<number>();
    while (isNode(value)) {
      if (value.type === "SequenceExpression") {
        value = unwrapExpression(value.expressions.at(-1));
        continue;
      }
      if (value.type !== "Identifier") return value;
      const binding = bindings.resolve(value.name, value);
      const wasWritten = binding
        ? temporal
          ? bindingWrites.isWrittenBeforeInBoundary(binding.id, value)
          : bindingWrites.isWritten(binding.id)
        : false;
      if (
        !binding ||
        seen.has(binding.id) ||
        wasWritten ||
        (binding.kind !== "const" && bindingWrites.hasDynamicScope()) ||
        binding.declarations.length !== 1 ||
        binding.node.type !== "VariableDeclarator"
      ) {
        return value;
      }
      const declaration = binding.node as ESTree.VariableDeclarator;
      const initializerEnd = declaration.init ? nodeEnd(declaration.init as ESTree.Node) : -1;
      const useStart = nodeStart(value);
      if (
        declaration.id.type !== "Identifier" ||
        declaration.id.name !== binding.name ||
        !declaration.init ||
        initializerEnd < 0 ||
        useStart < 0 ||
        initializerEnd > useStart
      ) {
        return value;
      }
      seen.add(binding.id);
      value = unwrapExpression(declaration.init);
    }
    return null;
  };

  const stableAliasValue = (node: unknown): ESTree.Node | null => aliasValue(node, false);
  const authorityAliasValue = (node: unknown): ESTree.Node | null => aliasValue(node, true);

  const aliasGlobalPath = (
    node: unknown,
    temporal: boolean,
    seen: ReadonlySet<ESTree.Node> = new Set(),
  ): readonly string[] | null => {
    const direct = unwrapExpression(node);
    if (!isNode(direct) || seen.has(direct)) return null;
    const directSeen = new Set(seen);
    directSeen.add(direct);
    const selected = resolveDestructuredConstMember(direct, bindings);
    if (selected) {
      // A defaulted destructuring binding may still denote the selected
      // platform property or its fallback. Mutation facts are may-facts, so
      // retain either platform path. Distinct paths collapse to a terminal
      // wildcard rather than selecting one possible runtime owner.
      const selectedBase = aliasGlobalPath(selected.source, temporal, directSeen);
      const selectedPath = selectedBase ? [...selectedBase, selected.property] : null;
      const fallbackPath =
        selected.fallback === null
          ? null
          : aliasGlobalPath(selected.fallback, temporal, directSeen);
      if (!selectedPath) return fallbackPath;
      if (!fallbackPath) return selectedPath;
      return pathKey(selectedPath) === pathKey(fallbackPath) ? selectedPath : ["*"];
    }
    const value = aliasValue(direct, temporal);
    if (!value || seen.has(value)) return null;
    const next = new Set(directSeen);
    next.add(value);
    if (value.type === "Identifier") {
      const name = resolvePlatformGlobalName(value, bindings);
      return name ? [name] : null;
    }
    if (value.type !== "MemberExpression") return null;
    const property = staticPropertyName(value);
    if (!property) return null;
    const base = aliasGlobalPath(value.object, temporal, next);
    return base ? [...base, property] : null;
  };

  const stableGlobalPath = (node: unknown): readonly string[] | null =>
    aliasGlobalPath(node, false);
  const authorityGlobalPath = (node: unknown): readonly string[] | null =>
    aliasGlobalPath(node, true);
  const stableGlobalRoot = (node: unknown): string | null => stableGlobalPath(node)?.[0] ?? null;
  const authorityGlobalRoot = (node: unknown): string | null =>
    authorityGlobalPath(node)?.[0] ?? null;

  const recordProperty = (
    target: unknown,
    property: string | null,
    facts: MutableMutationFacts = callable,
    source?: ESTree.Node,
  ): void => {
    // ServiceNow documents Object.prototype.__proto__ accessors as disallowed
    // in every supported instance mode. Such an assignment cannot establish a
    // usable replacement on the stock runtime.
    if (property === "__proto__") return;
    const value = unwrapExpression(target);
    if (!isNode(value)) return;
    const aliasPath = facts === authority ? authorityGlobalPath(value) : stableGlobalPath(value);
    const path = aliasPath ?? staticGlobalPath(value, bindings);
    if (path) {
      recordGlobalPathInto([...path, property ?? "*"], facts, source);
    } else {
      const aliasRoot = facts === authority ? authorityGlobalRoot(value) : stableGlobalRoot(value);
      const root = aliasRoot ?? staticGlobalRoot(value, bindings);
      if (root) recordGlobalPathInto([root, "*"], facts, source);
    }
    const object = provenance.ofExpression(value);
    const terminal =
      (facts === authority ? authorityAliasValue(value) : stableAliasValue(value)) ?? value;
    const terminalName = terminal.type === "Identifier" ? getName(terminal) : null;
    const terminalBinding = terminalName ? bindings.resolve(terminalName, terminal) : null;
    const terminalWasWrittenBeforeUse =
      terminalBinding !== null &&
      bindingWrites.isWrittenBeforeInBoundary(terminalBinding.id, terminal);
    const identityIsStableAllocation = terminal.type === "NewExpression";
    const identityMayAliasNamespace =
      path === null &&
      !terminalWasWrittenBeforeUse &&
      ((terminal.type === "Identifier" &&
        (terminalBinding?.kind === "param" ||
          terminalBinding?.kind === "let" ||
          terminalBinding?.kind === "var" ||
          terminalBinding?.kind === "catch")) ||
        terminal.type === "CallExpression" ||
        terminal.type === "ConditionalExpression" ||
        terminal.type === "LogicalExpression");
    if (identityMayAliasNamespace) {
      if (property === null) {
        facts.globals.add("*");
        recordGlobalPathInto(["*"], facts, source);
      } else {
        // The parameter could receive a namespace object (for example Object,
        // DataView.prototype, or globalThis) at any call site.
        facts.globals.add(property);
        recordGlobalPathInto(["*", property], facts, source);
      }
    }
    if (object?.objectId !== undefined && identityIsStableAllocation) {
      facts.objectProperties.add(objectPropertyKey(object.objectId, property ?? "*"));
    } else if (object?.objectId !== undefined) {
      // A parameter or otherwise unresolved target can denote different
      // runtime objects at different call sites. Treat the affected property
      // as a may-write for every queried object rather than selecting the one
      // object identity retained by the intraprocedural provenance summary.
      facts.objectPropertyWildcards.add(property ?? "*");
    }
  };

  const recordTarget = (
    target: unknown,
    facts: MutableMutationFacts = callable,
    source?: ESTree.Node,
  ): void => {
    const value = unwrapExpression(target);
    if (!isNode(value)) return;
    if (value.type === "Identifier") {
      const name = getName(value);
      if (name && bindings.isPlatformGlobal(value)) facts.globals.add(name);
      return;
    }
    if (value.type === "MemberExpression") {
      const property = staticPropertyName(value);
      recordProperty(value.object, property, facts, source);
      return;
    }
    if (value.type === "AssignmentPattern") {
      recordTarget(value.left, facts, source);
      return;
    }
    if (value.type === "RestElement") {
      recordTarget(value.argument, facts, source);
      return;
    }
    if (value.type === "ArrayPattern") {
      for (const element of value.elements) recordTarget(element, facts, source);
      return;
    }
    if (value.type === "ObjectPattern") {
      for (const property of value.properties) {
        if (property.type === "RestElement") recordTarget(property.argument, facts, source);
        else recordTarget(property.value, facts, source);
      }
    }
  };

  const stableArrayArguments = (node: unknown): readonly unknown[] | null => {
    const value = stableAliasValue(node);
    if (value?.type !== "ArrayExpression") return null;
    return value.elements.some((element) => element?.type === "SpreadElement")
      ? null
      : value.elements;
  };

  const normalizeReflectApply = (initial: BuiltinCall | null): BuiltinCall | null => {
    let current = initial;
    for (let depth = 0; depth < MAX_REFLECT_APPLY_DEPTH; depth += 1) {
      if (!current || current.owner !== "Reflect" || current.method !== "apply") return current;
      // ServiceNow instance engines reject Reflect.apply. Browser-executed
      // client scripts can invoke it, including recursively through itself.
      if (!browserRuntime || current.arguments === null) return null;
      const target = resolveBuiltinReference(
        current.arguments[0],
        bindings,
        globalThisCanExist,
      );
      if (!target) return null;
      current = { ...target, arguments: stableArrayArguments(current.arguments[2]) };
    }
    return null;
  };

  const definitelyCannotInstallCallable = (node: unknown): boolean =>
    isDefinitelyNonCallable(stableAliasValue(node), bindings);

  const descriptorMayInstallCallable = (node: unknown): boolean => {
    const descriptor = stableAliasValue(node);
    if (!descriptor || descriptor.type !== "ObjectExpression") return true;
    const fields = new Map<
      string,
      { kind: "accessor"; hasGetter: boolean } | { kind: "data"; mayInstall: boolean }
    >();
    for (const item of descriptor.properties) {
      if (item.type === "SpreadElement") return true;
      const property = item as ESTree.ObjectProperty;
      const name = propertyKeyName(property);
      if (!name) return true;
      if (property.kind === "get") {
        fields.set(name, { kind: "accessor", hasGetter: true });
      } else if (property.kind === "set") {
        const current = fields.get(name);
        fields.set(name, {
          kind: "accessor",
          hasGetter: current?.kind === "accessor" && current.hasGetter,
        });
      } else {
        fields.set(name, {
          kind: "data",
          mayInstall: !definitelyCannotInstallCallable(property.value),
        });
      }
    }
    const hasData = fields.has("value") || fields.has("writable");
    const hasAccessor = fields.has("get") || fields.has("set");
    if (hasData && hasAccessor) return false;
    const installed = fields.get(hasData ? "value" : "get");
    return installed?.kind === "accessor" ? installed.hasGetter : Boolean(installed?.mayInstall);
  };

  const installableObjectProperties = (
    node: unknown,
    descriptors: boolean,
  ): readonly string[] | null => {
    const object = stableAliasValue(node);
    if (!object) return null;
    if (object.type !== "ObjectExpression") {
      return definitelyCannotInstallCallable(object) ? [] : null;
    }
    const properties = new Map<string, boolean>();
    for (const item of object.properties) {
      if (item.type === "SpreadElement") return null;
      const property = item as ESTree.ObjectProperty;
      const name = propertyKeyName(property);
      if (!name) return null;
      properties.set(
        name,
        descriptors
          ? descriptorMayInstallCallable(property.value)
          : !definitelyCannotInstallCallable(property.value),
      );
    }
    return [...properties].filter(([, mayInstall]) => mayInstall).map(([name]) => name);
  };

  const recordKnownProperties = (
    target: unknown,
    properties: readonly string[] | null,
    facts: MutableMutationFacts = callable,
    source?: ESTree.Node,
  ): void => {
    if (properties === null) {
      recordProperty(target, null, facts, source);
      return;
    }
    for (const property of properties) recordProperty(target, property, facts, source);
  };

  const writtenObjectProperties = (node: unknown): readonly string[] | null => {
    // Object.assign ignores null and undefined sources. Treating them as an
    // unknown object would erase otherwise authoritative platform methods.
    const object = stableAliasValue(node);
    if (object && isDefinitelyNullishValue(object, bindings)) return [];
    if (!object || object.type !== "ObjectExpression") return null;
    const properties = new Set<string>();
    for (const item of object.properties) {
      if (item.type === "SpreadElement") return null;
      const name = propertyKeyName(item as ESTree.ObjectProperty);
      if (!name) return null;
      properties.add(name);
    }
    return [...properties];
  };

  const escapedNamespaceValues = new WeakMap<ESTree.Node, Set<ESTree.Node | null>>();
  const recordEscapedNamespaces = (
    node: unknown,
    depth = 0,
    source: ESTree.Node | null = isNode(node) ? node : null,
  ): void => {
    if (depth > MAX_NAMESPACE_ESCAPE_DEPTH) return;
    const value = authorityAliasValue(node);
    if (!value) return;
    const seenSources = escapedNamespaceValues.get(value) ?? new Set<ESTree.Node | null>();
    if (seenSources.has(source)) return;
    seenSources.add(source);
    escapedNamespaceValues.set(value, seenSources);

    const path = authorityGlobalPath(value) ?? staticGlobalPath(value, bindings);
    if (path) {
      // Passing an object by value cannot replace its owning binding, but an
      // unknown callee can install or replace any property on that object.
      recordGlobalPathInto([...path, "*"], callable);
      recordGlobalPathInto([...path, "*"], authority, source ?? undefined);
      return;
    }

    const visit = (child: unknown): void => recordEscapedNamespaces(child, depth + 1, source);
    if (value.type === "ArrayExpression") {
      for (const element of value.elements) visit(element);
      return;
    }
    if (value.type === "ObjectExpression") {
      for (const item of value.properties) {
        if (item.type === "SpreadElement") visit(item.argument);
        else visit((item as ESTree.ObjectProperty).value);
      }
      return;
    }
    if (value.type === "SpreadElement") {
      visit(value.argument);
      return;
    }
    if (value.type === "ConditionalExpression") {
      visit(value.consequent);
      visit(value.alternate);
      return;
    }
    if (value.type === "LogicalExpression") {
      visit(value.left);
      visit(value.right);
      return;
    }
    if (value.type === "SequenceExpression") {
      visit(value.expressions.at(-1));
      return;
    }
    if (value.type === "AssignmentExpression" && value.operator === "=") {
      visit(value.right);
    }
  };

  walk(program, {
    AssignmentExpression(node) {
      const assignment = node as ESTree.AssignmentExpression;
      recordTarget(assignment.left, authority, assignment.left as ESTree.Node);
      if (assignment.operator === "=" && definitelyCannotInstallCallable(assignment.right)) return;
      recordTarget(assignment.left);
    },
    UpdateExpression(node) {
      const target = (node as ESTree.UpdateExpression).argument;
      recordTarget(target, authority, target as ESTree.Node);
      recordTarget(target);
    },
    UnaryExpression(node) {
      const expression = node as ESTree.UnaryExpression;
      if (expression.operator === "delete") {
        recordTarget(expression.argument, authority, expression.argument as ESTree.Node);
      }
    },
    ForInStatement(node) {
      const target = (node as ESTree.ForInStatement).left;
      recordTarget(target, authority, target as ESTree.Node);
      recordTarget(target);
    },
    ForOfStatement(node) {
      const target = (node as ESTree.ForOfStatement).left;
      recordTarget(target, authority, target as ESTree.Node);
      recordTarget(target);
    },
    NewExpression(node) {
      for (const argument of (node as ESTree.NewExpression).arguments) {
        recordEscapedNamespaces(argument);
      }
    },
    CallExpression(node) {
      const call = node as ESTree.CallExpression;
      const builtin = normalizeReflectApply(
        resolveBuiltinCall(call, bindings, {
          allowGlobalThis: globalThisCanExist,
          allowReflectApply: browserRuntime,
        }),
      );
      if (!builtin) {
        // In modes without globalThis, resolving a qualified callee throws
        // before arguments are evaluated. Those arguments therefore cannot
        // escape or mutate a platform namespace.
        if (platformGlobalNamespaceAccess(call.callee, bindings) && !globalThisCanExist) return;
        const bound = resolveBuiltinBindCall(call, bindings, globalThisCanExist);
        if (bound?.owner === "Object" || bound?.owner === "Reflect") return;
        const direct = resolveBuiltinReference(call.callee, bindings, globalThisCanExist);
        if (direct?.owner === "Reflect" && direct.method === "apply" && browserRuntime) {
          // An unresolved or spread invocation can expose its target, `this`,
          // and argument list. Walk every syntactic argument so nested arrays
          // and spread aliases cannot hide a client platform object.
          for (const argument of call.arguments) recordEscapedNamespaces(argument);
          return;
        }
        // Object/Reflect intrinsics are modeled below. In particular, the
        // reviewed instance engines reject Reflect mutation helpers, so their
        // arguments must not create fictional writes.
        if (direct?.owner === "Object" || direct?.owner === "Reflect") return;
        for (const argument of call.arguments) recordEscapedNamespaces(argument);
        return;
      }
      const { arguments: effectiveArguments, method, owner: ownerName } = builtin;
      if (ownerName !== "Object" && ownerName !== "Reflect") {
        for (const argument of effectiveArguments ?? call.arguments) {
          recordEscapedNamespaces(argument);
        }
        return;
      }
      if (ownerName === "Reflect" && !browserRuntime) return;
      if (
        ownerName === "Object" &&
        (method === "assign" || method === "setPrototypeOf") &&
        !browserRuntime &&
        !globalThisCanExist
      ) {
        return;
      }
      const mutatesProperties =
        (ownerName === "Object" &&
          (method === "defineProperty" ||
            method === "defineProperties" ||
            method === "assign" ||
            method === "setPrototypeOf")) ||
        (ownerName === "Reflect" &&
          (method === "defineProperty" ||
            method === "deleteProperty" ||
            method === "set" ||
            method === "setPrototypeOf"));
      if (!mutatesProperties) {
        if (ownerName === "Reflect" && method === "construct") {
          if (effectiveArguments === null) {
            for (const argument of call.arguments) recordEscapedNamespaces(argument);
          } else {
            recordEscapedNamespaces(effectiveArguments[1]);
          }
        }
        return;
      }
      if (effectiveArguments === null) {
        if (method !== "deleteProperty") {
          globals.add("*");
          globalPaths.add(pathKey(["*"]));
          objectPropertyWildcards.add("*");
        }
        authority.globals.add("*");
        recordGlobalPathInto(["*"], authority, call);
        authority.objectPropertyWildcards.add("*");
        return;
      }
      const target = effectiveArguments[0];
      if (!target) return;
      if (method === "defineProperty") {
        recordProperty(target, getStaticStringValue(effectiveArguments[1]), authority, call);
        if (!descriptorMayInstallCallable(effectiveArguments[2])) return;
        recordProperty(target, getStaticStringValue(effectiveArguments[1]));
        return;
      }
      if (ownerName === "Reflect" && method === "set") {
        const property = getStaticStringValue(effectiveArguments[1]);
        recordProperty(target, property, authority, call);
        if (!definitelyCannotInstallCallable(effectiveArguments[2])) {
          recordProperty(target, property);
        }
        return;
      }
      if (ownerName === "Reflect" && method === "deleteProperty") {
        recordProperty(target, getStaticStringValue(effectiveArguments[1]), authority);
        return;
      }
      if (method === "defineProperties") {
        recordKnownProperties(
          target,
          writtenObjectProperties(effectiveArguments[1]),
          authority,
          call,
        );
        recordKnownProperties(target, installableObjectProperties(effectiveArguments[1], true));
        return;
      }
      if (method === "assign") {
        for (const source of effectiveArguments.slice(1)) {
          recordKnownProperties(target, writtenObjectProperties(source), authority, call);
          recordKnownProperties(target, installableObjectProperties(source, false));
        }
        return;
      }
      if (method === "setPrototypeOf") {
        recordProperty(target, null, authority, call);
        recordKnownProperties(target, installableObjectProperties(effectiveArguments[1], false));
      }
    },
  });
  return result();
}

export function createMutationQuery(
  program: ESTree.Node | undefined,
  bindings: FileBindings,
  bindingWrites: BindingWriteQuery,
  provenance: ProvenanceQuery,
  javascriptMode: JavaScriptMode,
  runtime: MutationRuntime = "instance",
): MutationQuery {
  let index: MutationIndex | undefined;
  const getIndex = () =>
    (index ??= buildIndex(program, bindings, bindingWrites, provenance, javascriptMode, runtime));
  return Object.freeze({
    isGlobalWritten(name: string) {
      return getIndex().globals.has(name) || getIndex().globals.has("*");
    },
    isGlobalPathWritten(path: readonly string[]) {
      return (
        getIndex().globalPaths.has(pathKey(["*"])) || pathWasWritten(getIndex().globalPaths, path)
      );
    },
    isObjectPropertyWritten(object: unknown, property: string) {
      const objectId = provenance.ofExpression(object)?.objectId;
      return (
        getIndex().objectPropertyWildcards.has(property) ||
        getIndex().objectPropertyWildcards.has("*") ||
        (objectId !== undefined &&
          (getIndex().objectProperties.has(objectPropertyKey(objectId, property)) ||
            getIndex().objectProperties.has(objectPropertyKey(objectId, "*"))))
      );
    },
    isGlobalAuthorityLost(name: string) {
      return getIndex().authorityGlobals.has(name) || getIndex().authorityGlobals.has("*");
    },
    isGlobalPathAuthorityLost(path: readonly string[], ignoredSource?: ESTree.Node) {
      const current = getIndex();
      if (!ignoredSource) return pathWasWritten(current.authorityGlobalPaths, path);
      for (const key of affectingPathKeys(path)) {
        if (!current.authorityGlobalPaths.has(key)) continue;
        const sources = current.authorityGlobalPathSources.get(key);
        if (!sources) return true;
        for (const source of sources) {
          if (source !== ignoredSource) return true;
        }
      }
      return false;
    },
    isObjectPropertyAuthorityLost(object: unknown, property: string) {
      const objectId = provenance.ofExpression(object)?.objectId;
      return (
        getIndex().authorityObjectPropertyWildcards.has(property) ||
        getIndex().authorityObjectPropertyWildcards.has("*") ||
        (objectId !== undefined &&
          (getIndex().authorityObjectProperties.has(objectPropertyKey(objectId, property)) ||
            getIndex().authorityObjectProperties.has(objectPropertyKey(objectId, "*"))))
      );
    },
  });
}
