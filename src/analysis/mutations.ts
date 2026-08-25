import type { ESTree } from "@oxlint/plugins";
import {
  getName,
  getStaticStringValue,
  isNode,
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

export interface MutationQuery {
  /** True when a callable replacement may have been installed for the global. */
  isGlobalWritten(name: string): boolean;
  /** True when a callable replacement may have been installed for the path. */
  isGlobalPathWritten(path: readonly string[]): boolean;
  /** True when a callable replacement may have been installed on the object. */
  isObjectPropertyWritten(object: unknown, property: string): boolean;
  /** True when any write or escape makes the platform global's identity uncertain. */
  isGlobalAuthorityLost(name: string): boolean;
  /** True when any write or escape makes the platform path's identity uncertain. */
  isGlobalPathAuthorityLost(path: readonly string[]): boolean;
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
  authorityObjectProperties: ReadonlySet<string>;
  authorityObjectPropertyWildcards: ReadonlySet<string>;
}

interface MutableMutationFacts {
  readonly globals: Set<string>;
  readonly globalPaths: Set<string>;
  readonly objectProperties: Set<string>;
  readonly objectPropertyWildcards: Set<string>;
}

interface BuiltinReference {
  owner: string;
  method: string;
}

interface BuiltinCall extends BuiltinReference {
  /** Null means the invocation is proven but its effective arguments are unknown. */
  arguments: readonly unknown[] | null;
}

const MAX_NAMESPACE_ESCAPE_DEPTH = 32;

function pathKey(path: readonly string[]): string {
  return JSON.stringify(path);
}

function objectPropertyKey(objectId: number, property: string): string {
  return `${objectId}\0${property}`;
}

function pathWasWritten(paths: ReadonlySet<string>, path: readonly string[]): boolean {
  if (paths.has(pathKey(path))) return true;
  if (path.length > 0 && paths.has(pathKey(["*", path[path.length - 1]!]))) return true;
  for (let length = 1; length < path.length; length += 1) {
    if (paths.has(pathKey([...path.slice(0, length), "*"]))) return true;
  }
  return false;
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
  const { globalPaths, globals, objectProperties, objectPropertyWildcards } = callable;
  const result = (): MutationIndex => ({
    globals,
    globalPaths,
    objectProperties,
    objectPropertyWildcards,
    authorityGlobals: authority.globals,
    authorityGlobalPaths: authority.globalPaths,
    authorityObjectProperties: authority.objectProperties,
    authorityObjectPropertyWildcards: authority.objectPropertyWildcards,
  });
  if (!program) return result();

  const browserRuntime = runtime === "browser";
  const globalThisCanExist =
    browserRuntime || (javascriptMode !== "es5" && javascriptMode !== "compatibility");
  const recordGlobalPathInto = (path: readonly string[], facts: MutableMutationFacts): void => {
    facts.globalPaths.add(pathKey(path));
    if (!GLOBAL_OBJECT_NAMES.has(path[0] ?? "")) return;
    if (path[0] === "globalThis" && !globalThisCanExist) return;
    const normalized = path.slice(1);
    if (normalized.length === 0 || normalized.includes("*")) {
      facts.globals.add("*");
      facts.globalPaths.add(pathKey(["*"]));
    } else if (normalized.length === 1) {
      facts.globals.add(normalized[0]!);
    } else {
      facts.globalPaths.add(pathKey(normalized));
    }
  };

  const recordGlobalPath = (path: readonly string[]): void => {
    recordGlobalPathInto(path, callable);
  };

  const stableAliasValue = (
    node: unknown,
    seen: ReadonlySet<number> = new Set(),
  ): ESTree.Node | null => {
    const value = unwrapExpression(node);
    if (!isNode(value)) return null;
    if (value.type === "SequenceExpression") {
      return stableAliasValue(value.expressions.at(-1), seen);
    }
    if (value.type !== "Identifier") return value;
    const binding = bindings.resolve(value.name, value);
    if (
      !binding ||
      seen.has(binding.id) ||
      bindingWrites.isWritten(binding.id) ||
      binding.declarations.length !== 1 ||
      binding.node.type !== "VariableDeclarator"
    ) {
      return value;
    }
    const declaration = binding.node as ESTree.VariableDeclarator;
    if (
      declaration.id.type !== "Identifier" ||
      declaration.id.name !== binding.name ||
      !declaration.init
    ) {
      return value;
    }
    const next = new Set(seen);
    next.add(binding.id);
    return stableAliasValue(declaration.init, next);
  };

  const authorityGlobalPath = (
    node: unknown,
    seen: ReadonlySet<ESTree.Node> = new Set(),
  ): readonly string[] | null => {
    const direct = unwrapExpression(node);
    if (!isNode(direct) || seen.has(direct)) return null;
    const directSeen = new Set(seen);
    directSeen.add(direct);
    const selected = resolveDestructuredConstMember(direct, bindings);
    if (selected) {
      // A defaulted destructuring binding may still denote the selected
      // platform property. Mutation facts are may-facts, so retain that path
      // even when the fallback could be chosen at runtime.
      const base = authorityGlobalPath(selected.source, directSeen);
      return base ? [...base, selected.property] : null;
    }
    const value = stableAliasValue(direct);
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
    const base = authorityGlobalPath(value.object, next);
    return base ? [...base, property] : null;
  };

  const authorityGlobalRoot = (node: unknown): string | null => {
    const path = authorityGlobalPath(node);
    return path?.[0] ?? null;
  };

  const recordProperty = (
    target: unknown,
    property: string | null,
    facts: MutableMutationFacts = callable,
  ): void => {
    // ServiceNow documents Object.prototype.__proto__ accessors as disallowed
    // in every supported instance mode. Such an assignment cannot establish a
    // usable replacement on the stock runtime.
    if (property === "__proto__") return;
    const value = unwrapExpression(target);
    if (!isNode(value)) return;
    const path =
      facts === authority ? authorityGlobalPath(value) : staticGlobalPath(value, bindings);
    if (path) {
      recordGlobalPathInto([...path, property ?? "*"], facts);
    } else {
      const root =
        facts === authority ? authorityGlobalRoot(value) : staticGlobalRoot(value, bindings);
      if (root) recordGlobalPathInto([root, "*"], facts);
    }
    const object = provenance.ofExpression(value);
    const terminal = stableAliasValue(value) ?? value;
    const terminalName = terminal.type === "Identifier" ? getName(terminal) : null;
    const terminalBinding = terminalName ? bindings.resolve(terminalName, terminal) : null;
    const identityIsStableAllocation = terminal.type === "NewExpression";
    const identityMayAliasNamespace =
      path === null &&
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
        facts.globalPaths.add(pathKey(["*"]));
      } else {
        // The parameter could receive a namespace object (for example Object,
        // DataView.prototype, or globalThis) at any call site.
        facts.globals.add(property);
        facts.globalPaths.add(pathKey(["*", property]));
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

  const recordTarget = (target: unknown, facts: MutableMutationFacts = callable): void => {
    const value = unwrapExpression(target);
    if (!isNode(value)) return;
    if (value.type === "Identifier") {
      const name = getName(value);
      if (name && bindings.isPlatformGlobal(value)) facts.globals.add(name);
      return;
    }
    if (value.type === "MemberExpression") {
      const property = staticPropertyName(value);
      recordProperty(value.object, property, facts);
      return;
    }
    if (value.type === "AssignmentPattern") {
      recordTarget(value.left, facts);
      return;
    }
    if (value.type === "RestElement") {
      recordTarget(value.argument, facts);
      return;
    }
    if (value.type === "ArrayPattern") {
      for (const element of value.elements) recordTarget(element, facts);
      return;
    }
    if (value.type === "ObjectPattern") {
      for (const property of value.properties) {
        if (property.type === "RestElement") recordTarget(property.argument, facts);
        else recordTarget(property.value, facts);
      }
    }
  };

  const staticBuiltin = (node: unknown): BuiltinReference | null => {
    const direct = unwrapExpression(node);
    if (!isNode(direct)) return null;
    const selected = resolveDestructuredConstMember(direct, bindings);
    if (selected) {
      if (selected.fallback !== null && !isDefinitelyNonCallable(selected.fallback, bindings)) {
        return null;
      }
      if (platformGlobalNamespaceAccess(selected.source, bindings) && !globalThisCanExist) {
        return null;
      }
      const owner = resolvePlatformGlobalName(selected.source, bindings);
      return owner ? { owner, method: selected.property } : null;
    }
    const value = resolveConstValue(direct, bindings);
    if (!value) return null;
    if (platformGlobalNamespaceAccess(value, bindings) && !globalThisCanExist) {
      return null;
    }
    if (value.type === "MemberExpression") {
      const method = staticPropertyName(value);
      const owner = resolvePlatformGlobalName(value.object, bindings);
      return owner && method ? { owner, method } : null;
    }
    return null;
  };

  const arrayArguments = (node: unknown): readonly unknown[] | null => {
    const value = resolveConstValue(node, bindings);
    if (value?.type !== "ArrayExpression") return null;
    return value.elements.some((element) => element?.type === "SpreadElement")
      ? null
      : value.elements;
  };

  const directArguments = (arguments_: readonly unknown[]): readonly unknown[] | null =>
    arguments_.some((argument) => isNode(argument) && argument.type === "SpreadElement")
      ? null
      : arguments_;

  const boundBuiltin = (
    node: unknown,
  ): (BuiltinReference & { arguments: readonly unknown[] | null }) | null => {
    const value = resolveConstValue(node, bindings);
    if (value?.type !== "CallExpression") return null;
    const callee = resolveConstValue(value.callee, bindings);
    if (callee?.type !== "MemberExpression" || staticPropertyName(callee) !== "bind") return null;
    const wrapped = staticBuiltin(callee.object);
    return wrapped ? { ...wrapped, arguments: directArguments(value.arguments.slice(1)) } : null;
  };

  const calledBuiltin = (call: ESTree.CallExpression): BuiltinCall | null => {
    const direct = staticBuiltin(call.callee);
    if (direct?.owner === "Reflect" && direct.method === "apply") {
      // ServiceNow documents Reflect.apply as disallowed in every reviewed
      // instance mode, so it cannot establish a replacement on the stock
      // runtime even when its target is a supported Object mutator.
      if (!browserRuntime) return null;
      const target = staticBuiltin(call.arguments[0]);
      return target ? { ...target, arguments: arrayArguments(call.arguments[2]) } : null;
    }
    if (direct) return { ...direct, arguments: directArguments(call.arguments) };

    const callee = resolveConstValue(call.callee, bindings);
    if (callee?.type === "MemberExpression") {
      const helper = staticPropertyName(callee);
      const wrapped = staticBuiltin(callee.object);
      if (wrapped && helper === "call") {
        return { ...wrapped, arguments: directArguments(call.arguments.slice(1)) };
      }
      if (wrapped && helper === "apply") {
        return { ...wrapped, arguments: arrayArguments(call.arguments[1]) };
      }
    }

    const bound = boundBuiltin(call.callee);
    if (!bound) return null;
    const invocationArguments = directArguments(call.arguments);
    return {
      ...bound,
      arguments:
        bound.arguments === null || invocationArguments === null
          ? null
          : [...bound.arguments, ...invocationArguments],
    };
  };

  const definitelyCannotInstallCallable = (node: unknown): boolean => {
    const value = resolveConstValue(node, bindings);
    if (!value) return false;
    if (value.type === "Literal") return true;
    if (value.type === "UnaryExpression" && value.operator === "void") return true;
    if (value.type !== "Identifier" || getName(value) !== "undefined") return false;
    return bindings.isPlatformGlobal(value);
  };

  const descriptorMayInstallCallable = (node: unknown): boolean => {
    const descriptor = resolveConstValue(node, bindings);
    if (!descriptor || descriptor.type !== "ObjectExpression") return true;
    let getterMayInstall = false;
    let hasGetter = false;
    let hasValue = false;
    let valueMayInstall = false;
    for (const item of descriptor.properties) {
      if (item.type === "SpreadElement") return true;
      const property = item as ESTree.ObjectProperty;
      const name = propertyKeyName(property);
      if (!name) return true;
      if (name === "value") {
        hasValue = true;
        valueMayInstall = !definitelyCannotInstallCallable(property.value);
      }
      if (name === "get") {
        hasGetter = true;
        getterMayInstall = !definitelyCannotInstallCallable(property.value);
      }
    }
    // A descriptor containing both data and accessor fields is invalid and
    // cannot install a replacement. Duplicate fields use their final value,
    // which the assignments above deliberately retain.
    if (hasValue && hasGetter) return false;
    return hasValue ? valueMayInstall : getterMayInstall;
  };

  const installableObjectProperties = (
    node: unknown,
    descriptors: boolean,
  ): readonly string[] | null => {
    const object = resolveConstValue(node, bindings);
    if (object && definitelyCannotInstallCallable(object)) return [];
    if (!object || object.type !== "ObjectExpression") return null;
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
  ): void => {
    if (properties === null) {
      recordProperty(target, null, facts);
      return;
    }
    for (const property of properties) recordProperty(target, property, facts);
  };

  const writtenObjectProperties = (node: unknown): readonly string[] | null => {
    // Object.assign ignores null and undefined sources. Treating them as an
    // unknown object would erase otherwise authoritative platform methods.
    if (isDefinitelyNullishValue(node, bindings)) return [];
    const object = stableAliasValue(node);
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

  const escapedNamespaceValues = new WeakSet<ESTree.Node>();
  const recordEscapedNamespaces = (node: unknown, depth = 0): void => {
    if (depth > MAX_NAMESPACE_ESCAPE_DEPTH) return;
    const value = stableAliasValue(node);
    if (!value || escapedNamespaceValues.has(value)) return;
    escapedNamespaceValues.add(value);

    const path = staticGlobalPath(value, bindings);
    if (path) {
      // Passing an object by value cannot replace its owning binding, but an
      // unknown callee can install or replace any property on that object.
      recordGlobalPath([...path, "*"]);
      recordGlobalPathInto([...path, "*"], authority);
      return;
    }

    const authorityPath = authorityGlobalPath(value);
    if (authorityPath) {
      recordGlobalPath(authorityPath.length > 0 ? [...authorityPath, "*"] : ["*"]);
      recordGlobalPathInto([...authorityPath, "*"], authority);
      return;
    }

    const visit = (child: unknown): void => recordEscapedNamespaces(child, depth + 1);
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
      recordTarget(assignment.left, authority);
      if (assignment.operator === "=" && definitelyCannotInstallCallable(assignment.right)) return;
      recordTarget(assignment.left);
    },
    UpdateExpression(node) {
      const target = (node as ESTree.UpdateExpression).argument;
      recordTarget(target, authority);
      recordTarget(target);
    },
    UnaryExpression(node) {
      const expression = node as ESTree.UnaryExpression;
      if (expression.operator === "delete") recordTarget(expression.argument, authority);
    },
    ForInStatement(node) {
      const target = (node as ESTree.ForInStatement).left;
      recordTarget(target, authority);
      recordTarget(target);
    },
    ForOfStatement(node) {
      const target = (node as ESTree.ForOfStatement).left;
      recordTarget(target, authority);
      recordTarget(target);
    },
    NewExpression(node) {
      for (const argument of (node as ESTree.NewExpression).arguments) {
        recordEscapedNamespaces(argument);
      }
    },
    CallExpression(node) {
      const call = node as ESTree.CallExpression;
      const builtin = calledBuiltin(call);
      if (!builtin) {
        if (platformGlobalNamespaceAccess(call.callee, bindings) && !globalThisCanExist) {
          return;
        }
        const direct = staticBuiltin(call.callee);
        if (direct?.owner === "Reflect" && direct.method === "apply" && browserRuntime) {
          // An unresolved target can mutate both its `this` value and values
          // supplied through the arguments list.
          recordEscapedNamespaces(call.arguments[1]);
          recordEscapedNamespaces(call.arguments[2]);
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
        authority.globalPaths.add(pathKey(["*"]));
        authority.objectPropertyWildcards.add("*");
        return;
      }
      const target = effectiveArguments[0];
      if (!target) return;
      if (method === "defineProperty") {
        recordProperty(target, getStaticStringValue(effectiveArguments[1]), authority);
        if (!descriptorMayInstallCallable(effectiveArguments[2])) return;
        recordProperty(target, getStaticStringValue(effectiveArguments[1]));
        return;
      }
      if (ownerName === "Reflect" && method === "set") {
        const property = getStaticStringValue(effectiveArguments[1]);
        recordProperty(target, property, authority);
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
        recordKnownProperties(target, writtenObjectProperties(effectiveArguments[1]), authority);
        recordKnownProperties(target, installableObjectProperties(effectiveArguments[1], true));
        return;
      }
      if (method === "assign") {
        for (const source of effectiveArguments.slice(1)) {
          recordKnownProperties(target, writtenObjectProperties(source), authority);
          recordKnownProperties(target, installableObjectProperties(source, false));
        }
        return;
      }
      if (method === "setPrototypeOf") {
        recordProperty(target, null, authority);
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
    isGlobalPathAuthorityLost(path: readonly string[]) {
      return (
        getIndex().authorityGlobalPaths.has(pathKey(["*"])) ||
        pathWasWritten(getIndex().authorityGlobalPaths, path)
      );
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
