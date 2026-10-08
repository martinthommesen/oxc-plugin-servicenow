import {
  createPathValueResolver,
  evaluatedConstantValue,
  resolveBinding,
  savedExpressionValue,
} from "./path-values.js";
import { createControlFlowVisitor } from "./path-control-flow.js";
import type {
  AbruptCompletion,
  BindingId,
  CallableValues,
  ClassValue,
  EnvState,
  EvaluatedValue,
  LiteralArgumentShape,
  LiteralArgumentValue,
  ObjectId,
  PathAnalysisOptions,
  PathAnalysisOutcome,
  PathRefInput,
  SharedRecord,
} from "./path-types.js";
import {
  BUDGET_EXCEEDED,
  MAX_PATH_DEPTH,
  defaultMaxWork,
  exhaustedPathAnalysis,
  spendWork,
  type WorkBudget,
} from "./path-budget.js";
import {
  cloneRecord,
  completionPaths,
  mergeRecords,
  mergeMany,
  pathWithoutAlternatives,
  replaceWith,
  setCompletion,
  snapshotState,
  type MergePolicy,
} from "./path-environment.js";
import type { ESTree } from "@oxlint/plugins";
import {
  getName,
  getStringValue,
  isNode,
  isValueReference,
  objectProperty,
  propertyKeyName,
  TRANSPARENT_WRAPPER_TYPES,
  unwrapExpression,
  visitChildren,
  walk,
} from "../utils/ast.js";
import {
  isFunctionLike,
  type FileBindings,
  type ImmediateFunction,
  type ScopeNode,
} from "./bindings.js";
import {
  isDefinitelyNonCallable,
  isDefinitelyUndefinedValue,
  staticPropertyName,
} from "./members.js";
import { constantValue } from "./constant-value.js";
import { directPlatformGlobalName, GLOBAL_OBJECT_NAMES } from "./globals.js";

type InvocationArguments =
  | { readonly kind: "positional"; readonly values: readonly EvaluatedValue[] }
  | { readonly kind: "uncertain" };

type FunctionExecution = "body" | "parameters";

const OBJECT_PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  "constructor",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "toString",
  "valueOf",
  "__proto__",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);
const LITERAL_INTRINSIC_PROPERTIES: ReadonlyMap<string, string> = new Map([
  ["Array", "prototype"],
  ["Symbol", "iterator"],
  ["Object", "prototype"],
]);

interface ClassValueCache {
  readonly choices: Map<ImmediateFunction | ClassValue | undefined, ClassValueCache>;
  value?: ClassValue;
}

type StaticAccessorKind = "get" | "set";
type StaticPropertyKey = string | null;
type StaticPropertyPresence = "absent" | "possible" | "present";
type StaticPropertyEvent =
  | { readonly property: null; readonly order: number; readonly kind: "opaque" }
  | { readonly property: StaticPropertyKey; readonly order: number; readonly kind: "data" }
  | {
      readonly property: StaticPropertyKey;
      readonly order: number;
      readonly kind: StaticAccessorKind;
      readonly fn: ImmediateFunction;
    };

interface StaticAccessors {
  readonly getters: readonly ImmediateFunction[];
  readonly setters: readonly ImmediateFunction[];
}

interface StaticMemberReference {
  readonly values: readonly ClassValue[];
  readonly property: StaticPropertyKey;
}

interface OwnStaticAccessors extends StaticAccessors {
  readonly presence: StaticPropertyPresence;
}

type ClassFieldReplay = "continue" | "opaque";
type ClassConstructorReplay = ClassFieldReplay | "opaque-after-fields";
type ClassSuperArguments =
  | { readonly kind: "implicit" }
  | { readonly kind: "explicit"; readonly arguments: ESTree.CallExpression["arguments"] }
  | { readonly kind: "opaque" };
type CallableEscapePolicy = "inspect" | "captures-only";

interface ClassFieldPath<T> {
  readonly state: EnvState<T>;
  readonly replay: ClassFieldReplay;
}

interface ClassFieldFrame<T> {
  readonly state: EnvState<T>;
  readonly value: ClassValue;
  readonly bases: CallableValues;
  readonly replay: ClassConstructorReplay;
  readonly arguments: InvocationArguments;
  readonly paths: ClassFieldPath<T>[];
  readonly pending: ClassFieldPath<T>[];
  nextBase: number;
}

function scopeContains(scope: ScopeNode | null, block: ESTree.Node): boolean {
  let current = scope;
  while (current) {
    if (current.block === block) return true;
    current = current.parent;
  }
  return false;
}

function capturedBindings(
  fn: ESTree.Node,
  bindings: FileBindings,
  budget?: WorkBudget,
  implicitCapture?: (node: ESTree.Node) => BindingId | undefined,
): BindingId[] {
  const found = new Set<BindingId>();
  const ancestors: ESTree.Node[] = [];
  const visit = (node: unknown): void => {
    if (!isNode(node)) return;
    if (ancestors.length >= MAX_PATH_DEPTH) throw BUDGET_EXCEEDED;
    if (budget) spendWork(budget);
    if ((fn.type === "ClassDeclaration" || fn.type === "ClassExpression") && node === fn.superClass)
      return;
    ancestors.push(node);
    if (node.type === "Identifier" && isValueReference(node, ancestors)) {
      const binding = bindings.resolve(getName(node) ?? "", node, ancestors);
      const declared = binding ? bindings.scopeById(binding.scopeId) : null;
      if (binding && !scopeContains(declared, fn)) found.add(binding.id);
      else if (!binding) {
        const captured = implicitCapture?.(node);
        if (captured !== undefined) found.add(captured);
      }
    }
    visitChildren(node, (child) => visit(child));
    ancestors.pop();
  };
  visit(fn);
  return [...found];
}

/**
 * Path-sensitive tracker keyed by lexical binding identity and runtime object
 * identity. Abrupt completions do not join into later statements.
 */
export function analyzePathBindings<T>(options: PathAnalysisOptions<T>): PathAnalysisOutcome {
  const {
    program,
    analysis,
    kinds,
    emptyData,
    cloneData: domainCloneData,
    mergeData: domainMergeData,
    mergeDistinctData,
    equalsData: domainEqualsData,
    dataWork,
    onCall,
    onRef,
    onValue,
    analyzeUncalledFunctions = true,
    stopAtAwait = false,
    retainUnboundRecords = true,
    onExit,
    maxWork = defaultMaxWork(program),
  } = options;
  if (!Number.isSafeInteger(maxWork) || maxWork < 1) {
    throw new RangeError("path analysis maxWork must be a positive safe integer");
  }
  const budget: WorkBudget = { remaining: maxWork };
  const chargeData = (data: T): void => {
    if (dataWork) spendWork(budget, dataWork(data));
  };
  const cloneData = (data: T): T => {
    chargeData(data);
    return domainCloneData(data);
  };
  const mergeData = (left: T, right: T): T => {
    chargeData(left);
    chargeData(right);
    return domainMergeData(left, right);
  };
  const equalsData = (left: T, right: T): boolean => {
    chargeData(left);
    chargeData(right);
    return domainEqualsData(left, right);
  };
  const bindings = analysis.bindings;
  let nextObjectId = 1;
  const alloc = (): ObjectId => {
    nextObjectId += 1;
    return nextObjectId;
  };
  const ancestors: ESTree.Node[] = [];
  const newExpressionIds = new WeakMap<ESTree.Node, ObjectId>();
  const retainedPlatformObjectIds = new Set<ObjectId>();
  const hoistedFunctions = new Map<BindingId, CallableValues>();
  const directFunctionOrigins = new Map<BindingId, Set<ImmediateFunction>>();
  const callableBindings = new Set<BindingId>();
  const referencedBindings = new Set<BindingId>();
  const prepassAncestors: ESTree.Node[] = [];
  let referenceWork = 0;
  const invokedFunctions = new WeakSet<ImmediateFunction>();
  const inspectedFunctions = new WeakSet<ImmediateFunction>();
  const requiredFunctionInspections = new WeakSet<ImmediateFunction>();
  const inspectionFunctions = new WeakMap<ImmediateFunction, Map<BindingId, CallableValues>>();
  const pendingFunctions = new Map<ImmediateFunction, number>();
  const readyFunctions: ImmediateFunction[] = [];
  let nextReadyFunction = 0;
  const functionCallees = new Map<ImmediateFunction, Set<ImmediateFunction>>();
  const functionCallers = new Map<ImmediateFunction, Set<ImmediateFunction>>();
  const activeFunctions = new Set<ESTree.Node>();
  const functionCaptures = new WeakMap<ESTree.Node, readonly BindingId[]>();
  const argumentObjectIds = new WeakMap<ImmediateFunction, ObjectId>();
  const argumentIdentities = new Set<ObjectId>();
  const classValues = new WeakMap<ESTree.Class, ClassValueCache>();
  const classConstructorReplay = new WeakMap<ESTree.Class, ClassConstructorReplay>();
  const classSuperArguments = new WeakMap<ESTree.Class, ClassSuperArguments>();
  const callableIdentities = new WeakMap<ImmediateFunction | ClassValue, ObjectId>();
  const activeClasses = new Set<ClassValue>();
  const callableIdentity = (value: ImmediateFunction | ClassValue | undefined): ObjectId => {
    if (!value) return 0;
    let id = callableIdentities.get(value);
    if (id === undefined) {
      id = alloc();
      callableIdentities.set(value, id);
    }
    return id;
  };
  // Equivalent definitions must reuse their value identity for loop fixpoints.
  const classValue = (node: ESTree.Class, selected: CallableValues): ClassValue => {
    spendWork(budget, 1 + selected.length);
    const bases = [...new Set(selected)];
    for (const base of bases) callableIdentity(base);
    bases.sort((left, right) => {
      spendWork(budget);
      return callableIdentity(left) - callableIdentity(right);
    });
    const root: ClassValueCache = classValues.get(node) ?? { choices: new Map() };
    classValues.set(node, root);
    let cache = root;
    for (const base of bases) {
      spendWork(budget);
      let next: ClassValueCache | undefined = cache.choices.get(base);
      if (!next) {
        next = { choices: new Map() };
        cache.choices.set(base, next);
      }
      cache = next;
    }
    return (cache.value ??= { type: "ClassValue", node, bases });
  };
  const mappedArguments = new Map<ObjectId, ReadonlyMap<number, BindingId>>();
  const argumentObjectId = (fn: ImmediateFunction): ObjectId => {
    const existing = argumentObjectIds.get(fn);
    if (existing !== undefined) return existing;
    const objectId = alloc();
    argumentObjectIds.set(fn, objectId);
    argumentIdentities.add(objectId);
    return objectId;
  };
  const argumentsBinding = (node: ESTree.Node): BindingId | undefined => {
    if (getName(node) !== "arguments" || resolveBinding(bindings, node, ancestors))
      return undefined;
    let scope = bindings.scopeForNode(node, ancestors);
    while (scope) {
      if (isFunctionLike(scope.block) && scope.block.type !== "ArrowFunctionExpression") {
        return -argumentObjectId(scope.block);
      }
      scope = scope.parent;
    }
    return undefined;
  };
  const forgetMappedArguments = (
    state: EnvState<T>,
    objectId: ObjectId | undefined,
    escaped = false,
    index?: number,
  ): void => {
    if (objectId === undefined) return;
    const mapped = mappedArguments.get(objectId);
    if (!mapped) return;
    const ids = index === undefined ? mapped.values() : [mapped.get(index)];
    for (const id of ids) {
      spendWork(budget);
      if (id === undefined) continue;
      state.env.set(id, undefined);
      state.functions.delete(id);
      if (escaped) state.constants.set(id, null);
      else if (state.constants.get(id) !== null) state.constants.delete(id);
    }
  };
  const forgetMappedArgumentWrite = (state: EnvState<T>, member: ESTree.MemberExpression): void => {
    spendWork(budget);
    const receiver = objectFromExpr(state, member.object);
    let property = staticPropertyName(member);
    if (property === null && member.computed) {
      const key = unwrapExpression(member.property);
      if (isNode(key) && key.type === "Literal" && typeof key.value === "number")
        property = String(key.value);
      else if (
        isNode(key) &&
        key.type === "UnaryExpression" &&
        (key.operator === "-" || key.operator === "+")
      ) {
        const operand = unwrapExpression(key.argument);
        if (isNode(operand) && operand.type === "Literal" && typeof operand.value === "number")
          property = String(key.operator === "-" ? -operand.value : operand.value);
      }
    }
    if (property === null) {
      forgetMappedArguments(state, receiver);
      return;
    }
    const index = Number(property);
    if (String(index) === property) forgetMappedArguments(state, receiver, false, index);
  };
  const hasStrictDirective = (node: unknown): boolean => {
    if (!isNode(node)) return false;
    const body = node.type === "Program" || node.type === "BlockStatement" ? node.body : [];
    for (const statement of body) {
      spendWork(budget);
      if (
        statement.type !== "ExpressionStatement" ||
        statement.expression.type !== "Literal" ||
        typeof statement.expression.value !== "string"
      )
        break;
      const raw = statement.expression.raw;
      if (raw === '"use strict"' || raw === "'use strict'") return true;
    }
    return false;
  };
  const hasMappedArguments = (fn: ImmediateFunction): boolean => {
    if (
      fn.type === "ArrowFunctionExpression" ||
      (program.type === "Program" && program.sourceType === "module")
    )
      return false;
    spendWork(budget, fn.params.length);
    if (!fn.params.every((param) => param.type === "Identifier" && param.name !== "arguments"))
      return false;
    let scope = bindings.scopeForNode(fn);
    while (scope) {
      spendWork(budget);
      if (scope.kind === "class") return false;
      if (
        (isFunctionLike(scope.block) && hasStrictDirective(scope.block.body)) ||
        (scope.block.type === "Program" && hasStrictDirective(scope.block))
      )
        return false;
      scope = scope.parent;
    }
    return true;
  };
  let hasLogicalAssignments = false;
  let hasWithStatement = false;
  let hasClassHeritage = false;
  let arrayIterationUncertain = false;
  let objectPrototypeUncertain = false;
  const constantBindings = new Set<BindingId>();
  const constantSources: Array<{ left: ESTree.Node; right: ESTree.Node | null }> = [];
  const constantInvocations: Array<
    ESTree.CallExpression | ESTree.NewExpression | ESTree.TaggedTemplateExpression
  > = [];
  const withCaptureBindings = new WeakMap<ESTree.Node, readonly BindingId[]>();
  const tryThrowPaths: EnvState<T>[][] = [];
  const mergePolicy: MergePolicy<T> = {
    budget,
    emptyData,
    mergeData,
    cloneData,
    mergeDistinctData,
    alloc,
    retainUnboundRecords,
    retainedObjectIds: retainedPlatformObjectIds,
    argumentIdentities,
  };

  const recordPossibleThrow = (state: EnvState<T>): void => {
    const paths = tryThrowPaths[tryThrowPaths.length - 1];
    if (!paths || state.completion !== "normal") return;
    const possibleThrow = snapshotState(state, cloneData, budget);
    setCompletion(possibleThrow, "throw");
    paths.push(possibleThrow);
  };

  const capturesOf = (
    fn: ESTree.Node | ClassValue,
    captureBudget = hasLogicalAssignments ? budget : undefined,
  ): readonly BindingId[] => {
    const node = fn.type === "ClassValue" ? fn.node : fn;
    const existing = functionCaptures.get(node);
    if (existing) return existing;
    const captures = capturedBindings(node, bindings, captureBudget, (reference) => {
      const id = argumentsBinding(reference);
      const own = isFunctionLike(node) ? argumentObjectIds.get(node) : undefined;
      return id !== undefined && id !== (own === undefined ? undefined : -own) ? id : undefined;
    });
    functionCaptures.set(node, captures);
    return captures;
  };

  const rememberFunctionOrigin = (id: BindingId, fn: ImmediateFunction): void => {
    const functions = directFunctionOrigins.get(id) ?? new Set<ImmediateFunction>();
    functions.add(fn);
    directFunctionOrigins.set(id, functions);
  };

  const literalIntrinsicMayEscape = (
    node: ESTree.Node,
    sensitiveProperty: string | undefined,
  ): boolean => {
    let child = node;
    let index = prepassAncestors.length - 2;
    let parent = prepassAncestors[index];
    for (let depth = 0; parent && depth < MAX_PATH_DEPTH; depth += 1) {
      if (
        !TRANSPARENT_WRAPPER_TYPES.has(parent.type) ||
        !("expression" in parent) ||
        parent.expression !== child
      )
        break;
      referenceWork += 1;
      child = parent;
      parent = prepassAncestors[--index];
    }
    if (parent?.type === "MemberExpression" && parent.object === child) {
      const property = staticPropertyName(parent);
      if (property !== null && property !== sensitiveProperty) return false;
    }
    return true;
  };

  const isIntrinsicPrototypeLookup = (node: unknown): boolean => {
    const callee = unwrapExpression(node);
    if (
      !isNode(callee) ||
      callee.type !== "MemberExpression" ||
      staticPropertyName(callee) !== "getPrototypeOf"
    )
      return false;
    const receiver = directPlatformGlobalName(callee.object, bindings);
    return receiver === "Object" || receiver === "Reflect";
  };

  const literalPrototypeAncestryExposed = (node: ESTree.Node): boolean => {
    let child = node;
    let index = prepassAncestors.length - 2;
    for (let depth = 0; depth < MAX_PATH_DEPTH; depth += 1) {
      const parent = prepassAncestors[index--];
      if (!parent) return false;
      referenceWork += 1;
      if (
        TRANSPARENT_WRAPPER_TYPES.has(parent.type) &&
        "expression" in parent &&
        parent.expression === child
      ) {
        child = parent;
        continue;
      }
      if (parent.type === "MemberExpression" && parent.object === child) {
        const property = staticPropertyName(parent);
        if (property === null || property === "__proto__") return true;
        child = parent;
        continue;
      }
      return (
        parent.type === "CallExpression" &&
        parent.arguments[0] === child &&
        isIntrinsicPrototypeLookup(parent.callee)
      );
    }
    return true;
  };

  const noteLiteralIntrinsicReference = (node: ESTree.Node): void => {
    if (arrayIterationUncertain && objectPrototypeUncertain) return;
    const name = directPlatformGlobalName(node, bindings);
    const sensitiveProperty = LITERAL_INTRINSIC_PROPERTIES.get(name ?? "");
    const namespace = GLOBAL_OBJECT_NAMES.has(name ?? "");
    if (
      (sensitiveProperty === undefined && !namespace) ||
      !literalIntrinsicMayEscape(node, sensitiveProperty)
    )
      return;
    if (namespace) {
      arrayIterationUncertain = true;
      objectPrototypeUncertain = true;
      return;
    }
    if (name === "Object") objectPrototypeUncertain = true;
    else arrayIterationUncertain = true;
  };

  // Assignment origins are dependency metadata, not hoisted runtime values.
  // Captured values remain temporal even when a binding has several origins.
  walk(
    program,
    {
      Identifier(node) {
        referenceWork += 1;
        const parent = prepassAncestors.at(-2);
        if (
          (parent?.type === "ClassDeclaration" || parent?.type === "ClassExpression") &&
          parent.id === node
        )
          return;
        if (!isValueReference(node, prepassAncestors)) return;
        if (
          node.type === "Identifier" &&
          (LITERAL_INTRINSIC_PROPERTIES.has(node.name) || GLOBAL_OBJECT_NAMES.has(node.name))
        )
          noteLiteralIntrinsicReference(node);
        const binding = resolveBinding(bindings, node, prepassAncestors);
        if (binding) referencedBindings.add(binding.id);
      },
      AssignmentPattern(node) {
        if (node.type === "AssignmentPattern")
          constantSources.push({ left: node.left, right: node.right });
      },
      WithStatement() {
        referenceWork += 1;
        hasWithStatement = true;
      },
      MemberExpression(node) {
        referenceWork += 1;
        if (node.type !== "MemberExpression") return;
        if (arrayIterationUncertain && objectPrototypeUncertain) return;
        const property = staticPropertyName(node);
        const receiver = unwrapExpression(node.object);
        let ownNonIntrinsicConstructor = false;
        if (
          property === "constructor" &&
          isNode(receiver) &&
          receiver.type === "ObjectExpression"
        ) {
          referenceWork += receiver.properties.length;
          const own = objectProperty(receiver, property);
          ownNonIntrinsicConstructor =
            own.kind === "known" &&
            own.property.kind === "init" &&
            (isFunctionLike(unwrapExpression(own.property.value)) ||
              isDefinitelyNonCallable(own.property.value, bindings)) &&
            !literalPrototypeAncestryExposed(node);
        }
        if (
          (property === "constructor" || property === "__proto__") &&
          isNode(receiver) &&
          (receiver.type === "ObjectExpression" || receiver.type === "ArrayExpression") &&
          !ownNonIntrinsicConstructor &&
          (property === "__proto__" || literalIntrinsicMayEscape(node, "prototype"))
        ) {
          arrayIterationUncertain = true;
          objectPrototypeUncertain = true;
        }
        if (LITERAL_INTRINSIC_PROPERTIES.has(property ?? "")) noteLiteralIntrinsicReference(node);
      },
      CallExpression(node) {
        referenceWork += 1;
        if (node.type !== "CallExpression" || (arrayIterationUncertain && objectPrototypeUncertain))
          return;
        if (!isIntrinsicPrototypeLookup(node.callee)) return;
        const argument = unwrapExpression(node.arguments[0]);
        if (
          isNode(argument) &&
          (argument.type === "ObjectExpression" || argument.type === "ArrayExpression")
        ) {
          arrayIterationUncertain = true;
          objectPrototypeUncertain = true;
        }
      },
      AssignmentExpression(node) {
        if (node.type !== "AssignmentExpression") return;
        const logicalAssignment = ["&&=", "||=", "??="].includes(node.operator);
        if (logicalAssignment) {
          hasLogicalAssignments = true;
          const binding = resolveBinding(bindings, node.left, []);
          if (binding) constantBindings.add(binding.id);
        }
        if (node.operator === "=" || logicalAssignment) {
          constantSources.push({ left: node.left, right: node.right });
        }
        const value = unwrapExpression(node.right);
        if (isNode(value) && (isFunctionLike(value) || value.type === "ClassExpression")) {
          const binding = resolveBinding(bindings, node.left, []);
          if (binding) {
            callableBindings.add(binding.id);
            if (isFunctionLike(value) && (node.operator === "=" || logicalAssignment))
              rememberFunctionOrigin(binding.id, value);
          }
        }
      },
      FunctionDeclaration(node) {
        if (!isFunctionLike(node)) return;
        const id = node.id;
        const name = getName(id);
        if (!id || !name) return;
        const binding = bindings.resolve(name, id);
        if (binding) {
          hoistedFunctions.set(binding.id, [node]);
          rememberFunctionOrigin(binding.id, node);
          callableBindings.add(binding.id);
        }
      },
      VariableDeclarator(node) {
        const declaration = node as ESTree.VariableDeclarator;
        constantSources.push({ left: declaration.id, right: declaration.init });
        const id = unwrapExpression(declaration.id);
        const init = unwrapExpression(declaration.init);
        if (!isNode(id) || id.type !== "Identifier" || !isNode(init) || !isFunctionLike(init))
          return;
        const binding = bindings.resolve(getName(id) ?? "", id);
        if (binding) {
          rememberFunctionOrigin(binding.id, init);
          callableBindings.add(binding.id);
        }
      },
    },
    prepassAncestors,
  );
  walk(program, {
    ClassDeclaration(node) {
      referenceWork += 1;
      if (node.type === "ClassDeclaration" && node.superClass) hasClassHeritage = true;
    },
    ClassExpression(node) {
      referenceWork += 1;
      if (node.type === "ClassExpression" && node.superClass) hasClassHeritage = true;
    },
    CallExpression(node) {
      if (node.type === "CallExpression") constantInvocations.push(node);
    },
    NewExpression(node) {
      if (node.type === "NewExpression") constantInvocations.push(node);
    },
    TaggedTemplateExpression(node) {
      if (node.type === "TaggedTemplateExpression") constantInvocations.push(node);
    },
  });

  // Origin edges order isolated inspection; only a selected runtime invocation
  // can suppress it. A future assignment or a skipped call is not evidence.
  const rememberInspectionOrder = (
    invocation: ESTree.CallExpression | ESTree.NewExpression | ESTree.TaggedTemplateExpression,
    callee: ImmediateFunction,
  ): void => {
    spendWork(budget);
    const caller = bindings.executionBoundaryForNode(invocation)?.block;
    if (!caller || !isFunctionLike(caller)) return;
    const callees = functionCallees.get(caller) ?? new Set<ImmediateFunction>();
    if (callees.has(callee)) return;
    callees.add(callee);
    functionCallees.set(caller, callees);
    const callers = functionCallers.get(callee) ?? new Set<ImmediateFunction>();
    callers.add(caller);
    functionCallers.set(callee, callers);
  };

  const rememberInspectionFunction = (
    state: EnvState<T>,
    fn: ImmediateFunction,
  ): ImmediateFunction[] => {
    if (!analyzeUncalledFunctions) return [];
    spendWork(budget);
    const pending: ImmediateFunction[] = [];
    const functions = inspectionFunctions.get(fn) ?? new Map<BindingId, CallableValues>();
    for (const id of capturesOf(fn, budget)) {
      const prior = functions.get(id) ?? [];
      const captured = state.functions.get(id) ?? [undefined];
      spendWork(budget, 1 + prior.length + captured.length * 2);
      functions.set(id, [...new Set([...prior, ...captured])]);
      for (const callable of captured) {
        if (callable && isFunctionLike(callable)) pending.push(callable);
      }
    }
    inspectionFunctions.set(fn, functions);
    return pending;
  };

  const rememberInspectionFunctions = (state: EnvState<T>, fn: ImmediateFunction): void => {
    if (!analyzeUncalledFunctions) return;
    const pending = [fn];
    const seen = new Set<ImmediateFunction>();
    while (pending.length) {
      spendWork(budget);
      const current = pending.pop();
      if (!current || seen.has(current) || inspectedFunctions.has(current)) continue;
      seen.add(current);
      for (const captured of rememberInspectionFunction(state, current)) pending.push(captured);
    }
  };

  const hasInspectableFunctionSyntax = (fn: ImmediateFunction): boolean =>
    fn.params.length > 0 || fn.body?.type !== "BlockStatement" || fn.body.body.length > 0;

  const deferFunctionInspection = (fn: ImmediateFunction, state: EnvState<T>): void => {
    if (
      (invokedFunctions.has(fn) && !requiredFunctionInspections.has(fn)) ||
      inspectedFunctions.has(fn)
    )
      return;
    rememberInspectionFunction(state, fn);
    if (pendingFunctions.has(fn)) return;
    let callers = 0;
    for (const caller of functionCallers.get(fn) ?? []) {
      spendWork(budget);
      if (pendingFunctions.has(caller)) callers += 1;
    }
    pendingFunctions.set(fn, callers);
    for (const callee of functionCallees.get(fn) ?? []) {
      spendWork(budget);
      const count = pendingFunctions.get(callee);
      if (count !== undefined) pendingFunctions.set(callee, count + 1);
    }
    if (!callers) readyFunctions.push(fn);
  };

  const requireFunctionInspection = (state: EnvState<T>, fn: ImmediateFunction): void => {
    if (!analyzeUncalledFunctions || !hasInspectableFunctionSyntax(fn)) return;
    spendWork(budget);
    requiredFunctionInspections.add(fn);
    rememberInspectionFunctions(state, fn);
    deferFunctionInspection(fn, state);
  };

  const ensure = (state: EnvState<T>, objectId: ObjectId): SharedRecord<T> => {
    const existing = state.objects.get(objectId);
    if (existing) return existing;
    const created: SharedRecord<T> = {
      id: objectId,
      escaped: false,
      invalid: false,
      data: emptyData(),
    };
    state.objects.set(objectId, created);
    return created;
  };

  const recordOf = (
    state: EnvState<T>,
    objectId: ObjectId | undefined,
  ): SharedRecord<T> | undefined => {
    if (objectId === undefined) return undefined;
    const rec = state.objects.get(objectId);
    if (!rec || rec.invalid || rec.escaped) return undefined;
    return rec;
  };

  // A split execution may visit one source reference with different records.
  // Publish their join, rather than whichever branch happens to run last.
  let pendingRefs: Map<ESTree.Node, PathRefInput<T>[]> | null = null;
  const publishRef = (input: PathRefInput<T>): void => {
    if (!onRef) return;
    if (!pendingRefs) {
      onRef(input);
      return;
    }
    spendWork(budget);
    const inputs = pendingRefs.get(input.node) ?? [];
    inputs.push({ ...input, rec: input.rec && cloneRecord(input.rec, cloneData) });
    pendingRefs.set(input.node, inputs);
  };
  const publishJoinedRefs = (refs: Map<ESTree.Node, PathRefInput<T>[]>): void => {
    for (const inputs of refs.values()) {
      const input = inputs[0]!;
      let rec = input.rec;
      for (const other of inputs.slice(1)) {
        spendWork(budget);
        if (rec && other.rec && rec.id !== other.rec.id) {
          rec = { ...rec, invalid: true, data: emptyData() };
        } else {
          rec = mergeRecords(rec, other.rec, emptyData, mergeData);
        }
      }
      onRef?.({ ...input, rec });
    }
  };

  const {
    objectFromExpr,
    functionsFromExpr,
    constantFromExpr,
    valueFromExpr,
    normalValueFromExpr,
  } = createPathValueResolver<T>({
    bindings,
    analysis,
    kinds,
    budget,
    ancestors,
    newExpressionIds,
    retainedPlatformObjectIds,
    alloc,
    emptyData,
    ensure,
    publishRef,
    onValue,
    stopAtAwait,
    argumentsBinding,
  });

  const markEscape = (state: EnvState<T>, node: unknown): void => {
    if (runCorrelated(state, (path) => markEscape(path, node))) return;
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return;
    const result = savedExpressionValue(state, node);
    forgetMappedArguments(state, result ? result.objectId : objectFromExpr(state, expr), true);
    if (result) {
      const rec = result.objectId === undefined ? undefined : state.objects.get(result.objectId);
      if (rec) rec.escaped = true;
      for (const fn of result.functions) {
        if (fn) escapeCaptured(state, fn);
      }
      return;
    }
    switch (expr.type) {
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        escapeCaptured(state, expr);
        return;
      case "ClassExpression":
      case "ClassDeclaration": {
        const values = functionsFromExpr(state, expr);
        if (values.every((value) => value === undefined)) escapeCaptured(state, expr);
        else {
          for (const value of values) {
            if (value) escapeCaptured(state, value);
          }
        }
        return;
      }
      case "Identifier": {
        const binding = resolveBinding(bindings, expr, ancestors);
        if (!binding) return;
        for (const fn of state.functions.get(binding.id) ?? []) {
          if (fn) escapeCaptured(state, fn);
        }
        const objectId = state.env.get(binding.id);
        if (objectId === undefined) return;
        const rec = state.objects.get(objectId);
        if (rec) rec.escaped = true;
        return;
      }
      case "ArrayExpression":
        for (const element of (expr as ESTree.ArrayExpression).elements) markEscape(state, element);
        return;
      case "ObjectExpression":
        for (const prop of (expr as ESTree.ObjectExpression).properties) {
          if (!isNode(prop)) continue;
          if (prop.type === "SpreadElement") {
            markEscape(state, (prop as ESTree.SpreadElement).argument);
          } else if (prop.type === "Property") {
            const property = prop as ESTree.ObjectProperty;
            if (property.computed) markEscape(state, property.key);
            markEscape(state, property.value);
          }
        }
        return;
      case "NewExpression": {
        const objectId = objectFromExpr(state, expr);
        if (objectId !== undefined) {
          const rec = state.objects.get(objectId);
          if (rec) rec.escaped = true;
        }
        return;
      }
      case "SpreadElement":
        markEscape(state, (expr as ESTree.SpreadElement).argument);
        return;
      case "ConditionalExpression": {
        const cond = expr as ESTree.ConditionalExpression;
        const selected = evaluatedConstantValue(state, cond.test, budget);
        if (selected) {
          markEscape(state, selected.truthy ? cond.consequent : cond.alternate);
          return;
        }
        markEscape(state, cond.consequent);
        markEscape(state, cond.alternate);
        return;
      }
      case "LogicalExpression": {
        const logical = expr as ESTree.LogicalExpression;
        const selected = evaluatedConstantValue(state, logical.left, budget);
        const rightRuns = selected
          ? logical.operator === "&&"
            ? selected.truthy
            : logical.operator === "||"
              ? !selected.truthy
              : selected.nullish
          : null;
        if (rightRuns !== null) {
          markEscape(state, rightRuns ? logical.right : logical.left);
          return;
        }
        markEscape(state, logical.left);
        markEscape(state, logical.right);
        return;
      }
      case "AssignmentExpression":
        if (expr.operator === "=") markEscape(state, expr.right);
        return;
      case "SequenceExpression":
        markEscape(state, (expr as ESTree.SequenceExpression).expressions.at(-1));
        return;
      default:
        return;
    }
  };

  const captureRoots = (
    state: EnvState<T>,
    fn: ESTree.Node | ClassValue,
  ): (ESTree.Node | ClassValue)[] => {
    if (fn.type !== "ClassDeclaration" && fn.type !== "ClassExpression") return [fn];
    const values = functionsFromExpr(state, fn);
    spendWork(budget, values.length);
    const roots: (ESTree.Node | ClassValue)[] = [];
    for (const value of values) {
      if (value) roots.push(value);
    }
    return roots.length ? roots : [fn];
  };

  const forgetCapturedConstants = (state: EnvState<T>, fn: ESTree.Node | ClassValue): void => {
    if (!hasLogicalAssignments) return;
    const pending = captureRoots(state, fn);
    const seen = new Set<ESTree.Node | ClassValue>();
    while (pending.length) {
      spendWork(budget);
      const current = pending.pop();
      if (!current || seen.has(current)) continue;
      seen.add(current);
      if (current.type === "ClassValue") {
        spendWork(budget, current.bases.length);
        for (const base of current.bases) {
          if (base) pending.push(base);
        }
      }
      const captures = capturesOf(current);
      spendWork(budget, captures.length);
      for (const capturedId of captures) {
        forgetMappedArguments(state, state.env.get(capturedId), true);
        if (constantBindings.has(capturedId)) state.constants.set(capturedId, null);
        const functions = state.functions.get(capturedId) ?? [];
        spendWork(budget, functions.length * 2);
        if (
          callableBindings.has(capturedId) ||
          functions.some((callable) => callable !== undefined)
        )
          state.exposedCallables.add(capturedId);
        for (const callable of functions) {
          if (callable) pending.push(callable);
        }
      }
    }
  };

  const escapeCaptured = (
    state: EnvState<T>,
    fn: ESTree.Node | ClassValue,
    inspection: CallableEscapePolicy = "inspect",
  ): void => {
    if (isFunctionLike(fn)) {
      if (inspection === "inspect") requireFunctionInspection(state, fn);
      else rememberInspectionFunctions(state, fn);
    }
    forgetCapturedConstants(state, fn);
    const pending = captureRoots(state, fn);
    const seen = new Set<ESTree.Node | ClassValue>();
    while (pending.length) {
      spendWork(budget);
      const current = pending.pop();
      if (!current || seen.has(current)) continue;
      seen.add(current);
      if (current.type === "ClassValue") {
        spendWork(budget, current.bases.length);
        for (const base of current.bases) {
          if (base) pending.push(base);
        }
      }
      const captures = capturesOf(current);
      spendWork(budget, captures.length);
      for (const capturedId of captures) {
        const objectId = state.env.get(capturedId);
        const captured = objectId === undefined ? undefined : state.objects.get(objectId);
        if (captured) captured.escaped = true;
      }
    }
  };

  const staticPropertyEvents = new WeakMap<
    ESTree.Class,
    ReadonlyMap<StaticPropertyKey, readonly StaticPropertyEvent[]>
  >();
  const ownStaticAccessorCache = new WeakMap<
    ESTree.Class,
    Map<StaticPropertyKey, OwnStaticAccessors>
  >();
  const staticAccessorCache = new WeakMap<ClassValue, Map<StaticPropertyKey, StaticAccessors>>();

  const degradedStaticProperties = new WeakMap<ClassValue, Set<StaticPropertyKey>>();
  const staticAccessorDependents = new WeakMap<
    ClassValue,
    Map<StaticPropertyKey, Set<ClassValue>>
  >();

  const staticEvents = (
    node: ESTree.Class,
  ): ReadonlyMap<StaticPropertyKey, readonly StaticPropertyEvent[]> => {
    const cached = staticPropertyEvents.get(node);
    if (cached) return cached;
    const methods: StaticPropertyEvent[] = [];
    const fields: StaticPropertyEvent[] = [];
    spendWork(budget, node.body.body.length);
    for (const element of node.body.body) {
      if (element.type === "StaticBlock") {
        if (element.body.length)
          fields.push({ property: null, order: fields.length, kind: "opaque" });
        continue;
      }
      if (!("static" in element) || !element.static || !("key" in element)) continue;
      if (element.key.type === "PrivateIdentifier") continue;
      const property = propertyKeyName(element);
      if (element.type === "MethodDefinition") {
        const order = methods.length;
        if (element.kind === "get" || element.kind === "set")
          methods.push({ property, order, kind: element.kind, fn: element.value });
        else methods.push({ property, order, kind: "data" });
      } else if (element.type === "PropertyDefinition")
        fields.push({ property, order: fields.length, kind: "data" });
    }
    // Static fields are initialized after all method descriptors are installed.
    spendWork(budget, methods.length + fields.length);
    const events = new Map<StaticPropertyKey, StaticPropertyEvent[]>();
    for (const event of methods) {
      const selected = events.get(event.property) ?? [];
      selected.push(event);
      events.set(event.property, selected);
    }
    for (const field of fields) {
      const selected = events.get(field.property) ?? [];
      selected.push({ ...field, order: methods.length + field.order });
      events.set(field.property, selected);
    }
    staticPropertyEvents.set(node, events);
    return events;
  };

  const ownStaticAccessors = (
    node: ESTree.Class,
    property: StaticPropertyKey,
  ): OwnStaticAccessors => {
    const cache =
      ownStaticAccessorCache.get(node) ?? new Map<StaticPropertyKey, OwnStaticAccessors>();
    ownStaticAccessorCache.set(node, cache);
    const cached = cache.get(property);
    if (cached) return cached;
    const index = staticEvents(node);
    const getters = new Set<ImmediateFunction>();
    const setters = new Set<ImmediateFunction>();
    let presence: StaticPropertyPresence = "absent";
    if (property === null) {
      const unknown = index.get(null) ?? [];
      spendWork(budget, index.size + unknown.length);
      for (const event of unknown) {
        if (event.kind === "get") getters.add(event.fn);
        else if (event.kind === "set") setters.add(event.fn);
      }
      for (const key of index.keys()) {
        if (key === null) continue;
        spendWork(budget);
        const known = ownStaticAccessors(node, key);
        spendWork(budget, known.getters.length + known.setters.length);
        for (const fn of known.getters) getters.add(fn);
        for (const fn of known.setters) setters.add(fn);
      }
      if (index.size) presence = "possible";
    } else {
      const known = index.get(property) ?? [];
      const unknown = index.get(null) ?? [];
      spendWork(budget, known.length + unknown.length);
      let knownIndex = 0;
      let unknownIndex = 0;
      while (knownIndex < known.length || unknownIndex < unknown.length) {
        const nextKnown = known[knownIndex];
        const nextUnknown = unknown[unknownIndex];
        const event =
          nextKnown && (!nextUnknown || nextKnown.order < nextUnknown.order)
            ? known[knownIndex++]
            : unknown[unknownIndex++];
        if (!event) continue;
        if (event.property === null) {
          if (event.kind === "opaque" || presence === "absent") presence = "possible";
          if (event.kind === "get") getters.add(event.fn);
          else if (event.kind === "set") setters.add(event.fn);
        } else {
          presence = "present";
          if (event.kind === "data") {
            getters.clear();
            setters.clear();
          } else if (event.kind === "get") {
            getters.clear();
            getters.add(event.fn);
          } else {
            setters.clear();
            setters.add(event.fn);
          }
        }
      }
    }
    spendWork(budget, getters.size + setters.size);
    const accessors = { presence, getters: [...getters], setters: [...setters] };
    cache.set(property, accessors);
    return accessors;
  };

  const classStaticAccessors = (
    value: ClassValue,
    property: StaticPropertyKey,
  ): StaticAccessors => {
    const cache = staticAccessorCache.get(value) ?? new Map<StaticPropertyKey, StaticAccessors>();
    staticAccessorCache.set(value, cache);
    const cached = cache.get(property);
    if (cached) return cached;
    const pending = [value];
    const seen = new Set<ClassValue>();
    const getters = new Set<ImmediateFunction>();
    const setters = new Set<ImmediateFunction>();
    while (pending.length) {
      spendWork(budget);
      const current = pending.pop();
      if (!current || seen.has(current)) continue;
      seen.add(current);
      const own = ownStaticAccessors(current.node, property);
      spendWork(budget, own.getters.length + own.setters.length);
      for (const fn of own.getters) getters.add(fn);
      for (const fn of own.setters) setters.add(fn);
      const degraded = degradedStaticProperties.get(current);
      if (own.presence !== "present" || degraded?.has(null) || degraded?.has(property)) {
        spendWork(budget, current.bases.length);
        for (const base of current.bases) {
          if (base?.type !== "ClassValue") continue;
          const dependencies =
            staticAccessorDependents.get(base) ?? new Map<StaticPropertyKey, Set<ClassValue>>();
          const parents = dependencies.get(property) ?? new Set<ClassValue>();
          parents.add(current);
          dependencies.set(property, parents);
          staticAccessorDependents.set(base, dependencies);
          pending.push(base);
        }
      }
    }
    spendWork(budget, getters.size + setters.size);
    const accessors = { getters: [...getters], setters: [...setters] };
    cache.set(property, accessors);
    return accessors;
  };

  const selectedStaticAccessors = (
    state: EnvState<T>,
    member: ESTree.MemberExpression,
  ): StaticMemberReference => {
    const functions = functionsFromExpr(state, member.object);
    const values: ClassValue[] = [];
    spendWork(budget, functions.length);
    for (const value of functions) {
      if (value?.type === "ClassValue") values.push(value);
    }
    return { values, property: staticPropertyName(member) };
  };

  const degradeStaticShadow = (reference: StaticMemberReference): void => {
    spendWork(budget, reference.values.length);
    for (const value of reference.values) {
      const degraded = degradedStaticProperties.get(value) ?? new Set<StaticPropertyKey>();
      if (degraded.has(null) || degraded.has(reference.property)) continue;
      degraded.add(reference.property);
      degradedStaticProperties.set(value, degraded);
      const cached = staticAccessorCache.get(value);
      const dependencies = staticAccessorDependents.get(value);
      if (reference.property === null)
        spendWork(budget, (cached?.size ?? 0) + (dependencies?.size ?? 0));
      const keys =
        reference.property === null
          ? new Set([...(cached?.keys() ?? []), ...(dependencies?.keys() ?? [])])
          : new Set([reference.property, null]);
      spendWork(budget, keys.size);
      const pending: { readonly value: ClassValue; readonly property: StaticPropertyKey }[] = [];
      for (const property of keys) pending.push({ value, property });
      const seen = new Map<ClassValue, Set<StaticPropertyKey>>();
      while (pending.length) {
        spendWork(budget);
        const current = pending.pop();
        if (!current) continue;
        const visited = seen.get(current.value) ?? new Set<StaticPropertyKey>();
        if (visited.has(current.property)) continue;
        visited.add(current.property);
        seen.set(current.value, visited);
        staticAccessorCache.get(current.value)?.delete(current.property);
        const parents = staticAccessorDependents.get(current.value)?.get(current.property);
        spendWork(budget, parents?.size ?? 0);
        for (const parent of parents ?? [])
          pending.push({ value: parent, property: current.property });
      }
    }
  };

  const applyStaticAccessors = (
    state: EnvState<T>,
    reference: StaticMemberReference,
    kind: StaticAccessorKind,
  ): void => {
    const functions = new Set<ImmediateFunction>();
    spendWork(budget, reference.values.length);
    for (const value of reference.values) {
      const accessors = classStaticAccessors(value, reference.property);
      const selected = kind === "get" ? accessors.getters : accessors.setters;
      spendWork(budget, selected.length);
      for (const fn of selected) functions.add(fn);
    }
    if (!functions.size) return;
    const apply = (path: EnvState<T>): void => {
      recordPossibleThrow(path);
      spendWork(budget, functions.size);
      for (const fn of functions) {
        capturesOf(fn, budget);
        escapeCaptured(path, fn, "captures-only");
      }
      recordPossibleThrow(path);
    };
    if (!runCorrelated(state, apply) && state.completion === "normal") apply(state);
  };

  const literalArgumentValue = (node: unknown, depth: number): LiteralArgumentValue => {
    spendWork(budget);
    if (depth >= MAX_PATH_DEPTH) throw BUDGET_EXCEEDED;
    const inner = unwrapExpression(node);
    if (!isNode(inner)) return { kind: "undefined" };
    if (inner.type === "ObjectExpression" || inner.type === "ArrayExpression") {
      const literalShape = literalShapeFromExpr(inner, depth);
      return literalShape ? { kind: "defined", literalShape } : { kind: "defined" };
    }
    if (
      inner.type === "Identifier" &&
      inner.name === "undefined" &&
      bindings.isPlatformGlobal(inner)
    )
      return { kind: "undefined" };
    const constant = constantValue(inner);
    if (!constant) return { kind: "unknown" };
    if (!constant.nullish) return { kind: "defined" };
    if (constant.nullishValue === "undefined") return { kind: "undefined" };
    return { kind: constant.nullishValue === "null" ? "null" : "unknown" };
  };

  const literalShapeFromExpr = (node: unknown, depth = 0): LiteralArgumentShape | undefined => {
    spendWork(budget);
    if (depth >= MAX_PATH_DEPTH) throw BUDGET_EXCEEDED;
    const inner = unwrapExpression(node);
    if (!isNode(inner)) return undefined;
    if (inner.type === "ObjectExpression") {
      const properties = new Map<string, LiteralArgumentValue>();
      const getters = new Set<string>();
      let rest: "unknown" | "undefined" = objectPrototypeUncertain ? "unknown" : "undefined";
      let unknownOwnProperties = false;
      for (const property of inner.properties) {
        spendWork(budget);
        const name =
          property.type === "Property" && !property.computed ? propertyKeyName(property) : null;
        if (name === null || name === "__proto__" || property.type !== "Property") {
          spendWork(budget, properties.size + getters.size);
          properties.clear();
          getters.clear();
          rest = "unknown";
          unknownOwnProperties = true;
          continue;
        }
        if (property.kind === "get") {
          getters.add(name);
          properties.set(name, { kind: "unknown" });
        } else if (property.kind === "set") {
          properties.set(name, {
            kind: getters.has(name) || unknownOwnProperties ? "unknown" : "undefined",
          });
        } else {
          getters.delete(name);
          properties.set(name, literalArgumentValue(property.value, depth + 1));
        }
      }
      return { kind: "object", properties, rest };
    }
    if (inner.type === "ArrayExpression") {
      if (arrayIterationUncertain) return undefined;
      const elements: LiteralArgumentValue[] = [];
      for (const element of inner.elements) {
        spendWork(budget);
        if (element?.type === "SpreadElement") return { kind: "array", elements, rest: "unknown" };
        elements.push(literalArgumentValue(element, depth + 1));
      }
      return { kind: "array", elements, rest: "undefined" };
    }
    return undefined;
  };

  const expressionValueMayChange = (node: unknown, depth = 0): boolean => {
    if (depth >= MAX_PATH_DEPTH) return true;
    spendWork(budget);
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return false;
    switch (expr.type) {
      case "Identifier":
        return true;
      case "SequenceExpression":
        return expressionValueMayChange(expr.expressions.at(-1), depth + 1);
      case "AssignmentExpression":
        return expr.operator === "=" && expressionValueMayChange(expr.right, depth + 1);
      case "ConditionalExpression": {
        const test = constantValue(expr.test);
        return test
          ? expressionValueMayChange(test.truthy ? expr.consequent : expr.alternate, depth + 1)
          : expressionValueMayChange(expr.consequent, depth + 1) ||
              expressionValueMayChange(expr.alternate, depth + 1);
      }
      case "LogicalExpression": {
        const left = constantValue(expr.left);
        const rightRuns = left
          ? expr.operator === "&&"
            ? left.truthy
            : expr.operator === "||"
              ? !left.truthy
              : left.nullish
          : null;
        return rightRuns !== null
          ? expressionValueMayChange(rightRuns ? expr.right : expr.left, depth + 1)
          : expressionValueMayChange(expr.left, depth + 1) ||
              expressionValueMayChange(expr.right, depth + 1);
      }
      case "SpreadElement":
        return expressionValueMayChange(expr.argument, depth + 1);
      default:
        // A different selected arm can contribute a fixed, meaningful value.
        return constantValue(expr) !== null;
    }
  };

  const shouldPreserveExpressionValue = (source: unknown, value: EvaluatedValue): boolean => {
    spendWork(budget, value.functions.length);
    return (
      value.objectId !== undefined ||
      value.constant !== null ||
      value.literalShape !== undefined ||
      value.functions.some((fn) => fn !== undefined) ||
      expressionValueMayChange(source)
    );
  };

  const preserveArgumentValue = (state: EnvState<T>, node: ESTree.Node): void => {
    const preserve = (path: EnvState<T>): void => {
      spendWork(budget);
      const source = node.type === "SpreadElement" ? node.argument : node;
      const evaluated = valueFromExpr(path, source);
      const literalShape = literalShapeFromExpr(source);
      const value = literalShape === undefined ? evaluated : { ...evaluated, literalShape };
      if (shouldPreserveExpressionValue(source, value)) path.assignmentResults.set(node, value);
    };
    if (!runCorrelated(state, preserve)) preserve(state);
  };

  const preserveWriteReceiver = (state: EnvState<T>, receiver: ESTree.Node): void => {
    if (!hasLogicalAssignments) return;
    const preserve = (path: EnvState<T>): void => {
      spendWork(budget);
      path.assignmentResults.set(receiver, valueFromExpr(path, receiver));
    };
    if (!runCorrelated(state, preserve)) preserve(state);
  };

  const invalidatePattern = (state: EnvState<T>, pattern: unknown): void => {
    if (runCorrelated(state, (path) => invalidatePattern(path, pattern))) return;
    const inner = unwrapExpression(pattern);
    if (!isNode(inner)) return;
    if (inner.type === "Identifier") {
      const binding = resolveBinding(bindings, inner, ancestors);
      if (binding) {
        state.env.set(binding.id, undefined);
        state.functions.delete(binding.id);
        if (state.constants.get(binding.id) !== null) state.constants.delete(binding.id);
      }
      return;
    }
    if (inner.type === "MemberExpression") {
      forgetMappedArgumentWrite(state, inner);
      return;
    }
    if (inner.type === "AssignmentPattern") {
      invalidatePattern(state, (inner as ESTree.AssignmentPattern).left);
      return;
    }
    if (inner.type === "RestElement") {
      invalidatePattern(state, (inner as unknown as { argument?: unknown }).argument);
      return;
    }
    if (inner.type === "ObjectPattern") {
      for (const prop of (inner as ESTree.ObjectPattern).properties) {
        if (!isNode(prop)) continue;
        if (prop.type === "RestElement") invalidatePattern(state, prop.argument);
        else if (prop.type === "Property")
          invalidatePattern(state, (prop as ESTree.ObjectProperty).value);
      }
      return;
    }
    if (inner.type === "ArrayPattern") {
      for (const element of (inner as ESTree.ArrayPattern).elements)
        invalidatePattern(state, element);
    }
  };

  const bindPattern = (
    state: EnvState<T>,
    pattern: unknown,
    objectId: ObjectId | undefined,
  ): void => {
    if (runCorrelated(state, (path) => bindPattern(path, pattern, objectId))) return;
    const inner = unwrapExpression(pattern);
    if (!isNode(inner)) return;
    if (inner.type === "Identifier") {
      const binding = resolveBinding(bindings, inner, ancestors);
      const argumentId = argumentsBinding(inner);
      if (!binding && argumentId !== undefined) state.env.set(argumentId, objectId);
      if (binding) {
        state.env.set(binding.id, objectId);
        if (state.constants.get(binding.id) !== null) state.constants.delete(binding.id);
      }
      return;
    }
    if (inner.type === "AssignmentPattern") {
      bindPattern(state, (inner as ESTree.AssignmentPattern).left, objectId);
      return;
    }
    if (inner.type === "RestElement") {
      invalidatePattern(state, inner.argument);
      if (objectId !== undefined) {
        const rec = state.objects.get(objectId);
        if (rec) rec.escaped = true;
      }
      return;
    }
    if (inner.type === "ObjectPattern" || inner.type === "ArrayPattern") {
      invalidatePattern(state, inner);
      if (objectId !== undefined) {
        const rec = state.objects.get(objectId);
        if (rec) rec.escaped = true;
      }
    }
  };

  const visitPatternExpressions = (
    state: EnvState<T>,
    pattern: unknown,
    value: LiteralArgumentValue = { kind: "unknown" },
    depth = 0,
  ): void => {
    if (state.completion !== "normal") return;
    if (runCorrelated(state, (path) => visitPatternExpressions(path, pattern, value, depth)))
      return;
    spendWork(budget);
    if (depth >= MAX_PATH_DEPTH) throw BUDGET_EXCEEDED;
    const inner = unwrapExpression(pattern);
    if (!isNode(inner)) return;
    if (
      (inner.type === "ObjectPattern" || inner.type === "ArrayPattern") &&
      (value.kind === "null" || value.kind === "undefined")
    ) {
      setCompletion(state, "throw");
      return;
    }
    if (inner.type === "AssignmentPattern") {
      if (value.kind === "defined" || value.kind === "null") {
        visitPatternExpressions(state, inner.left, value, depth + 1);
        return;
      }
      const withDefault =
        value.kind === "undefined" ? state : snapshotState(state, cloneData, budget);
      visit(inner.right, withDefault, false);
      if (withDefault.completion === "normal")
        visitPatternExpressions(
          withDefault,
          inner.left,
          literalArgumentValue(inner.right, 0),
          depth + 1,
        );
      if (value.kind === "unknown") {
        const provided = snapshotState(state, cloneData, budget);
        visitPatternExpressions(provided, inner.left, value, depth + 1);
        joinInto(state, [provided, withDefault]);
      }
      return;
    }
    if (inner.type === "RestElement") {
      visitPatternExpressions(state, inner.argument, { kind: "unknown" }, depth + 1);
      return;
    }
    if (inner.type === "ObjectPattern") {
      for (const prop of inner.properties) {
        if (state.completion !== "normal") break;
        spendWork(budget);
        if (!isNode(prop)) continue;
        if (prop.type === "RestElement")
          visitPatternExpressions(state, prop.argument, { kind: "unknown" }, depth + 1);
        else if (prop.type === "Property") {
          if (prop.computed) visit(prop.key, state, false);
          const name = prop.computed ? null : propertyKeyName(prop);
          const selected: LiteralArgumentValue =
            name !== null && value.kind === "defined" && value.literalShape?.kind === "object"
              ? (value.literalShape.properties.get(name) ?? {
                  kind: OBJECT_PROTOTYPE_KEYS.has(name) ? "unknown" : value.literalShape.rest,
                })
              : { kind: "unknown" };
          visitPatternExpressions(state, prop.value, selected, depth + 1);
        }
      }
      return;
    }
    if (inner.type === "ArrayPattern") {
      for (const [index, element] of inner.elements.entries()) {
        if (state.completion !== "normal") break;
        spendWork(budget);
        const selected: LiteralArgumentValue =
          value.kind === "defined" && value.literalShape?.kind === "array"
            ? (value.literalShape.elements[index] ?? { kind: value.literalShape.rest })
            : { kind: "unknown" };
        visitPatternExpressions(state, element, selected, depth + 1);
      }
    }
  };

  const assignFrom = (state: EnvState<T>, left: unknown, right: unknown): void => {
    if (runCorrelated(state, (path) => assignFrom(path, left, right))) return;
    const target = unwrapExpression(left);
    if (isNode(target) && target.type === "MemberExpression") {
      forgetMappedArgumentWrite(state, target);
      markEscape(state, right);
      return;
    }
    const objectId = objectFromExpr(state, right);
    const constantBinding = resolveBinding(bindings, target, ancestors);
    const constant =
      constantBinding && constantBindings.has(constantBinding.id)
        ? constantFromExpr(state, right)
        : null;
    if (
      isNode(target) &&
      (target.type === "ObjectPattern" ||
        target.type === "ArrayPattern" ||
        target.type === "RestElement")
    ) {
      bindPattern(state, target, objectId);
      return;
    }
    bindPattern(state, left, objectId);
    if (isNode(target) && target.type === "Identifier") {
      const binding = resolveBinding(bindings, target, ancestors);
      if (binding) {
        if (constant && state.constants.get(binding.id) !== null) {
          state.constants.set(binding.id, constant);
        }
        const values = functionsFromExpr(state, right);
        if (values.some((value) => value !== undefined)) state.functions.set(binding.id, values);
        else state.functions.delete(binding.id);
        if (state.constants.get(binding.id) === null || state.exposedCallables.has(binding.id)) {
          for (const fn of values) {
            if (fn) forgetCapturedConstants(state, fn);
          }
        }
      }
    }
  };

  const bindParameterValue = (
    state: EnvState<T>,
    pattern: unknown,
    value: EvaluatedValue,
  ): void => {
    if (runCorrelated(state, (path) => bindParameterValue(path, pattern, value))) return;
    const target = unwrapExpression(pattern);
    if (isNode(target) && target.type !== "Identifier") {
      visitPatternExpressions(
        state,
        target,
        value.literalShape
          ? { kind: "defined", literalShape: value.literalShape }
          : value.constant?.nullish
            ? { kind: value.constant.nullishValue === "undefined" ? "undefined" : "null" }
            : { kind: "unknown" },
      );
      if (state.completion !== "normal") return;
    }
    bindPattern(state, pattern, value.objectId);
    if (!isNode(target) || target.type !== "Identifier") return;
    const binding = resolveBinding(bindings, target, ancestors);
    if (!binding) return;
    if (value.functions.some((fn) => fn !== undefined))
      state.functions.set(binding.id, value.functions);
    else state.functions.delete(binding.id);
    if (
      constantBindings.has(binding.id) &&
      value.constant &&
      state.constants.get(binding.id) !== null
    ) {
      state.constants.set(binding.id, value.constant);
    }
  };

  const joinInto = (state: EnvState<T>, paths: EnvState<T>[]): void => {
    const flattened = paths.flatMap((path) => completionPaths(path, cloneData, budget));
    const normal = flattened.filter((path) => path.completion === "normal");
    const abrupt = flattened.filter((path) => path.completion !== "normal");
    const merged = mergeMany(normal, mergePolicy);
    state.abrupt.clear();
    if (merged) {
      replaceWith(state, merged);
      state.completion = "normal";
      state.completionLabel = null;
      for (const path of abrupt) {
        const kind = path.completion as AbruptCompletion;
        const list = state.abrupt.get(kind) ?? [];
        list.push(pathWithoutAlternatives(path, cloneData, budget));
        state.abrupt.set(kind, list);
      }
    } else if (abrupt.length > 0) {
      // Keep one completion in the primary state and retain all other
      // alternatives. Owning loops/switches/try statements consume them.
      replaceWith(state, abrupt[0]!);
      for (const path of abrupt.slice(1)) {
        const kind = path.completion as AbruptCompletion;
        const list = state.abrupt.get(kind) ?? [];
        list.push(pathWithoutAlternatives(path, cloneData, budget));
        state.abrupt.set(kind, list);
      }
    } else {
      setCompletion(state, "normal");
    }
  };

  const isDefinitelyDiscarded = (node: ESTree.Node): boolean => {
    let child = node;
    for (let index = ancestors.length - 2; index >= 0; index -= 1) {
      spendWork(budget);
      const parent = ancestors[index];
      if (!parent) return false;
      if (parent.type === "ExpressionStatement") return parent.expression === child;
      if (parent.type === "UnaryExpression")
        return parent.operator === "void" && parent.argument === child;
      if (parent.type === "SequenceExpression") {
        if (parent.expressions.at(-1) !== child) return true;
      } else if (
        TRANSPARENT_WRAPPER_TYPES.has(parent.type) &&
        "expression" in parent &&
        parent.expression === child
      ) {
        // Transparent wrappers preserve whether the enclosing value is retained.
      } else if (
        parent.type === "ConditionalExpression" &&
        (parent.consequent === child || parent.alternate === child)
      ) {
        // Only the selected result flows to the enclosing consumer.
      } else if (
        parent.type === "LogicalExpression" &&
        (parent.left === child || parent.right === child)
      ) {
        // A retained logical result may retain either operand's value.
      } else return false;
      child = parent;
    }
    return false;
  };

  const consumesExpressionValue = (node: ESTree.Node): boolean => {
    let child = node;
    for (let index = ancestors.length - 2; index >= 0; index -= 1) {
      spendWork(budget);
      const parent = ancestors[index];
      if (!parent || isFunctionLike(parent) || parent.type.endsWith("Statement")) return false;
      if (parent.type === "CallExpression" || parent.type === "NewExpression") {
        return true;
      } else if (parent.type === "MemberExpression" && parent.object === child) {
        return true;
      } else if (parent.type === "AssignmentExpression" || parent.type === "UpdateExpression") {
        const target = unwrapExpression(
          parent.type === "AssignmentExpression" ? parent.left : parent.argument,
        );
        if (isNode(target) && target.type === "MemberExpression" && target.object === child)
          return true;
      } else if (parent.type === "TaggedTemplateExpression") {
        return true;
      }
      child = parent;
    }
    return false;
  };

  const rememberExpressionResult = (
    state: EnvState<T>,
    node: ESTree.Node,
    value: unknown,
  ): void => {
    if (state.callablePaths.length) {
      for (const path of state.callablePaths) rememberExpressionResult(path, node, value);
      return;
    }

    if (hasLogicalAssignments && consumesExpressionValue(node)) {
      spendWork(budget);
      const selected = valueFromExpr(state, value);
      if (shouldPreserveExpressionValue(node, selected))
        state.assignmentResults.set(node, selected);
      return;
    }
    const values = functionsFromExpr(state, value);
    if (values.some((fn) => fn !== undefined)) state.callableResults.set(node, values);
  };

  const finishExpressionResults = (state: EnvState<T>): void => {
    if (
      !state.callablePaths.length &&
      !state.abrupt.size &&
      !state.callableResults.size &&
      !state.assignmentResults.size
    )
      return;
    const clear = (path: EnvState<T>): void => {
      spendWork(budget, 1 + path.callableResults.size + path.assignmentResults.size);
      path.callableResults.clear();
      path.assignmentResults.clear();
      for (const alternative of path.callablePaths) clear(alternative);
      for (const paths of path.abrupt.values()) {
        for (const alternative of paths) clear(alternative);
      }
    };
    clear(state);
    if (state.callablePaths.length || state.abrupt.size) joinInto(state, [state]);
  };

  const runCorrelated = (state: EnvState<T>, action: (path: EnvState<T>) => void): boolean => {
    if (!state.callablePaths.length) return false;
    const refs = pendingRefs ? null : new Map<ESTree.Node, PathRefInput<T>[]>();
    if (refs) pendingRefs = refs;
    const paths = completionPaths(state, cloneData, budget);
    for (const path of paths) {
      if (path.completion === "normal") action(path);
    }
    joinInto(state, paths);
    if (refs) {
      pendingRefs = null;
      publishJoinedRefs(refs);
    }
    return true;
  };

  const hasNoCreationDecorators = (node: ESTree.Node): boolean =>
    !("decorators" in node) || (Array.isArray(node.decorators) && node.decorators.length === 0);
  const classCreationSafety = new WeakMap<ESTree.Class, boolean>();
  const isSafeClassCreation = (cls: ESTree.Class): boolean => {
    spendWork(budget);
    const cached = classCreationSafety.get(cls);
    if (cached !== undefined) return cached;
    let safe =
      cls.type === "ClassExpression" && cls.superClass === null && hasNoCreationDecorators(cls);
    if (safe) {
      for (const element of cls.body.body) {
        spendWork(budget);
        if (
          (element.type === "MethodDefinition" ||
            ((element.type === "PropertyDefinition" || element.type === "AccessorProperty") &&
              !element.static)) &&
          !element.computed &&
          hasNoCreationDecorators(element)
        ) {
          if (element.type === "MethodDefinition") {
            const fn = element.value;
            if (!isFunctionLike(fn)) {
              safe = false;
              break;
            }
            spendWork(budget, fn.params.length);
            if (!fn.params.every(hasNoCreationDecorators)) {
              safe = false;
              break;
            }
          }
          continue;
        }
        safe = false;
        break;
      }
    }
    classCreationSafety.set(cls, safe);
    return safe;
  };

  const hasSafeLocalCalleeLookup = (state: EnvState<T>, callee: unknown): boolean => {
    spendWork(budget);
    if (!isNode(callee)) return false;
    if (isFunctionLike(callee)) return true;
    if (callee.type === "ClassExpression") return isSafeClassCreation(callee);
    // A closure may retain a With environment after its creation scope exits.
    // Keep identifier lookup conservative whenever this file can expose one.
    if (hasWithStatement || callee.type !== "Identifier") return false;
    const functions = functionsFromExpr(state, callee);
    spendWork(budget, functions.length);
    return functions.length > 0 && functions.every((fn) => fn !== undefined);
  };

  const recordCalleeLookupThrow = (state: EnvState<T>, callee: unknown): void => {
    if (!tryThrowPaths.length) return;
    const record = (path: EnvState<T>): void => {
      if (!hasSafeLocalCalleeLookup(path, callee)) recordPossibleThrow(path);
    };
    if (!runCorrelated(state, record)) record(state);
  };

  const visitMemberReference = (
    state: EnvState<T>,
    member: ESTree.MemberExpression,
    consume: (path: EnvState<T>, accessors: StaticMemberReference) => void,
    captureReceiver?: (path: EnvState<T>) => void,
  ): void => {
    const entered = ancestors.at(-1) !== member;
    if (entered) ancestors.push(member);
    visit(member.object, state, false);
    const evaluateKey = (path: EnvState<T>): void => {
      const accessors = selectedStaticAccessors(path, member);
      captureReceiver?.(path);
      if (member.computed) visit(member.property, path, false);
      const complete = (result: EnvState<T>): void => {
        if (entered) ancestors.pop();
        consume(result, accessors);
        if (entered) ancestors.push(member);
      };
      if (!runCorrelated(path, complete) && path.completion === "normal") complete(path);
    };
    if (!runCorrelated(state, evaluateKey) && state.completion === "normal") evaluateKey(state);
    if (entered) ancestors.pop();
  };

  const evaluatedArguments = (
    state: EnvState<T>,
    args: ESTree.CallExpression["arguments"],
  ): InvocationArguments => {
    const values: EvaluatedValue[] = [];
    for (const argument of args) {
      spendWork(budget);
      if (argument.type === "SpreadElement") return { kind: "uncertain" };
      values.push(
        savedExpressionValue(state, argument) ?? {
          objectId: objectFromExpr(state, argument),
          functions: [undefined],
          constant: isDefinitelyUndefinedValue(argument, bindings)
            ? { truthy: false, nullish: true, nullishValue: "undefined" }
            : constantValue(argument),
        },
      );
    }
    return { kind: "positional", values };
  };

  const invokeKnownFunction = (
    caller: EnvState<T>,
    fn: ImmediateFunction,
    args: InvocationArguments,
    execution: FunctionExecution,
  ): EnvState<T>[] => {
    invokedFunctions.add(fn);
    activeFunctions.add(fn);
    const invocation = snapshotState(caller, cloneData, budget);
    const { params } = fn;
    ancestors.push(fn);
    if (hasLogicalAssignments && fn.type !== "ArrowFunctionExpression") {
      const argumentObject = argumentObjectId(fn);
      const mapped = new Map<number, BindingId>();
      if (hasMappedArguments(fn)) {
        const providedCount = args.kind === "positional" ? args.values.length : params.length;
        const seenNames = new Set<string>();
        for (let index = params.length - 1; index >= 0; index -= 1) {
          spendWork(budget);
          const param = params[index];
          if (!param || param.type !== "Identifier" || seenNames.has(param.name)) continue;
          seenNames.add(param.name);
          if (index >= providedCount) continue;
          const binding = resolveBinding(bindings, param, ancestors);
          if (binding && constantBindings.has(binding.id)) mapped.set(index, binding.id);
        }
      }
      mappedArguments.set(argumentObject, mapped);
      invocation.env.set(-argumentObject, argumentObject);
      const declaredArguments = fn.body ? bindings.resolve("arguments", fn.body, ancestors) : null;
      if (declaredArguments?.kind === "var")
        invocation.env.set(declaredArguments.id, argumentObject);
    }
    for (let index = 0; index < params.length; index += 1) {
      if (invocation.completion !== "normal") break;
      spendWork(budget);
      const param = unwrapExpression(params[index]);
      const value: EvaluatedValue =
        args.kind === "uncertain"
          ? { objectId: undefined, functions: [undefined], constant: null }
          : (args.values[index] ?? {
              objectId: undefined,
              functions: [undefined],
              constant: { truthy: false, nullish: true, nullishValue: "undefined" },
            });
      const bindParameter = (path: EnvState<T>): void => {
        if (runCorrelated(path, bindParameter) || path.completion !== "normal") return;
        if (isNode(param) && param.type === "AssignmentPattern") {
          const nullishValue = value.constant?.nullish ? value.constant.nullishValue : undefined;
          const defaultRuns = nullishValue === "undefined";
          const provided = value.constant?.nullish === false || nullishValue === "null";
          if (provided) {
            bindParameterValue(path, param.left, value);
            return;
          }
          const withDefault = defaultRuns ? path : snapshotState(path, cloneData, budget);
          visit(param.right, withDefault, false);
          const bindDefault = (result: EnvState<T>): void => {
            const selected = valueFromExpr(result, param.right);
            const literalShape = literalShapeFromExpr(param.right);
            bindParameterValue(
              result,
              param.left,
              literalShape ? { ...selected, literalShape } : selected,
            );
          };
          if (!runCorrelated(withDefault, bindDefault) && withDefault.completion === "normal")
            bindDefault(withDefault);
          if (!defaultRuns) {
            bindParameterValue(path, param.left, value);
            joinInto(path, [pathWithoutAlternatives(path, cloneData, budget), withDefault]);
          }
        } else {
          bindParameterValue(path, params[index], value);
        }
      };
      bindParameter(invocation);
    }
    if (execution === "body") visit(fn.body, invocation, false);
    ancestors.pop();
    const returned = completionPaths(invocation, cloneData, budget);
    if (execution === "body") {
      for (const path of returned) {
        if (
          path.completion === "return" ||
          path.completion === "suspend" ||
          (fn.async && path.completion === "throw")
        )
          setCompletion(path, "normal");
      }
    }
    const capturedIds = new Set(capturesOf(fn));
    for (const id of capturedIds) {
      if (id >= 0) continue;
      for (const mapped of mappedArguments.get(-id)?.values() ?? []) {
        spendWork(budget);
        capturedIds.add(mapped);
      }
    }
    const projected = returned.map((path) => {
      const result = snapshotState(caller, cloneData, budget);
      result.objects = new Map(path.objects);
      result.exposedCallables = new Set(path.exposedCallables);
      if (hasLogicalAssignments) {
        const scalarIds = new Set([...caller.env.keys(), ...capturedIds]);
        spendWork(budget, scalarIds.size);
        for (const id of scalarIds) {
          const constant = path.constants.get(id);
          if (constant !== undefined) result.constants.set(id, constant);
          else result.constants.delete(id);
        }
      }
      for (const id of capturedIds) {
        result.env.set(id, path.env.get(id));
        const values = path.functions.get(id);
        if (values) result.functions.set(id, values);
        else result.functions.delete(id);
      }
      setCompletion(result, path.completion, path.completionLabel ?? null);
      return result;
    });
    activeFunctions.delete(fn);
    return projected;
  };

  const initializeOwnInstanceFields = (state: EnvState<T>, cls: ESTree.Class): void => {
    if (state.completion !== "normal") return;
    spendWork(budget, state.assignmentResults.size + state.callableResults.size);
    const enclosingAssignments = new Map(state.assignmentResults);
    const enclosingCallables = new Map(state.callableResults);
    const restoreEnclosingResults = (path: EnvState<T>): void => {
      spendWork(budget, 1 + enclosingAssignments.size + enclosingCallables.size);
      for (const [expression, value] of enclosingAssignments)
        path.assignmentResults.set(expression, value);
      for (const [expression, value] of enclosingCallables)
        path.callableResults.set(expression, value);
      for (const alternative of path.callablePaths) restoreEnclosingResults(alternative);
      for (const paths of path.abrupt.values()) {
        for (const alternative of paths) restoreEnclosingResults(alternative);
      }
    };
    ancestors.push(cls, cls.body);
    for (const element of cls.body.body) {
      if (state.completion !== "normal") break;
      spendWork(budget);
      if (
        (element.type === "PropertyDefinition" || element.type === "AccessorProperty") &&
        !element.static &&
        element.value
      ) {
        ancestors.push(element);
        visit(element.value, state, false);
        if (state.completion === "normal") markEscape(state, element.value);
        finishExpressionResults(state);
        restoreEnclosingResults(state);
        ancestors.pop();
      }
    }
    ancestors.pop();
    ancestors.pop();
  };

  const safeConstructorValue = (argument: ESTree.Node | null): boolean => {
    let expression = argument;
    for (let depth = 0; depth < MAX_PATH_DEPTH; depth += 1) {
      spendWork(budget);
      if (expression === null) return true;
      if (TRANSPARENT_WRAPPER_TYPES.has(expression.type) && "expression" in expression) {
        const inner = expression.expression;
        if (!isNode(inner)) return false;
        expression = inner;
        continue;
      }
      if (expression.type === "Literal") return !("regex" in expression);
      if (expression.type === "ObjectExpression") return expression.properties.length === 0;
      if (expression.type === "ArrayExpression") return expression.elements.length === 0;
      return (
        isFunctionLike(expression) ||
        (expression.type === "ClassExpression" && isSafeClassCreation(expression))
      );
    }
    throw BUDGET_EXCEEDED;
  };

  const safeConstructorArguments = (args: ESTree.CallExpression["arguments"]): boolean => {
    spendWork(budget, args.length);
    return args.every(
      (argument) => argument.type !== "SpreadElement" && safeConstructorValue(argument),
    );
  };

  const safeReturnedSuperCall = (
    argument: ESTree.Node | null,
  ): ESTree.CallExpression | undefined => {
    let expression = argument;
    for (let depth = 0; depth < MAX_PATH_DEPTH; depth += 1) {
      spendWork(budget);
      if (expression === null) return undefined;
      if (TRANSPARENT_WRAPPER_TYPES.has(expression.type) && "expression" in expression) {
        const inner = expression.expression;
        if (!isNode(inner)) return undefined;
        expression = inner;
        continue;
      }
      return expression.type === "CallExpression" &&
        expression.callee.type === "Super" &&
        safeConstructorArguments(expression.arguments)
        ? expression
        : undefined;
    }
    throw BUDGET_EXCEEDED;
  };

  const constructorFieldReplay = (cls: ESTree.Class): ClassConstructorReplay => {
    spendWork(budget);
    const cached = classConstructorReplay.get(cls);
    if (cached) return cached;
    let replay: ClassConstructorReplay = "continue";
    let superArguments: ClassSuperArguments = { kind: "implicit" };
    for (const element of cls.body.body) {
      spendWork(budget);
      if (element.type !== "MethodDefinition" || element.static || element.kind !== "constructor")
        continue;
      replay = "opaque";
      superArguments = { kind: "opaque" };
      const fn = element.value;
      if (!isFunctionLike(fn) || fn.body?.type !== "BlockStatement") break;
      spendWork(budget, fn.params.length);
      if (
        !fn.params.every(
          (param) =>
            param.type === "Identifier" ||
            (param.type === "RestElement" && param.argument.type === "Identifier"),
        )
      )
        break;
      let forwardingCalls = 0;
      let harmless = true;
      for (const statement of fn.body.body) {
        spendWork(budget);
        if (statement.type === "EmptyStatement") continue;
        const expression =
          statement.type === "ExpressionStatement" ? unwrapExpression(statement.expression) : null;
        if (
          isNode(expression) &&
          expression.type === "Literal" &&
          getStringValue(expression) !== null
        )
          continue;
        if (
          !cls.superClass &&
          statement.type === "ReturnStatement" &&
          safeConstructorValue(statement.argument)
        ) {
          replay = "continue";
          harmless = false;
          break;
        }
        const returnedSuper =
          cls.superClass && forwardingCalls === 0 && statement.type === "ReturnStatement"
            ? safeReturnedSuperCall(statement.argument)
            : undefined;
        if (returnedSuper) {
          superArguments = { kind: "explicit", arguments: returnedSuper.arguments };
          replay = "continue";
          harmless = false;
          break;
        }
        if (
          cls.superClass &&
          isNode(expression) &&
          expression.type === "CallExpression" &&
          expression.callee.type === "Super" &&
          forwardingCalls === 0 &&
          safeConstructorArguments(expression.arguments)
        ) {
          superArguments = { kind: "explicit", arguments: expression.arguments };
          forwardingCalls += 1;
          continue;
        }
        harmless = false;
        if (forwardingCalls === 1) replay = "opaque-after-fields";
        break;
      }
      if (harmless && (!cls.superClass || forwardingCalls === 1)) replay = "continue";
      break;
    }
    classConstructorReplay.set(cls, replay);
    classSuperArguments.set(cls, superArguments);
    return replay;
  };

  const groupClassFieldPaths = (paths: ClassFieldPath<T>[]): ClassFieldPath<T>[] => {
    spendWork(budget, 1 + paths.length);
    if (paths.length <= 1) return paths;
    const groups = new Map<ClassFieldReplay, EnvState<T>[]>();
    for (const path of paths) {
      const states = groups.get(path.replay) ?? [];
      states.push(path.state);
      groups.set(path.replay, states);
    }
    const grouped: ClassFieldPath<T>[] = [];
    for (const [replay, states] of groups) {
      spendWork(budget, states.length);
      const first = states[0];
      if (!first) continue;
      if (states.length > 1) joinInto(first, states);
      grouped.push({ state: first, replay });
    }
    return grouped;
  };

  const escapeConstructorCaptures = (state: EnvState<T>, value: ClassValue): void => {
    if (state.completion !== "normal") return;
    if (runCorrelated(state, (path) => escapeConstructorCaptures(path, value))) return;
    escapeCaptured(state, value);
  };

  const superclassArguments = (
    cls: ESTree.Class,
    outer: InvocationArguments,
  ): InvocationArguments => {
    spendWork(budget);
    const forwarding = classSuperArguments.get(cls);
    if (forwarding?.kind === "implicit") return outer;
    if (forwarding?.kind !== "explicit") return { kind: "uncertain" };
    const values: EvaluatedValue[] = [];
    for (const argument of forwarding.arguments) {
      spendWork(budget);
      const expression = unwrapExpression(argument);
      if (!isNode(expression)) return { kind: "uncertain" };
      // Creating a callable has no capture effects. The ordinary helper may
      // consume it; unmodeled class-constructor parameter facts stay unknown.
      const functions: CallableValues = isFunctionLike(expression)
        ? [expression]
        : expression.type === "ClassExpression"
          ? [classValue(expression, [])]
          : [undefined];
      const literalShape = literalShapeFromExpr(expression);
      values.push({
        objectId: undefined,
        functions,
        constant: constantValue(expression),
        ...(literalShape ? { literalShape } : {}),
      });
    }
    return { kind: "positional", values };
  };

  const initializeInstanceFields = (
    state: EnvState<T>,
    value: ClassValue,
    args: InvocationArguments,
  ): void => {
    if (state.completion !== "normal") return;
    if (runCorrelated(state, (path) => initializeInstanceFields(path, value, args))) return;
    // Inheritance length is independent of the syntax nesting depth limit.
    const frames: ClassFieldFrame<T>[] = [];
    const enter = (
      path: EnvState<T>,
      selected: ClassValue,
      incoming: InvocationArguments,
    ): ClassFieldPath<T> | undefined => {
      spendWork(budget, 1 + selected.bases.length);
      if (activeClasses.has(selected)) return { state: path, replay: "continue" };
      const replay = constructorFieldReplay(selected.node);
      if (selected.node.superClass && replay === "opaque") {
        escapeConstructorCaptures(path, selected);
        return { state: path, replay };
      }
      activeClasses.add(selected);
      frames.push({
        state: path,
        value: selected,
        bases: selected.bases.length ? selected.bases : [undefined],
        replay,
        arguments: superclassArguments(selected.node, incoming),
        paths: [],
        pending: [],
        nextBase: 0,
      });
      return undefined;
    };
    if (enter(state, value, args)) return;
    while (frames.length) {
      spendWork(budget);
      const frame = frames.at(-1);
      if (!frame) break;
      const current = frame.pending.pop();
      if (current) {
        let replay = current.replay;
        if (replay === "continue") {
          initializeOwnInstanceFields(current.state, frame.value.node);
          if (current.state.completion === "normal" && frame.replay !== "continue") {
            // Base fields precede parameters/body; a proven derived super
            // prefix also initializes own fields before opaque trailing code.
            // Neither opaque boundary proves a descendant field path.
            escapeConstructorCaptures(current.state, frame.value);
            replay = "opaque";
          }
        }
        frame.paths.push({ state: current.state, replay });
      } else if (frame.nextBase >= frame.bases.length) {
        activeClasses.delete(frame.value);
        frames.pop();
        const grouped = groupClassFieldPaths(frame.paths);
        const parent = frames.at(-1);
        if (parent) {
          spendWork(budget, grouped.length);
          for (const path of grouped) parent.pending.push(path);
        } else if (grouped.length > 1 || grouped[0]?.state !== state) {
          spendWork(budget, grouped.length);
          joinInto(
            state,
            grouped.map((path) => path.state),
          );
        }
      } else {
        const base = frame.bases[frame.nextBase++];
        const path =
          frame.bases.length === 1 ? frame.state : snapshotState(frame.state, cloneData, budget);
        let initialized: ClassFieldPath<T> | undefined;
        if (base?.type === "ClassValue") {
          initialized = enter(path, base, frame.arguments);
        } else {
          const knownFunction =
            frame.value.node.superClass &&
            base &&
            isFunctionLike(base) &&
            base.type !== "ArrowFunctionExpression" &&
            !base.async &&
            !base.generator &&
            !activeFunctions.has(base);
          if (knownFunction) {
            for (const result of invokeKnownFunction(path, base, frame.arguments, "body")) {
              spendWork(budget);
              frame.pending.push({ state: result, replay: "continue" });
            }
            continue;
          }
          if (frame.value.node.superClass) {
            if (
              !base ||
              (base.type !== "ArrowFunctionExpression" && !base.async && !base.generator)
            ) {
              // An unknown superclass can reach descendant captures through its constructor target.
              escapeCaptured(path, base ?? value, "captures-only");
            }
            recordPossibleThrow(path);
          }
          initialized = { state: path, replay: "continue" };
        }
        if (initialized) frame.pending.push(initialized);
      }
    }
  };

  const visitControlFlow = createControlFlowVisitor<T>({
    visit: (node, state, traverseRoot) => visit(node, state, traverseRoot),
    budget,
    cloneData,
    equalsData,
    mergePolicy,
    ancestors,
    tryThrowPaths,
    stopAtAwait,
    joinInto,
    invalidatePattern,
    rememberExpressionResult,
    finishExpressionResults,
  });

  const visit = (node: unknown, state: EnvState<T>, traverseRoot: boolean): void => {
    if (!isNode(node) || state.completion !== "normal") return;
    if (ancestors.length >= MAX_PATH_DEPTH) throw BUDGET_EXCEEDED;
    spendWork(budget);

    if (runCorrelated(state, (path) => visit(node, path, traverseRoot))) return;

    if (isFunctionLike(node) && !traverseRoot) {
      // Wait for actual invocation before deciding whether local syntax needs
      // separate inspection without outer values or invocation-time arguments.
      if (analyzeUncalledFunctions && hasInspectableFunctionSyntax(node)) {
        deferFunctionInspection(node, state);
      }
      return;
    }

    ancestors.push(node);
    if (visitControlFlow(node, state)) {
      if (node.type.endsWith("Statement")) finishExpressionResults(state);
      ancestors.pop();
      return;
    }
    switch (node.type) {
      case "WithStatement": {
        visit(node.object, state, false);
        finishExpressionResults(state);
        if (state.completion !== "normal") break;
        let captures = withCaptureBindings.get(node.body);
        if (!captures && hasLogicalAssignments) {
          const candidates = new Set(capturesOf(node.body, budget));
          walk(node.body, {
            "*": () => spendWork(budget),
            VariableDeclarator(declaration) {
              if (declaration.type !== "VariableDeclarator" || !declaration.init) return;
              walk(declaration.id, {
                "*": () => spendWork(budget),
                Identifier(identifier) {
                  const binding = resolveBinding(bindings, identifier, []);
                  const scope = binding ? bindings.scopeById(binding.scopeId) : null;
                  if (binding && !scopeContains(scope, node.body)) candidates.add(binding.id);
                },
              });
            },
          });
          spendWork(budget, candidates.size);
          captures = [...candidates];
          withCaptureBindings.set(node.body, captures);
        }
        if (captures) {
          const forgetSelectors = (path: EnvState<T>): void => {
            spendWork(budget, captures.length);
            for (const id of captures) {
              if (constantBindings.has(id)) path.constants.set(id, null);
              const functions = path.functions.get(id) ?? [];
              spendWork(budget, functions.length);
              for (const fn of functions) {
                if (fn) forgetCapturedConstants(path, fn);
              }
            }
          };
          if (!runCorrelated(state, forgetSelectors)) forgetSelectors(state);
        }
        visit(node.body, state, false);
        break;
      }
      case "ClassExpression":
      case "ClassDeclaration": {
        const enclosingAssignments = state.assignmentResults;
        const enclosingCallables = state.callableResults;
        state.assignmentResults = new Map();
        state.callableResults = new Map();
        // Expressions run among keys, but their selected callable identities
        // must survive until the later decorator application phase.
        const retainedHeaderValues = new Set<ESTree.Node>();
        const finishClassHeader = (path: EnvState<T>): void => {
          if (!retainedHeaderValues.size) {
            finishExpressionResults(path);
            return;
          }
          const clear = (result: EnvState<T>): void => {
            spendWork(budget, 1 + result.callableResults.size + result.assignmentResults.size);
            result.assignmentResults.clear();
            for (const expression of result.callableResults.keys()) {
              if (!retainedHeaderValues.has(expression)) result.callableResults.delete(expression);
            }
            for (const alternative of result.callablePaths) clear(alternative);
            for (const paths of result.abrupt.values()) {
              for (const alternative of paths) clear(alternative);
            }
          };
          clear(path);
          if (path.callablePaths.length || path.abrupt.size) joinInto(path, [path]);
        };
        const visitClassHeader = (expression: unknown, decorator?: ESTree.Node): void => {
          const evaluate = (path: EnvState<T>): void => {
            const definition = path.callableResults.get(node);
            spendWork(budget, definition?.length ?? 0);
            visit(expression, path, false);
            if (definition) {
              const restore = (result: EnvState<T>): void => {
                spendWork(budget, definition.length);
                result.callableResults.set(node, definition);
              };
              if (!runCorrelated(path, restore)) restore(path);
            }
            if (decorator || expression === node.superClass) {
              const save = (result: EnvState<T>): void => {
                if (result.completion !== "normal") return;
                const selected = functionsFromExpr(result, expression);
                if (decorator) result.callableResults.set(decorator, selected);
                else result.callableResults.set(node, selected);
              };
              if (!runCorrelated(path, save)) save(path);
            }
            finishClassHeader(path);
          };
          if (!runCorrelated(state, evaluate)) evaluate(state);
        };
        const visitClassDecorators = (decorated: ESTree.Node): ESTree.Node[] => {
          const evaluated: ESTree.Node[] = [];
          if (!("decorators" in decorated) || !Array.isArray(decorated.decorators))
            return evaluated;
          for (const decorator of decorated.decorators) {
            spendWork(budget);
            if (isNode(decorator) && "expression" in decorator) {
              retainedHeaderValues.add(decorator);
              visitClassHeader(decorator.expression, decorator);
              evaluated.push(decorator);
            }
          }
          spendWork(budget, evaluated.length);
          return evaluated.reverse();
        };
        const classDecorators = visitClassDecorators(node);
        const memberDecorators: ESTree.Node[] = [];
        if (node.superClass) {
          retainedHeaderValues.add(node);
          visitClassHeader(node.superClass);
        }
        for (const element of node.body.body) {
          spendWork(budget);
          const decorators = visitClassDecorators(element);
          spendWork(budget, decorators.length);
          for (const decorator of decorators) memberDecorators.push(decorator);
          if ("computed" in element && element.computed) visitClassHeader(element.key);
        }
        retainedHeaderValues.add(node);
        const initializeClassValue = (path: EnvState<T>): void => {
          const bases = node.superClass ? (path.callableResults.get(node) ?? [undefined]) : [];
          path.callableResults.set(node, [classValue(node, bases)]);
        };
        if (!runCorrelated(state, initializeClassValue) && state.completion === "normal")
          initializeClassValue(state);
        if (node.id && state.completion === "normal") {
          const innerBinding = resolveBinding(bindings, node.id, ancestors);
          if (innerBinding && referencedBindings.has(innerBinding.id))
            assignFrom(state, node.id, node);
        }
        const escapeDecoratorCaptures = (path: EnvState<T>, fn: ESTree.Node | ClassValue): void => {
          spendWork(budget, capturesOf(fn, budget).length);
          escapeCaptured(path, fn);
        };
        const applyDecorators = (path: EnvState<T>): void => {
          for (const decorators of [memberDecorators, classDecorators]) {
            for (const decorator of decorators) {
              const functions = path.callableResults.get(decorator) ?? [undefined];
              spendWork(budget, 1 + functions.length * 2);
              let exposesTarget = false;
              for (const fn of functions) {
                if (
                  !fn ||
                  !isFunctionLike(fn) ||
                  fn.async ||
                  ("generator" in fn && fn.generator) ||
                  fn.body?.type !== "BlockStatement" ||
                  fn.body.body.length !== 0
                )
                  exposesTarget = true;
                else {
                  spendWork(budget, fn.params.length);
                  if (fn.params.some((param) => param.type !== "Identifier")) exposesTarget = true;
                }
              }
              if (exposesTarget) recordPossibleThrow(path);
              for (const fn of functions) {
                if (fn) escapeDecoratorCaptures(path, fn);
              }
              if (exposesTarget) {
                // Unknown code can use the decorated target or register an
                // initializer. Sticky capture facts survive static writes.
                escapeDecoratorCaptures(path, node);
                recordPossibleThrow(path);
              }
              path.callableResults.delete(decorator);
            }
          }
        };
        if (memberDecorators.length || classDecorators.length) {
          if (!runCorrelated(state, applyDecorators) && state.completion === "normal")
            applyDecorators(state);
          for (const decorator of [...memberDecorators, ...classDecorators])
            retainedHeaderValues.delete(decorator);
        }
        for (const element of node.body.body) {
          spendWork(budget);
          if (element.type === "StaticBlock") visitClassHeader(element);
          else if ("value" in element && (element.type === "MethodDefinition" || element.static))
            visitClassHeader(element.value);
        }
        if (node.type === "ClassDeclaration" && node.id) {
          // The inner name is available to static code; the enclosing
          // declaration is initialized only after the definition completes.
          const id = node.id;
          const initializeOuter = (path: EnvState<T>): void => {
            const binding = bindings.scopeForNode(node, ancestors)?.parent?.bindings.get(id.name);
            if (binding && referencedBindings.has(binding.id)) {
              path.env.set(binding.id, undefined);
              path.functions.set(binding.id, functionsFromExpr(path, node));
              if (path.constants.get(binding.id) === null) forgetCapturedConstants(path, node);
              else if (constantBindings.has(binding.id)) {
                const constant = constantFromExpr(path, node);
                if (constant) path.constants.set(binding.id, constant);
              }
            }
          };
          if (!runCorrelated(state, initializeOuter) && state.completion === "normal")
            initializeOuter(state);
        }
        const restoreEnclosingResults = (path: EnvState<T>): void => {
          spendWork(budget, 1 + enclosingAssignments.size + enclosingCallables.size);
          for (const [expression, value] of enclosingAssignments)
            path.assignmentResults.set(expression, value);
          for (const [expression, value] of enclosingCallables)
            path.callableResults.set(expression, value);
          for (const alternative of path.callablePaths) restoreEnclosingResults(alternative);
          for (const paths of path.abrupt.values()) {
            for (const alternative of paths) restoreEnclosingResults(alternative);
          }
        };
        restoreEnclosingResults(state);
        break;
      }
      case "ObjectExpression":
      case "ArrayExpression":
        visitChildren(node, (child) => visit(child, state, false));
        if (state.completion === "normal") markEscape(state, node);
        break;
      case "VariableDeclarator": {
        const decl = node as ESTree.VariableDeclarator;
        if (decl.init) visit(decl.init, state, false);
        if (state.completion !== "normal") break;
        visitPatternExpressions(state, decl.id);
        if (state.completion !== "normal") break;
        const declaration = ancestors[ancestors.length - 2];
        // `var name;` is a runtime no-op when the hoisted binding already has
        // a value. Lexical declarations still initialize their binding here.
        if (
          decl.init ||
          declaration?.type !== "VariableDeclaration" ||
          declaration.kind !== "var"
        ) {
          assignFrom(state, decl.id, decl.init);
        }
        break;
      }
      case "AssignmentExpression": {
        const assign = node as ESTree.AssignmentExpression;
        const logicalAssignment = ["&&=", "||=", "??="].includes(assign.operator);
        const target = unwrapExpression(assign.left);
        const assignValue = (state: EnvState<T>, accessors: StaticMemberReference): void => {
          if (state.completion !== "normal") return;
          if (logicalAssignment) {
            const leftValue = valueFromExpr(state, assign.left);
            const rightRuns = leftValue.constant
              ? assign.operator === "&&="
                ? leftValue.constant.truthy
                : assign.operator === "||="
                  ? !leftValue.constant.truthy
                  : leftValue.constant.nullish
              : null;
            if (rightRuns === false) {
              state.assignmentResults.set(assign, leftValue);
              return;
            }
            const skipped = rightRuns === null ? snapshotState(state, cloneData, budget) : null;
            if (skipped) skipped.assignmentResults.set(assign, leftValue);
            visit(assign.right, state, false);
            const paths = completionPaths(state, cloneData, budget);
            for (const path of paths) {
              if (path.completion !== "normal") continue;
              const right = normalValueFromExpr(path, assign.right);
              if (right === null) continue;
              const value = valueFromExpr(path, right);
              applyStaticAccessors(path, accessors, "set");
              assignFrom(path, assign.left, right);
              path.assignmentResults.set(assign, value);
            }
            joinInto(state, skipped ? [skipped, ...paths] : paths);
            return;
          }
          visit(assign.right, state, false);
          if (stopAtAwait) {
            const paths = completionPaths(state, cloneData, budget);
            for (const path of paths) {
              if (path.completion !== "normal") continue;
              if (assign.operator === "=") {
                visitPatternExpressions(path, assign.left);
                if (path.completion !== "normal") continue;
                const value = normalValueFromExpr(path, assign.right);
                if (value !== null) {
                  applyStaticAccessors(path, accessors, "set");
                  assignFrom(path, assign.left, value);
                }
              } else {
                applyStaticAccessors(path, accessors, "set");
                invalidatePattern(path, assign.left);
              }
            }
            joinInto(state, paths);
            return;
          }
          if (state.completion !== "normal") return;
          if (assign.operator === "=") {
            visitPatternExpressions(state, assign.left);
            if (state.completion !== "normal") return;
            applyStaticAccessors(state, accessors, "set");
            assignFrom(state, assign.left, assign.right);
          } else {
            applyStaticAccessors(state, accessors, "set");
            invalidatePattern(state, assign.left);
          }
        };
        if (isNode(target) && target.type === "MemberExpression") {
          visitMemberReference(
            state,
            target,
            (path, accessors) => {
              if (assign.operator !== "=") applyStaticAccessors(path, accessors, "get");
              assignValue(path, accessors);
            },
            (path) => preserveWriteReceiver(path, target.object),
          );
        } else {
          if (assign.operator !== "=") visit(assign.left, state, false);
          assignValue(state, { values: [], property: null });
        }
        break;
      }
      case "UpdateExpression": {
        const update = node as ESTree.UpdateExpression;
        const target = unwrapExpression(update.argument);
        const updateValue = (path: EnvState<T>, accessors: StaticMemberReference): void => {
          applyStaticAccessors(path, accessors, "get");
          if (path.completion !== "normal") return;
          invalidatePattern(path, update.argument);
          applyStaticAccessors(path, accessors, "set");
        };
        if (isNode(target) && target.type === "MemberExpression") {
          visitMemberReference(state, target, updateValue, (path) =>
            preserveWriteReceiver(path, target.object),
          );
        } else {
          visit(update.argument, state, false);
          updateValue(state, { values: [], property: null });
        }
        break;
      }
      case "TaggedTemplateExpression": {
        const tagged = node as ESTree.TaggedTemplateExpression;
        const tag = unwrapExpression(tagged.tag);
        const memberTag = isNode(tag) && tag.type === "MemberExpression";
        if (!memberTag) recordCalleeLookupThrow(state, tag);
        let receiver: ESTree.Node | null = null;
        if (memberTag) {
          visitMemberReference(
            state,
            tag,
            (path, accessors) => {
              applyStaticAccessors(path, accessors, "get");
            },
            (path) => {
              receiver = tag.object;
              preserveArgumentValue(path, tag.object);
            },
          );
        } else {
          visit(tagged.tag, state, false);
        }
        if (state.completion !== "normal" || !isNode(tag)) break;
        // Member GetValue follows receiver and computed-key effects, while
        // substitutions are evaluated only after the lookup succeeds.
        if (memberTag) recordCalleeLookupThrow(state, tag);
        const captureTag = (path: EnvState<T>): void => {
          const functions = functionsFromExpr(path, tag);
          spendWork(budget, functions.length);
          path.callableResults.set(tag, functions);
        };
        if (!runCorrelated(state, captureTag)) captureTag(state);
        for (const expression of tagged.quasi.expressions) {
          visit(expression, state, false);
          if (state.completion !== "normal") break;
          preserveArgumentValue(state, expression);
        }
        const invokeTag = (path: EnvState<T>): void => {
          if (runCorrelated(path, invokeTag)) return;
          recordPossibleThrow(path);
          for (const fn of (receiver && path.assignmentResults.get(receiver)?.functions) ?? []) {
            if (fn) escapeCaptured(path, fn);
          }
          const functions = functionsFromExpr(path, tag);
          const tagPaths: EnvState<T>[] = [];
          for (const fn of functions) {
            const caller = functions.length === 1 ? path : snapshotState(path, cloneData, budget);
            let projected: EnvState<T>[];
            if (fn && isFunctionLike(fn) && fn.generator && !activeFunctions.has(fn)) {
              spendWork(budget, tagged.quasi.expressions.length);
              const args: InvocationArguments = {
                kind: "positional",
                values: [
                  {
                    objectId: undefined,
                    functions: [undefined],
                    constant: { truthy: true, nullish: false },
                  },
                  ...tagged.quasi.expressions.map(
                    (expression) =>
                      savedExpressionValue(caller, expression) ?? valueFromExpr(caller, expression),
                  ),
                ],
              };
              projected = invokeKnownFunction(caller, fn, args, "parameters");
              if (!isDefinitelyDiscarded(tagged)) {
                for (const result of projected) {
                  if (result.completion === "normal") escapeCaptured(result, fn, "captures-only");
                }
              }
            } else {
              if (fn)
                escapeCaptured(
                  caller,
                  fn,
                  isFunctionLike(fn) && fn.generator ? "captures-only" : "inspect",
                );
              projected = [caller];
            }
            for (const result of projected) {
              if (result.completion === "normal") {
                for (const expression of tagged.quasi.expressions) markEscape(result, expression);
                recordPossibleThrow(result);
              }
              result.callableResults.delete(tag);
            }
            tagPaths.push(...projected);
          }
          if (tagPaths.length !== 1 || tagPaths[0] !== path) joinInto(path, tagPaths);
        };
        if (state.completion === "normal") invokeTag(state);
        break;
      }
      case "CallExpression": {
        const call = node as ESTree.CallExpression;
        const callee = unwrapExpression(call.callee);
        recordCalleeLookupThrow(state, callee);
        const property = staticPropertyName(callee);
        let objectName: string | null = null;
        let receiver: ESTree.Node | null = null;
        let receiverId: ObjectId | undefined;
        let receiverFunctions: CallableValues = [];
        if (isNode(callee) && callee.type === "MemberExpression") {
          const member = callee as ESTree.MemberExpression;
          // JavaScript captures the member receiver before evaluating a
          // computed property or any arguments. Preserve that identity even
          // when those later expressions reassign its binding.
          visitMemberReference(
            state,
            member,
            (path, accessors) => {
              applyStaticAccessors(path, accessors, "get");
            },
            (path) => {
              const object = unwrapExpression(member.object);
              receiver = isNode(object) ? object : null;
              objectName = getName(object);
              receiverId = objectFromExpr(path, object);
              if (
                hasLogicalAssignments &&
                isNode(object) &&
                (state.callablePaths.length > 0 || path.assignmentResults.has(object))
              ) {
                path.assignmentResults.set(object, valueFromExpr(path, object));
              } else if (hasLogicalAssignments) receiverFunctions = functionsFromExpr(path, object);
            },
          );
        } else {
          visit(call.callee, state, false);
        }
        if (state.completion !== "normal") break;
        if (isNode(callee)) {
          const captureCallee = (path: EnvState<T>): void => {
            path.callableResults.set(callee, functionsFromExpr(path, callee));
          };
          if (!runCorrelated(state, captureCallee)) captureCallee(state);
        }
        for (const arg of call.arguments) {
          visit(arg, state, false);
          if (state.completion !== "normal") break;
          preserveArgumentValue(state, arg);
        }
        if (state.completion !== "normal") break;
        const invoke = (state: EnvState<T>): void => {
          if (runCorrelated(state, invoke)) return;
          const functions = functionsFromExpr(state, call.callee);
          const receiverValue = receiver && state.assignmentResults.get(receiver);
          receiverFunctions = receiverValue?.functions ?? receiverFunctions;
          for (const fn of receiverFunctions) {
            if (fn) {
              if (isFunctionLike(fn)) requireFunctionInspection(state, fn);
              forgetCapturedConstants(state, fn);
            }
          }
          // Invocation remains able to throw after all argument effects complete.
          recordPossibleThrow(state);
          const rec = recordOf(state, receiverValue ? receiverValue.objectId : receiverId);
          if (rec) chargeData(rec.data);
          onCall?.({ call, rec, receiver, objectName, property });
          if (rec && property === null) {
            // A computed call whose property cannot be resolved may invoke any
            // mutating platform method. Keep the receiver identity out of later
            // must-fact and risk conclusions rather than guessing its effects.
            rec.escaped = true;
          }
          const callPaths: EnvState<T>[] = [];
          for (const fn of functions) {
            const caller = functions.length === 1 ? state : snapshotState(state, cloneData, budget);
            if (fn && isFunctionLike(fn) && !activeFunctions.has(fn)) {
              const projected = invokeKnownFunction(
                caller,
                fn,
                evaluatedArguments(caller, call.arguments),
                fn.generator ? "parameters" : "body",
              );
              if (fn.generator) {
                const discarded = isDefinitelyDiscarded(call);
                for (const path of projected) {
                  if (path.completion !== "normal") continue;
                  if (!discarded) escapeCaptured(path, fn, "captures-only");
                  for (const arg of call.arguments) markEscape(path, arg);
                }
              }
              callPaths.push(...projected);
            } else {
              if (fn)
                escapeCaptured(
                  caller,
                  fn,
                  isFunctionLike(fn) && activeFunctions.has(fn) ? "captures-only" : "inspect",
                );
              for (const arg of call.arguments) markEscape(caller, arg);
              callPaths.push(caller);
            }
          }
          if (callPaths.length !== 1 || callPaths[0] !== state) joinInto(state, callPaths);
        };
        invoke(state);
        if (isNode(callee)) {
          const forgetCallee = (path: EnvState<T>): void => {
            path.callableResults.delete(callee);
          };
          if (!runCorrelated(state, forgetCallee)) forgetCallee(state);
        }
        break;
      }
      case "NewExpression": {
        const expr = node as ESTree.NewExpression;
        const callee = unwrapExpression(expr.callee);
        recordCalleeLookupThrow(state, callee);
        const prior = newExpressionIds.get(expr);
        if (prior !== undefined) state.objects.delete(prior);
        visit(expr.callee, state, false);
        if (state.completion !== "normal") break;
        if (isNode(callee)) {
          const captureConstructor = (path: EnvState<T>): void => {
            const functions = functionsFromExpr(path, callee);
            spendWork(budget, functions.length);
            if (
              functions.some((fn) => fn !== undefined) ||
              callee.type !== "Identifier" ||
              resolveBinding(bindings, callee, ancestors)
            ) {
              path.callableResults.set(callee, functions);
            }
          };
          if (!runCorrelated(state, captureConstructor)) captureConstructor(state);
        }
        for (const arg of expr.arguments) {
          visit(arg, state, false);
          if (state.completion !== "normal") break;
          preserveArgumentValue(state, arg);
        }
        const construct = (path: EnvState<T>): void => {
          if (runCorrelated(path, construct)) return;
          // Constructor invocation may fail after all arguments complete,
          // before any body or instance initializer effects are established.
          recordPossibleThrow(path);
          const functions = functionsFromExpr(path, expr.callee);
          spendWork(budget, functions.length);
          const constructed: EnvState<T>[] = [];
          for (const fn of functions) {
            const invocation =
              functions.length === 1 ? path : snapshotState(path, cloneData, budget);
            const knownClass = fn?.type === "ClassValue";
            const knownFunction =
              fn &&
              isFunctionLike(fn) &&
              fn.type !== "ArrowFunctionExpression" &&
              !fn.async &&
              !fn.generator &&
              !activeFunctions.has(fn);
            if (knownClass)
              initializeInstanceFields(
                invocation,
                fn,
                evaluatedArguments(invocation, expr.arguments),
              );
            const results = knownFunction
              ? invokeKnownFunction(
                  invocation,
                  fn,
                  evaluatedArguments(invocation, expr.arguments),
                  "body",
                )
              : [invocation];
            const finishConstruction = (result: EnvState<T>): void => {
              if (runCorrelated(result, finishConstruction)) return;
              if (knownClass) escapeCaptured(result, fn);
              else if (fn && !knownFunction) forgetCapturedConstants(result, fn);
              for (const arg of expr.arguments) markEscape(result, arg);
              // Construction can throw after field and argument evaluation but before allocation.
              recordPossibleThrow(result);
              objectFromExpr(result, expr);
              if (isNode(callee)) result.callableResults.delete(callee);
            };
            for (const result of results) {
              if (result.completion === "normal") finishConstruction(result);
              constructed.push(result);
            }
          }
          if (constructed.length !== 1 || constructed[0] !== path) joinInto(path, constructed);
        };
        if (state.completion === "normal") construct(state);
        break;
      }
      case "AwaitExpression": {
        visit((node as ESTree.AwaitExpression).argument, state, false);
        if (stopAtAwait && state.completion === "normal") setCompletion(state, "suspend");
        break;
      }
      case "ReturnStatement":
        visit((node as ESTree.ReturnStatement).argument, state, false);
        if (state.completion === "normal") {
          markEscape(state, (node as ESTree.ReturnStatement).argument);
          setCompletion(state, "return");
        }
        break;
      case "ThrowStatement":
        visit((node as ESTree.ThrowStatement).argument, state, false);
        if (state.completion === "normal") {
          markEscape(state, (node as ESTree.ThrowStatement).argument);
          setCompletion(state, "throw");
        }
        break;
      case "BreakStatement":
        setCompletion(state, "break", getName((node as ESTree.BreakStatement).label));
        break;
      case "ContinueStatement":
        setCompletion(state, "continue", getName((node as ESTree.ContinueStatement).label));
        break;
      case "Identifier": {
        if (isValueReference(node, ancestors)) {
          const name = getName(node);
          const binding = resolveBinding(bindings, node, ancestors);
          const objectId = objectFromExpr(state, node);
          publishRef({
            node,
            rec: objectId !== undefined ? state.objects.get(objectId) : undefined,
            name,
            bindingId: binding?.id ?? null,
          });
        }
        break;
      }
      case "MemberExpression": {
        objectFromExpr(state, node);
        let child: ESTree.Node = node;
        let deleted = false;
        for (let index = ancestors.length - 2; index >= 0; index -= 1) {
          spendWork(budget);
          const parent = ancestors[index];
          if (!parent) break;
          if (TRANSPARENT_WRAPPER_TYPES.has(parent.type)) {
            child = parent;
            continue;
          }
          deleted =
            parent.type === "UnaryExpression" &&
            parent.operator === "delete" &&
            parent.argument === child;
          break;
        }
        visitMemberReference(state, node, (path, accessors) => {
          if (deleted) degradeStaticShadow(accessors);
          else applyStaticAccessors(path, accessors, "get");
        });
        break;
      }
      default:
        visitChildren(node, (child) => visit(child, state, false));
    }
    if (
      node.type.endsWith("Statement") ||
      node.type === "VariableDeclaration" ||
      node.type === "ClassDeclaration"
    )
      finishExpressionResults(state);
    ancestors.pop();
  };

  const finalState: EnvState<T> = {
    env: new Map(),
    functions: new Map(hoistedFunctions),
    constants: new Map(),
    exposedCallables: new Set(),
    assignmentResults: new Map(),
    callableResults: new Map(),
    objects: new Map(),
    callablePaths: [],
    completion: "normal",
    abrupt: new Map(),
  };
  try {
    spendWork(budget, referenceWork);
    if (hasLogicalAssignments) {
      const dependencies = new Map<BindingId, Set<BindingId>>();
      const visitValueSources = (
        expression: ESTree.Node | null | undefined,
        consume: (value: ESTree.Node) => void,
      ): void => {
        const pending = [{ value: expression, depth: 0 }];
        while (pending.length) {
          spendWork(budget);
          const candidate = pending.pop();
          if (!candidate || candidate.depth >= MAX_PATH_DEPTH) continue;
          const value = unwrapExpression(candidate.value);
          if (!isNode(value)) continue;
          const nextDepth = candidate.depth + 1;
          if (value.type === "SequenceExpression") {
            pending.push({ value: value.expressions.at(-1) ?? null, depth: nextDepth });
          } else if (value.type === "AssignmentExpression" && value.operator === "=") {
            pending.push({ value: value.right, depth: nextDepth });
          } else if (value.type === "ConditionalExpression") {
            pending.push(
              { value: value.consequent, depth: nextDepth },
              { value: value.alternate, depth: nextDepth },
            );
          } else if (
            value.type === "LogicalExpression" ||
            (value.type === "AssignmentExpression" &&
              ["&&=", "||=", "??="].includes(value.operator))
          ) {
            pending.push(
              { value: value.left, depth: nextDepth },
              { value: value.right, depth: nextDepth },
            );
          } else consume(value);
        }
      };
      for (const source of constantSources) {
        spendWork(budget);
        const target = resolveBinding(bindings, source.left, []);
        if (!target) continue;
        visitValueSources(source.right, (value) => {
          if (isFunctionLike(value)) {
            rememberFunctionOrigin(target.id, value);
            callableBindings.add(target.id);
            return;
          }
          const origin = resolveBinding(bindings, value, []);
          if (!origin) return;
          const sources = dependencies.get(target.id) ?? new Set<BindingId>();
          sources.add(origin.id);
          dependencies.set(target.id, sources);
        });
      }
      const dependents = new Map<BindingId, Set<BindingId>>();
      for (const [target, sources] of dependencies) {
        for (const source of sources) {
          spendWork(budget);
          const targets = dependents.get(source) ?? new Set<BindingId>();
          targets.add(target);
          dependents.set(source, targets);
        }
      }
      const callableOrigins = new Map<BindingId, Set<ImmediateFunction>>();
      const pendingOrigins: Array<readonly [BindingId, ImmediateFunction]> = [];
      const addCallableOrigin = (id: BindingId, fn: ImmediateFunction): void => {
        spendWork(budget);
        const functions = callableOrigins.get(id) ?? new Set<ImmediateFunction>();
        if (functions.has(fn)) return;
        functions.add(fn);
        callableOrigins.set(id, functions);
        pendingOrigins.push([id, fn]);
      };
      const propagateCallableOrigins = (): void => {
        while (pendingOrigins.length) {
          spendWork(budget);
          const origin = pendingOrigins.pop();
          if (!origin) continue;
          const [id, fn] = origin;
          for (const target of dependents.get(id) ?? []) {
            spendWork(budget);
            addCallableOrigin(target, fn);
          }
        }
      };
      for (const [id, functions] of directFunctionOrigins) {
        for (const fn of functions) addCallableOrigin(id, fn);
      }
      propagateCallableOrigins();
      const indexedDefaultArguments = new WeakSet<ESTree.Node>();
      for (const call of constantInvocations) {
        spendWork(budget);
        // Frozen class values carry runtime heritage; the function-origin
        // index cannot connect these New arguments to ordinary base params.
        if (hasClassHeritage && call.type === "NewExpression") {
          for (const argument of call.arguments) {
            spendWork(budget);
            if (indexedDefaultArguments.has(argument)) continue;
            indexedDefaultArguments.add(argument);
            visitValueSources(argument, (value) => {
              const source = resolveBinding(bindings, value, []);
              if (source) constantBindings.add(source.id);
            });
          }
        }
        const tagged = call.type === "TaggedTemplateExpression";
        const callee = unwrapExpression(tagged ? call.tag : call.callee);
        const functions = new Set<ImmediateFunction>();
        if (isNode(callee) && isFunctionLike(callee)) functions.add(callee);
        const binding = resolveBinding(bindings, callee, []);
        for (const fn of (binding && callableOrigins.get(binding.id)) || []) {
          spendWork(budget);
          functions.add(fn);
        }
        for (const fn of functions) {
          if (tagged && !fn.generator) continue;
          rememberInspectionOrder(call, fn);
          for (let index = 0; index < fn.params.length; index += 1) {
            spendWork(budget);
            const param = unwrapExpression(fn.params[index]);
            const target = resolveBinding(
              bindings,
              isNode(param) && param.type === "AssignmentPattern" ? param.left : param,
              [],
            );
            if (target && isNode(param) && param.type === "AssignmentPattern")
              constantBindings.add(target.id);
            const argument = tagged ? call.quasi.expressions[index - 1] : call.arguments[index];
            const origin = resolveBinding(bindings, argument, []);
            if (
              isNode(param) &&
              param.type === "AssignmentPattern" &&
              isNode(argument) &&
              !indexedDefaultArguments.has(argument)
            ) {
              indexedDefaultArguments.add(argument);
              visitValueSources(argument, (value) => {
                const source = resolveBinding(bindings, value, []);
                if (source) constantBindings.add(source.id);
              });
            }
            if (!target || !origin) continue;
            const sources = dependencies.get(target.id) ?? new Set<BindingId>();
            if (sources.has(origin.id)) continue;
            sources.add(origin.id);
            dependencies.set(target.id, sources);
            const targets = dependents.get(origin.id) ?? new Set<BindingId>();
            targets.add(target.id);
            dependents.set(origin.id, targets);
            for (const fn of callableOrigins.get(origin.id) ?? []) {
              spendWork(budget);
              addCallableOrigin(target.id, fn);
            }
          }
        }
        propagateCallableOrigins();
      }
      const pending = [...constantBindings];
      while (pending.length) {
        spendWork(budget);
        const id = pending.pop();
        if (id === undefined) continue;
        for (const source of dependencies.get(id) ?? []) {
          spendWork(budget);
          if (constantBindings.has(source)) continue;
          constantBindings.add(source);
          pending.push(source);
        }
      }
    } else if (analyzeUncalledFunctions) {
      for (const call of constantInvocations) {
        spendWork(budget);
        if (call.type !== "CallExpression" && call.type !== "NewExpression") continue;
        const callee = unwrapExpression(call.callee);
        if (isNode(callee) && isFunctionLike(callee)) rememberInspectionOrder(call, callee);
        const binding = resolveBinding(bindings, callee, []);
        for (const fn of (binding && directFunctionOrigins.get(binding.id)) || [])
          rememberInspectionOrder(call, fn);
      }
    }
    visit(program, finalState, true);
    // Inspect uninvoked callers before their known callees, so a helper replay
    // supplies arguments before its body could be inspected in isolation.
    // Cycles choose one pending body; each body and origin edge is visited once.
    while (pendingFunctions.size) {
      spendWork(budget);
      let fn = readyFunctions[nextReadyFunction];
      if (nextReadyFunction < readyFunctions.length) nextReadyFunction += 1;
      if (fn && pendingFunctions.get(fn) !== 0) continue;
      fn ??= pendingFunctions.keys().next().value;
      if (!fn) break;
      pendingFunctions.delete(fn);
      for (const callee of functionCallees.get(fn) ?? []) {
        spendWork(budget);
        const callers = pendingFunctions.get(callee);
        if (callers === undefined) continue;
        pendingFunctions.set(callee, callers - 1);
        if (callers === 1) readyFunctions.push(callee);
      }
      if (
        (invokedFunctions.has(fn) && !requiredFunctionInspections.has(fn)) ||
        inspectedFunctions.has(fn)
      )
        continue;
      inspectedFunctions.add(fn);
      spendWork(budget, finalState.functions.size + finalState.exposedCallables.size);
      const local: EnvState<T> = {
        env: new Map(),
        functions: new Map(finalState.functions),
        constants: new Map(),
        exposedCallables: new Set(finalState.exposedCallables),
        assignmentResults: new Map(),
        callableResults: new Map(),
        objects: new Map(),
        callablePaths: [],
        completion: "normal",
        abrupt: new Map(),
      };
      // Import remembered captures before replay. Writes made by the body then
      // dominate normally; importing at each call would resurrect old values.
      const pendingCaptures = [fn];
      const seenCaptures = new Set<ImmediateFunction>();
      while (pendingCaptures.length) {
        spendWork(budget);
        const current = pendingCaptures.pop();
        if (!current || seenCaptures.has(current)) continue;
        seenCaptures.add(current);
        for (const [id, prior] of inspectionFunctions.get(current) ?? []) {
          const existing = local.functions.get(id) ?? [undefined];
          spendWork(budget, 1 + prior.length + existing.length);
          const values = [...new Set([...prior, ...existing])];
          local.functions.set(id, values);
          spendWork(budget, values.length);
          for (const captured of values) {
            if (captured && isFunctionLike(captured)) pendingCaptures.push(captured);
          }
        }
      }
      visit(fn, local, true);
    }
    if (onExit) {
      onExit(
        completionPaths(finalState, cloneData, budget).map((path) => ({
          completion: path.completion === "suspend" ? "return" : path.completion,
          records: [...path.objects.values()],
        })),
      );
    }
    return { outcome: "complete" };
  } catch (error) {
    if (error !== BUDGET_EXCEEDED) throw error;
    return exhaustedPathAnalysis(analysis);
  }
}
