import { createPathValueResolver, resolveBinding } from "./path-values.js";
import { createControlFlowVisitor } from "./path-control-flow.js";
import type {
  AbruptCompletion,
  BindingId,
  CallableValues,
  EnvState,
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
  isNode,
  isValueReference,
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
import { isDefinitelyUndefinedValue, staticPropertyName } from "./members.js";

function scopeContains(scope: ScopeNode | null, block: ESTree.Node): boolean {
  let current = scope;
  while (current) {
    if (current.block === block) return true;
    current = current.parent;
  }
  return false;
}

function capturedBindings(fn: ESTree.Node, bindings: FileBindings): BindingId[] {
  const found = new Set<BindingId>();
  const ancestors: ESTree.Node[] = [];
  const visit = (node: unknown): void => {
    if (!isNode(node)) return;
    ancestors.push(node);
    if (node.type === "Identifier" && isValueReference(node, ancestors)) {
      const binding = bindings.resolve(getName(node) ?? "", node, ancestors);
      const declared = binding ? bindings.scopeById(binding.scopeId) : null;
      if (binding && !scopeContains(declared, fn)) {
        found.add(binding.id);
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
  const declaredFunctions = new Map<BindingId, ImmediateFunction>();
  const directlyCalledFunctions = new WeakSet<ESTree.Node>();
  const activeFunctions = new Set<ESTree.Node>();
  const functionCaptures = new WeakMap<ESTree.Node, readonly BindingId[]>();
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
  };

  const recordPossibleThrow = (state: EnvState<T>): void => {
    const paths = tryThrowPaths[tryThrowPaths.length - 1];
    if (!paths || state.completion !== "normal") return;
    const possibleThrow = snapshotState(state, cloneData, budget);
    setCompletion(possibleThrow, "throw");
    paths.push(possibleThrow);
  };

  const capturesOf = (fn: ESTree.Node): readonly BindingId[] => {
    const existing = functionCaptures.get(fn);
    if (existing) return existing;
    const captures = capturedBindings(fn, bindings);
    functionCaptures.set(fn, captures);
    return captures;
  };

  // Function declarations are callable before their source position. Record
  // only callable identity here; captured runtime values remain temporal.
  walk(program, {
    FunctionDeclaration(node) {
      if (!isFunctionLike(node)) return;
      const id = node.id;
      const name = getName(id);
      if (!id || !name) return;
      const binding = bindings.resolve(name, id);
      if (binding) {
        hoistedFunctions.set(binding.id, [node]);
        declaredFunctions.set(binding.id, node);
      }
    },
    VariableDeclarator(node) {
      const declaration = node as ESTree.VariableDeclarator;
      const id = unwrapExpression(declaration.id);
      const init = unwrapExpression(declaration.init);
      if (!isNode(id) || id.type !== "Identifier" || !isNode(init) || !isFunctionLike(init)) return;
      const binding = bindings.resolve(getName(id) ?? "", id);
      if (binding) declaredFunctions.set(binding.id, init);
    },
  });
  walk(program, {
    CallExpression(node) {
      const callee = unwrapExpression((node as ESTree.CallExpression).callee);
      if (!isNode(callee)) return;
      if (isFunctionLike(callee)) {
        directlyCalledFunctions.add(callee);
        return;
      }
      if (callee.type !== "Identifier") return;
      const binding = bindings.resolve(getName(callee) ?? "", callee);
      const fn = binding ? declaredFunctions.get(binding.id) : undefined;
      if (fn) directlyCalledFunctions.add(fn);
    },
  });

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

  const { objectFromExpr, functionsFromExpr, normalValueFromExpr } = createPathValueResolver<T>({
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
  });

  const markEscape = (state: EnvState<T>, node: unknown): void => {
    if (runCorrelated(state, (path) => markEscape(path, node))) return;
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return;
    switch (expr.type) {
      case "Identifier": {
        const binding = resolveBinding(bindings, expr, ancestors);
        if (!binding) return;
        for (const fn of state.functions.get(binding.id) ?? []) {
          if (!fn) continue;
          for (const capturedId of capturesOf(fn)) {
            const capturedObjectId = state.env.get(capturedId);
            const captured =
              capturedObjectId === undefined ? undefined : state.objects.get(capturedObjectId);
            if (captured) captured.escaped = true;
          }
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
        markEscape(state, cond.consequent);
        markEscape(state, cond.alternate);
        return;
      }
      case "LogicalExpression": {
        const logical = expr as ESTree.LogicalExpression;
        markEscape(state, logical.left);
        markEscape(state, logical.right);
        return;
      }
      case "AssignmentExpression":
        markEscape(state, (expr as ESTree.AssignmentExpression).right);
        return;
      case "SequenceExpression":
        for (const item of (expr as ESTree.SequenceExpression).expressions) markEscape(state, item);
        return;
      default:
        return;
    }
  };

  const escapeCaptured = (state: EnvState<T>, fn: ESTree.Node): void => {
    for (const capturedId of capturesOf(fn)) {
      const objectId = state.env.get(capturedId);
      const captured = objectId === undefined ? undefined : state.objects.get(objectId);
      if (captured) captured.escaped = true;
    }
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
      }
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
      if (binding) {
        state.env.set(binding.id, objectId);
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

  const visitPatternExpressions = (state: EnvState<T>, pattern: unknown): void => {
    const inner = unwrapExpression(pattern);
    if (!isNode(inner)) return;
    if (inner.type === "AssignmentPattern") {
      const withDefault = snapshotState(state, cloneData, budget);
      visit((inner as ESTree.AssignmentPattern).right, withDefault, false);
      joinInto(state, [snapshotState(state, cloneData, budget), withDefault]);
      visitPatternExpressions(state, (inner as ESTree.AssignmentPattern).left);
      return;
    }
    if (inner.type === "RestElement") {
      visitPatternExpressions(state, inner.argument);
      return;
    }
    if (inner.type === "ObjectPattern") {
      for (const prop of (inner as ESTree.ObjectPattern).properties) {
        if (!isNode(prop)) continue;
        if (prop.type === "RestElement") visitPatternExpressions(state, prop.argument);
        else if (prop.type === "Property") {
          const property = prop as ESTree.ObjectProperty;
          if (property.computed) visit(property.key, state, false);
          visitPatternExpressions(state, property.value);
        }
      }
      return;
    }
    if (inner.type === "ArrayPattern") {
      for (const element of (inner as ESTree.ArrayPattern).elements)
        visitPatternExpressions(state, element);
    }
  };

  const assignFrom = (state: EnvState<T>, left: unknown, right: unknown): void => {
    if (runCorrelated(state, (path) => assignFrom(path, left, right))) return;
    const target = unwrapExpression(left);
    if (isNode(target) && target.type === "MemberExpression") {
      markEscape(state, right);
      return;
    }
    const objectId = objectFromExpr(state, right);
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
        const values = functionsFromExpr(state, right);
        if (values.some((value) => value !== undefined)) state.functions.set(binding.id, values);
        else state.functions.delete(binding.id);
      }
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

  const rememberCallableResult = (state: EnvState<T>, node: ESTree.Node, value: unknown): void => {
    if (state.callablePaths.length) {
      for (const path of state.callablePaths) rememberCallableResult(path, node, value);
      return;
    }
    const values = functionsFromExpr(state, value);
    if (values.some((fn) => fn !== undefined)) state.callableResults.set(node, values);
  };

  const finishCallableResults = (state: EnvState<T>): void => {
    if (state.callablePaths.length) {
      const paths = completionPaths(state, cloneData, budget);
      for (const path of paths) path.callableResults.clear();
      joinInto(state, paths);
    }
    state.callableResults.clear();
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
    rememberCallableResult,
  });

  const visit = (node: unknown, state: EnvState<T>, traverseRoot: boolean): void => {
    if (!isNode(node) || state.completion !== "normal") return;
    if (ancestors.length >= MAX_PATH_DEPTH) throw BUDGET_EXCEEDED;
    spendWork(budget);

    if (runCorrelated(state, (path) => visit(node, path, traverseRoot))) return;

    if (isFunctionLike(node) && !traverseRoot) {
      // Analyze local syntax once, without definition-time outer values. A
      // proven direct call below replays it with invocation-time arguments.
      if (analyzeUncalledFunctions && !directlyCalledFunctions.has(node)) {
        const local = snapshotState(state, cloneData, budget);
        local.env.clear();
        local.objects.clear();
        local.callablePaths = [];
        local.callableResults.clear();
        visit(node, local, true);
      }
      return;
    }

    ancestors.push(node);
    if (visitControlFlow(node, state)) {
      ancestors.pop();
      return;
    }
    switch (node.type) {
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
        if (isNode(target) && target.type === "MemberExpression") {
          visit(target.object, state, false);
          if (state.completion !== "normal") break;
          if (target.computed) visit(target.property, state, false);
        } else if (assign.operator !== "=") {
          visit(assign.left, state, false);
        }
        if (state.completion !== "normal") break;
        const afterLeft = logicalAssignment ? snapshotState(state, cloneData, budget) : null;
        visit(assign.right, state, false);
        if (stopAtAwait) {
          const paths = completionPaths(state, cloneData, budget);
          for (const path of paths) {
            if (path.completion !== "normal") continue;
            if (assign.operator === "=" || logicalAssignment) {
              if (assign.operator === "=") {
                visitPatternExpressions(path, assign.left);
                if (path.completion !== "normal") continue;
              }
              const value = normalValueFromExpr(path, assign.right);
              if (value !== null) assignFrom(path, assign.left, value);
            } else {
              invalidatePattern(path, assign.left);
            }
          }
          joinInto(state, afterLeft ? [afterLeft, ...paths] : paths);
          break;
        }
        if (afterLeft) joinInto(state, [afterLeft, snapshotState(state, cloneData, budget)]);
        if (assign.operator === "=") {
          visitPatternExpressions(state, assign.left);
          assignFrom(state, assign.left, assign.right);
        } else {
          invalidatePattern(state, assign.left);
        }
        break;
      }
      case "UpdateExpression": {
        const update = node as ESTree.UpdateExpression;
        visit(update.argument, state, false);
        if (state.completion !== "normal") break;
        // Both prefix and postfix update coerce the old value and write a
        // number back to the binding. The expression result is never the
        // tracked object identity.
        invalidatePattern(state, update.argument);
        break;
      }
      case "CallExpression": {
        const call = node as ESTree.CallExpression;
        recordPossibleThrow(state);
        const callee = unwrapExpression(call.callee);
        const property = staticPropertyName(callee);
        let objectName: string | null = null;
        let receiver: ESTree.Node | null = null;
        let receiverId: ObjectId | undefined;
        if (isNode(callee) && callee.type === "MemberExpression") {
          const member = callee as ESTree.MemberExpression;
          // JavaScript captures the member receiver before evaluating a
          // computed property or any arguments. Preserve that identity even
          // when those later expressions reassign its binding.
          ancestors.push(member);
          visit(member.object, state, false);
          if (state.completion === "normal") {
            const object = unwrapExpression(member.object);
            receiver = isNode(object) ? object : null;
            objectName = getName(object);
            receiverId = objectFromExpr(state, object);
            if (member.computed) visit(member.property, state, false);
          }
          ancestors.pop();
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
        const argumentIds: Array<ObjectId | undefined> = [];
        for (const arg of call.arguments) {
          visit(arg, state, false);
          if (state.completion !== "normal") break;
          argumentIds.push(objectFromExpr(state, arg));
        }
        if (state.completion !== "normal") break;
        const invoke = (state: EnvState<T>): void => {
          if (runCorrelated(state, invoke)) return;
          const functions = functionsFromExpr(state, call.callee);
          // Invocation remains able to throw after all argument effects complete.
          recordPossibleThrow(state);
          const rec = recordOf(state, receiverId);
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
            const deferred = Boolean(fn?.generator);
            if (fn && !deferred && !activeFunctions.has(fn)) {
              activeFunctions.add(fn);
              const invocation = snapshotState(caller, cloneData, budget);
              const { params } = fn;
              const hasSpreadArgument = call.arguments.some(
                (argument) => argument.type === "SpreadElement",
              );
              ancestors.push(fn);
              for (let index = 0; index < params.length; index += 1) {
                const param = unwrapExpression(params[index]);
                if (
                  !hasSpreadArgument &&
                  isNode(param) &&
                  param.type === "AssignmentPattern" &&
                  (index >= call.arguments.length ||
                    isDefinitelyUndefinedValue(call.arguments[index], bindings))
                ) {
                  const assignment = param as ESTree.AssignmentPattern;
                  visit(assignment.right, invocation, false);
                  bindPattern(
                    invocation,
                    assignment.left,
                    objectFromExpr(invocation, assignment.right),
                  );
                } else {
                  bindPattern(
                    invocation,
                    params[index],
                    hasSpreadArgument ? undefined : argumentIds[index],
                  );
                }
              }
              const { body } = fn;
              visit(body, invocation, false);
              ancestors.pop();
              const returned = completionPaths(invocation, cloneData, budget);
              const asyncFunction = Boolean(fn.async);
              for (const path of returned) {
                if (
                  path.completion === "return" ||
                  path.completion === "suspend" ||
                  (asyncFunction && path.completion === "throw")
                ) {
                  setCompletion(path, "normal");
                }
              }
              const capturedIds = capturesOf(fn);
              const projected = returned.map((path) => {
                const result = snapshotState(caller, cloneData, budget);
                result.objects = new Map(path.objects);
                for (const id of capturedIds) {
                  result.env.set(id, path.env.get(id));
                  const values = path.functions.get(id);
                  if (values) result.functions.set(id, values);
                  else result.functions.delete(id);
                }
                setCompletion(result, path.completion, path.completionLabel ?? null);
                return result;
              });
              callPaths.push(...projected);
              activeFunctions.delete(fn);
            } else if (fn && deferred) {
              const parent = ancestors[ancestors.length - 2];
              const discarded =
                parent?.type === "ExpressionStatement" &&
                (parent as ESTree.ExpressionStatement).expression === call;
              if (!discarded) escapeCaptured(caller, fn);
              for (const arg of call.arguments) markEscape(caller, arg);
              callPaths.push(caller);
            } else {
              if (fn) escapeCaptured(caller, fn);
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
        recordPossibleThrow(state);
        const prior = newExpressionIds.get(expr);
        if (prior !== undefined) state.objects.delete(prior);
        visit(expr.callee, state, false);
        if (state.completion !== "normal") break;
        for (const arg of expr.arguments) {
          visit(arg, state, false);
          if (state.completion !== "normal") break;
        }
        if (state.completion !== "normal") break;
        // Construction can throw after argument evaluation but before allocation.
        recordPossibleThrow(state);
        for (const arg of expr.arguments) markEscape(state, arg);
        objectFromExpr(state, expr);
        break;
      }
      case "AwaitExpression": {
        visit((node as ESTree.AwaitExpression).argument, state, false);
        if (stopAtAwait && state.completion === "normal") setCompletion(state, "suspend");
        break;
      }
      case "ReturnStatement":
        markEscape(state, (node as ESTree.ReturnStatement).argument);
        visit((node as ESTree.ReturnStatement).argument, state, false);
        if (state.completion === "normal") setCompletion(state, "return");
        break;
      case "ThrowStatement":
        markEscape(state, (node as ESTree.ThrowStatement).argument);
        visit((node as ESTree.ThrowStatement).argument, state, false);
        if (state.completion === "normal") setCompletion(state, "throw");
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
      case "MemberExpression":
        objectFromExpr(state, node);
        visitChildren(node, (child) => visit(child, state, false));
        break;
      default:
        visitChildren(node, (child) => visit(child, state, false));
    }
    if (node.type === "ExpressionStatement" || node.type === "VariableDeclaration")
      finishCallableResults(state);
    ancestors.pop();
  };

  const finalState: EnvState<T> = {
    env: new Map(),
    functions: new Map(hoistedFunctions),
    callableResults: new Map(),
    objects: new Map(),
    callablePaths: [],
    completion: "normal",
    abrupt: new Map(),
  };
  try {
    visit(program, finalState, true);
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
