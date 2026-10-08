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
  EnvState,
  EvaluatedValue,
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
  const directlyCalledFunctions = new WeakSet<ESTree.Node>();
  const directlyCalledBindings = new Set<BindingId>();
  const activeFunctions = new Set<ESTree.Node>();
  const functionCaptures = new WeakMap<ESTree.Node, readonly BindingId[]>();
  const argumentObjectIds = new WeakMap<ImmediateFunction, ObjectId>();
  const mappedArguments = new Map<ObjectId, readonly BindingId[]>();
  const argumentsBinding = (node: ESTree.Node): BindingId | undefined => {
    if (getName(node) !== "arguments" || resolveBinding(bindings, node, ancestors))
      return undefined;
    let scope = bindings.scopeForNode(node, ancestors);
    while (scope) {
      if (isFunctionLike(scope.block) && scope.block.type !== "ArrowFunctionExpression") {
        const objectId = argumentObjectIds.get(scope.block);
        return objectId === undefined ? undefined : -objectId;
      }
      scope = scope.parent;
    }
    return undefined;
  };
  const forgetMappedArguments = (
    state: EnvState<T>,
    objectId: ObjectId | undefined,
    escaped = false,
  ): void => {
    if (objectId === undefined) return;
    for (const id of mappedArguments.get(objectId) ?? []) {
      spendWork(budget);
      state.env.set(id, undefined);
      state.functions.delete(id);
      if (escaped) state.constants.set(id, null);
      else if (state.constants.get(id) !== null) state.constants.delete(id);
    }
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
      if (statement.expression.value === "use strict") return true;
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
  const constantBindings = new Set<BindingId>();
  const constantSources: Array<{ left: ESTree.Node; right: ESTree.Node | null }> = [];
  const constantCalls: ESTree.CallExpression[] = [];
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

  const capturesOf = (
    fn: ESTree.Node,
    captureBudget = hasLogicalAssignments ? budget : undefined,
  ): readonly BindingId[] => {
    const existing = functionCaptures.get(fn);
    if (existing) return existing;
    const captures = capturedBindings(fn, bindings, captureBudget, (node) => {
      const id = argumentsBinding(node);
      const own = isFunctionLike(fn) ? argumentObjectIds.get(fn) : undefined;
      return id !== undefined && id !== (own === undefined ? undefined : -own) ? id : undefined;
    });
    functionCaptures.set(fn, captures);
    return captures;
  };

  const rememberFunctionOrigin = (id: BindingId, fn: ImmediateFunction): void => {
    const functions = directFunctionOrigins.get(id) ?? new Set<ImmediateFunction>();
    functions.add(fn);
    directFunctionOrigins.set(id, functions);
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
        const binding = resolveBinding(bindings, node, prepassAncestors);
        if (binding) referencedBindings.add(binding.id);
      },
      AssignmentPattern(node) {
        if (node.type === "AssignmentPattern")
          constantSources.push({ left: node.left, right: node.right });
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
    CallExpression(node) {
      constantCalls.push(node as ESTree.CallExpression);
      const callee = unwrapExpression((node as ESTree.CallExpression).callee);
      if (!isNode(callee)) return;
      if (isFunctionLike(callee)) {
        directlyCalledFunctions.add(callee);
        return;
      }
      if (callee.type !== "Identifier") return;
      const binding = bindings.resolve(getName(callee) ?? "", callee);
      if (binding) directlyCalledBindings.add(binding.id);
    },
  });
  for (const id of directlyCalledBindings) {
    for (const fn of directFunctionOrigins.get(id) ?? []) {
      referenceWork += 1;
      directlyCalledFunctions.add(fn);
    }
  }

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
      case "ClassExpression":
      case "ClassDeclaration":
        escapeCaptured(state, expr);
        return;
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

  const forgetCapturedConstants = (state: EnvState<T>, fn: ESTree.Node): void => {
    if (!hasLogicalAssignments) return;
    const pending = [fn];
    const seen = new Set<ESTree.Node>();
    while (pending.length) {
      spendWork(budget);
      const current = pending.pop();
      if (!current || seen.has(current)) continue;
      seen.add(current);
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

  const escapeCaptured = (state: EnvState<T>, fn: ESTree.Node): void => {
    forgetCapturedConstants(state, fn);
    for (const capturedId of capturesOf(fn)) {
      const objectId = state.env.get(capturedId);
      const captured = objectId === undefined ? undefined : state.objects.get(objectId);
      if (captured) captured.escaped = true;
    }
  };

  const preserveArgumentValue = (state: EnvState<T>, node: ESTree.Node): void => {
    if (!hasLogicalAssignments) return;
    const preserve = (path: EnvState<T>): void => {
      spendWork(budget);
      const value = node.type === "SpreadElement" ? node.argument : node;
      path.assignmentResults.set(node, valueFromExpr(path, value));
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
      forgetMappedArguments(state, objectFromExpr(state, inner.object));
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
      forgetMappedArguments(state, objectFromExpr(state, target.object));
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
    bindPattern(state, pattern, value.objectId);
    const target = unwrapExpression(pattern);
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
      state.assignmentResults.set(node, valueFromExpr(state, value));
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
      // Analyze local syntax once, without definition-time outer values. A
      // proven direct call below replays it with invocation-time arguments.
      if (
        analyzeUncalledFunctions &&
        !directlyCalledFunctions.has(node) &&
        !(
          node.params.length === 0 &&
          node.body?.type === "BlockStatement" &&
          node.body.body.length === 0
        )
      ) {
        const local = snapshotState(state, cloneData, budget);
        local.env.clear();
        local.constants.clear();
        local.assignmentResults.clear();
        local.objects.clear();
        local.callablePaths = [];
        local.callableResults.clear();
        visit(node, local, true);
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
      case "WithStatement":
        visit(node.object, state, false);
        finishExpressionResults(state);
        visit(node.body, state, false);
        break;
      case "ClassExpression":
      case "ClassDeclaration": {
        const enclosingAssignments = state.assignmentResults;
        const enclosingCallables = state.callableResults;
        state.assignmentResults = new Map();
        state.callableResults = new Map();
        // Expressions run among keys, but their selected callable identities
        // must survive until the later decorator application phase.
        const savedDecorators = new Set<ESTree.Node>();
        const finishClassHeader = (path: EnvState<T>): void => {
          if (!savedDecorators.size) {
            finishExpressionResults(path);
            return;
          }
          const clear = (result: EnvState<T>): void => {
            spendWork(budget, 1 + result.callableResults.size + result.assignmentResults.size);
            result.assignmentResults.clear();
            for (const expression of result.callableResults.keys()) {
              if (!savedDecorators.has(expression)) result.callableResults.delete(expression);
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
            visit(expression, path, false);
            if (decorator) {
              const save = (result: EnvState<T>): void => {
                if (result.completion === "normal")
                  result.callableResults.set(decorator, functionsFromExpr(result, expression));
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
              savedDecorators.add(decorator);
              visitClassHeader(decorator.expression, decorator);
              evaluated.push(decorator);
            }
          }
          spendWork(budget, evaluated.length);
          return evaluated.reverse();
        };
        const classDecorators = visitClassDecorators(node);
        const memberDecorators: ESTree.Node[] = [];
        if (node.superClass) visitClassHeader(node.superClass);
        for (const element of node.body.body) {
          spendWork(budget);
          const decorators = visitClassDecorators(element);
          spendWork(budget, decorators.length);
          for (const decorator of decorators) memberDecorators.push(decorator);
          if ("computed" in element && element.computed) visitClassHeader(element.key);
        }
        if (node.id && state.completion === "normal") {
          const innerBinding = resolveBinding(bindings, node.id, ancestors);
          if (innerBinding && referencedBindings.has(innerBinding.id))
            assignFrom(state, node.id, node);
        }
        const escapeDecoratorCaptures = (path: EnvState<T>, fn: ESTree.Node): void => {
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
        if (savedDecorators.size) {
          if (!runCorrelated(state, applyDecorators) && state.completion === "normal")
            applyDecorators(state);
          savedDecorators.clear();
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
              path.functions.set(binding.id, [node]);
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
        if (isNode(target) && target.type === "MemberExpression") {
          visit(target.object, state, false);
          if (state.completion !== "normal") break;
          preserveWriteReceiver(state, target.object);
          if (target.computed) visit(target.property, state, false);
        } else if (assign.operator !== "=") {
          visit(assign.left, state, false);
        }
        if (state.completion !== "normal") break;
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
            break;
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
            assignFrom(path, assign.left, right);
            path.assignmentResults.set(assign, value);
          }
          joinInto(state, skipped ? [skipped, ...paths] : paths);
          break;
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
              if (value !== null) assignFrom(path, assign.left, value);
            } else {
              invalidatePattern(path, assign.left);
            }
          }
          joinInto(state, paths);
          break;
        }
        if (state.completion !== "normal") break;
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
        const target = unwrapExpression(update.argument);
        if (isNode(target) && target.type === "MemberExpression") {
          visit(target.object, state, false);
          if (state.completion !== "normal") break;
          preserveWriteReceiver(state, target.object);
          if (target.computed) visit(target.property, state, false);
        } else {
          visit(update.argument, state, false);
        }
        if (state.completion !== "normal") break;
        // Both prefix and postfix update coerce the old value and write a
        // number back to the binding. The expression result is never the
        // tracked object identity.
        invalidatePattern(state, update.argument);
        break;
      }
      case "TaggedTemplateExpression": {
        const tagged = node as ESTree.TaggedTemplateExpression;
        if (!hasLogicalAssignments) {
          visitChildren(node, (child) => visit(child, state, false));
          break;
        }
        recordPossibleThrow(state);
        const tag = unwrapExpression(tagged.tag);
        let receiver: ESTree.Node | null = null;
        if (isNode(tag) && tag.type === "MemberExpression") {
          ancestors.push(tag);
          visit(tag.object, state, false);
          if (state.completion === "normal") {
            receiver = tag.object;
            preserveArgumentValue(state, receiver);
            if (tag.computed) visit(tag.property, state, false);
          }
          ancestors.pop();
        } else {
          visit(tagged.tag, state, false);
        }
        if (state.completion !== "normal" || !isNode(tag)) break;
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
          const parent = ancestors[ancestors.length - 2];
          const discarded = parent?.type === "ExpressionStatement" && parent.expression === tagged;
          for (const fn of (receiver && path.assignmentResults.get(receiver)?.functions) ?? []) {
            if (fn) escapeCaptured(path, fn);
          }
          for (const fn of functionsFromExpr(path, tag)) {
            if (!fn) continue;
            if (isFunctionLike(fn) && fn.generator) {
              spendWork(budget, fn.params.length);
              if (!discarded) escapeCaptured(path, fn);
              else if (fn.params.some((param) => param.type !== "Identifier"))
                escapeCaptured(path, fn);
            } else {
              escapeCaptured(path, fn);
            }
          }
          for (const expression of tagged.quasi.expressions) markEscape(path, expression);
          recordPossibleThrow(path);
          path.callableResults.delete(tag);
        };
        if (state.completion === "normal") invokeTag(state);
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
        let receiverFunctions: CallableValues = [];
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
            if (
              hasLogicalAssignments &&
              isNode(object) &&
              (state.callablePaths.length > 0 || state.assignmentResults.has(object))
            ) {
              const captureReceiver = (path: EnvState<T>): void => {
                path.assignmentResults.set(object, valueFromExpr(path, object));
              };
              if (!runCorrelated(state, captureReceiver)) captureReceiver(state);
            } else if (hasLogicalAssignments) receiverFunctions = functionsFromExpr(state, object);
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
          preserveArgumentValue(state, arg);
        }
        if (state.completion !== "normal") break;
        const invoke = (state: EnvState<T>): void => {
          if (runCorrelated(state, invoke)) return;
          const functions = functionsFromExpr(state, call.callee);
          const receiverValue = receiver && state.assignmentResults.get(receiver);
          receiverFunctions = receiverValue?.functions ?? receiverFunctions;
          for (const fn of receiverFunctions) {
            if (fn) forgetCapturedConstants(state, fn);
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
            const deferred = Boolean(fn && isFunctionLike(fn) && fn.generator);
            if (fn && isFunctionLike(fn) && !deferred && !activeFunctions.has(fn)) {
              activeFunctions.add(fn);
              const invocation = snapshotState(caller, cloneData, budget);
              const { params } = fn;
              const hasSpreadArgument = call.arguments.some(
                (argument) => argument.type === "SpreadElement",
              );
              ancestors.push(fn);
              if (hasLogicalAssignments && fn.type !== "ArrowFunctionExpression") {
                let argumentObject = argumentObjectIds.get(fn);
                if (argumentObject === undefined) {
                  argumentObject = alloc();
                  argumentObjectIds.set(fn, argumentObject);
                }
                const mapped: BindingId[] = [];
                if (hasMappedArguments(fn)) {
                  for (
                    let index = 0;
                    index <
                    Math.min(
                      params.length,
                      hasSpreadArgument ? params.length : call.arguments.length,
                    );
                    index += 1
                  ) {
                    spendWork(budget);
                    const binding = resolveBinding(bindings, params[index], ancestors);
                    if (binding && constantBindings.has(binding.id)) mapped.push(binding.id);
                  }
                }
                mappedArguments.set(argumentObject, mapped);
                invocation.env.set(-argumentObject, argumentObject);
                const declaredArguments = fn.body
                  ? bindings.resolve("arguments", fn.body, ancestors)
                  : null;
                if (declaredArguments?.kind === "var")
                  invocation.env.set(declaredArguments.id, argumentObject);
              }
              for (let index = 0; index < params.length; index += 1) {
                const param = unwrapExpression(params[index]);
                const argument = call.arguments[index];
                const value: EvaluatedValue = hasSpreadArgument
                  ? { objectId: undefined, functions: [undefined], constant: null }
                  : ((argument && invocation.assignmentResults.get(argument)) ?? {
                      objectId: argumentIds[index],
                      functions: [undefined],
                      constant: argument
                        ? null
                        : { truthy: false, nullish: true, nullishValue: "undefined" },
                    });
                const bindParameter = (path: EnvState<T>): void => {
                  if (runCorrelated(path, bindParameter)) return;
                  if (isNode(param) && param.type === "AssignmentPattern") {
                    const nullishValue = value.constant?.nullish
                      ? value.constant.nullishValue
                      : undefined;
                    const defaultRuns =
                      !hasSpreadArgument &&
                      (!argument ||
                        nullishValue === "undefined" ||
                        isDefinitelyUndefinedValue(argument, bindings));
                    const provided =
                      !hasSpreadArgument &&
                      argument &&
                      (value.constant?.nullish === false || nullishValue === "null");
                    if (!defaultRuns && provided) {
                      bindParameterValue(path, param.left, value);
                      return;
                    }
                    const withDefault = defaultRuns ? path : snapshotState(path, cloneData, budget);
                    visit(param.right, withDefault, false);
                    const bindDefault = (result: EnvState<T>): void => {
                      bindParameterValue(result, param.left, valueFromExpr(result, param.right));
                    };
                    if (
                      !runCorrelated(withDefault, bindDefault) &&
                      withDefault.completion === "normal"
                    )
                      bindDefault(withDefault);
                    if (!defaultRuns) {
                      bindParameterValue(path, param.left, value);
                      joinInto(path, [
                        pathWithoutAlternatives(path, cloneData, budget),
                        withDefault,
                      ]);
                    }
                  } else {
                    bindParameterValue(path, params[index], value);
                  }
                };
                bindParameter(invocation);
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
              const capturedIds = new Set(capturesOf(fn));
              for (const id of capturedIds) {
                if (id >= 0) continue;
                for (const mapped of mappedArguments.get(-id) ?? []) {
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
              callPaths.push(...projected);
              activeFunctions.delete(fn);
            } else if (fn && deferred) {
              const parent = ancestors[ancestors.length - 2];
              const discarded =
                parent?.type === "ExpressionStatement" &&
                (parent as ESTree.ExpressionStatement).expression === call;
              if (!discarded) escapeCaptured(caller, fn);
              else if (isFunctionLike(fn)) {
                spendWork(budget, fn.params.length);
                if (fn.params.some((param) => param.type !== "Identifier"))
                  escapeCaptured(caller, fn);
              }
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
        const callee = unwrapExpression(expr.callee);
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
          for (const fn of functionsFromExpr(path, expr.callee)) {
            if (fn?.type === "ClassDeclaration" || fn?.type === "ClassExpression")
              escapeCaptured(path, fn);
            else if (fn) forgetCapturedConstants(path, fn);
          }
          for (const arg of expr.arguments) markEscape(path, arg);
          // Construction can throw after argument evaluation but before allocation.
          recordPossibleThrow(path);
          objectFromExpr(path, expr);
          if (isNode(callee)) path.callableResults.delete(callee);
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
      case "MemberExpression":
        objectFromExpr(state, node);
        visitChildren(node, (child) => visit(child, state, false));
        break;
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
      for (const source of constantSources) {
        spendWork(budget);
        const target = resolveBinding(bindings, source.left, []);
        if (!target) continue;
        const pending = [{ value: source.right, depth: 0 }];
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
          } else if (isFunctionLike(value)) {
            rememberFunctionOrigin(target.id, value);
            callableBindings.add(target.id);
          } else {
            const origin = resolveBinding(bindings, value, []);
            if (!origin) continue;
            const sources = dependencies.get(target.id) ?? new Set<BindingId>();
            sources.add(origin.id);
            dependencies.set(target.id, sources);
          }
        }
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
      for (const call of constantCalls) {
        spendWork(budget);
        const callee = unwrapExpression(call.callee);
        const functions = new Set<ImmediateFunction>();
        if (isNode(callee) && isFunctionLike(callee)) functions.add(callee);
        const binding = resolveBinding(bindings, callee, []);
        for (const fn of (binding && callableOrigins.get(binding.id)) || []) {
          spendWork(budget);
          functions.add(fn);
        }
        for (const fn of functions) {
          directlyCalledFunctions.add(fn);
          for (let index = 0; index < fn.params.length; index += 1) {
            spendWork(budget);
            const param = unwrapExpression(fn.params[index]);
            const target = resolveBinding(
              bindings,
              isNode(param) && param.type === "AssignmentPattern" ? param.left : param,
              [],
            );
            const origin = resolveBinding(bindings, call.arguments[index], []);
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
    }
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
