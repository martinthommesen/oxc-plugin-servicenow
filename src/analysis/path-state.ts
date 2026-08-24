import type { ESTree } from "@oxlint/plugins";
import {
  getName,
  isNode,
  isValueReference,
  unwrapExpression,
  WALK_SKIP_KEYS,
  walk,
} from "../utils/ast.js";
import type { FileBindings, LexicalBinding, ScopeNode } from "./bindings.js";
import { resolvePlatformGlobalName } from "./globals.js";
import { isFunctionLike } from "./bindings.js";
import { resolveConstValue, staticPropertyName } from "./members.js";
import type { ProvenanceKind, ProvenanceQuery } from "./provenance.js";

export type BindingId = number;
export type ObjectId = number;
export type Completion = "normal" | "return" | "throw" | "break" | "continue";
type InternalCompletion = Completion | "unreachable";

export interface SharedRecord<T> {
  id: ObjectId;
  escaped: boolean;
  invalid: boolean;
  data: T;
}

export interface PathCallInput<T> {
  call: ESTree.CallExpression;
  rec: SharedRecord<T> | undefined;
  /** Unwrapped member receiver captured before computed keys and arguments run. */
  receiver: ESTree.Node | null;
  objectName: string | null;
  property: string | null;
}

export interface PathRefInput<T> {
  node: ESTree.Node;
  rec: SharedRecord<T> | undefined;
  name: string | null;
  bindingId: BindingId | null;
}

type AbruptCompletion = Exclude<InternalCompletion, "normal">;

const DEFAULT_MAX_WORK = 50_000;
const MAX_PATH_DEPTH = 128;
const BUDGET_EXCEEDED = Symbol("path-analysis-budget-exceeded");
let budgetExceededCount = 0;

export function getPathBudgetExceededCount(): number {
  return budgetExceededCount;
}

export function resetPathBudgetExceededCount(): void {
  budgetExceededCount = 0;
}

export function dedupePathFindings<T extends { node: ESTree.Node }>(
  findings: T[],
  keyOf?: (finding: T) => string,
): T[] {
  const seen = new WeakMap<ESTree.Node, Set<string>>();
  return findings.filter((finding) => {
    let keys = seen.get(finding.node);
    if (!keys) {
      keys = new Set();
      seen.set(finding.node, keys);
    }
    const key = keyOf?.(finding) ?? "";
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

interface WorkBudget {
  remaining: number;
}

function spendWork(budget: WorkBudget, amount = 1): void {
  budget.remaining -= amount;
  if (budget.remaining < 0) throw BUDGET_EXCEEDED;
}

interface EnvState<T> {
  env: Map<BindingId, ObjectId | undefined>;
  objects: Map<ObjectId, SharedRecord<T>>;
  completion: InternalCompletion;
  /** Label on break/continue completions, if any. */
  completionLabel?: string | null;
  /** Alternative abrupt paths retained until their owning construct consumes them. */
  abrupt: Map<AbruptCompletion, EnvState<T>[]>;
}

export interface PathAnalysisOptions<T> {
  program: ESTree.Node;
  analysis: ProvenanceQuery;
  kinds: readonly ProvenanceKind[];
  emptyData: () => T;
  cloneData: (data: T) => T;
  mergeData: (left: T, right: T) => T;
  /** Merge different runtime identities only when the domain proves both are values of the same abstract kind. */
  mergeDistinctData?: (left: T, right: T) => T | undefined;
  equalsData: (left: T, right: T) => boolean;
  onCall: (input: PathCallInput<T>) => void;
  onRef?: (input: PathRefInput<T>) => void;
  /** Allocate an abstract value; a later evaluation refreshes an invalid or escaped site. */
  onValue?: (node: ESTree.Node) => T | undefined;
  /** Inspect every reachable program completion after the shared traversal. */
  onExit?: (states: readonly PathExitState<T>[]) => void;
  /** Internal deterministic work cap. Exceeding it degrades this pass to unknown. */
  maxWork?: number;
  onBudgetExceeded?: () => void;
}

export interface PathExitState<T> {
  completion: Completion | "unreachable";
  records: readonly SharedRecord<T>[];
}

export function isFunctionLikeNode(node: ESTree.Node): boolean {
  return isFunctionLike(node);
}

export function mergeTri(
  left: boolean | "unknown",
  right: boolean | "unknown",
): boolean | "unknown" {
  if (left === right) return left;
  return "unknown";
}

function cloneAbrupt<T>(
  abrupt: Map<AbruptCompletion, EnvState<T>[]>,
  cloneData: (data: T) => T,
  budget: WorkBudget,
): Map<AbruptCompletion, EnvState<T>[]> {
  const copy = new Map<AbruptCompletion, EnvState<T>[]>();
  for (const [kind, paths] of abrupt) {
    copy.set(
      kind,
      paths.map((path) => snapshotState(path, cloneData, budget)),
    );
  }
  return copy;
}

function pathWithoutAlternatives<T>(
  state: EnvState<T>,
  cloneData: (data: T) => T,
  budget: WorkBudget,
): EnvState<T> {
  const copy = snapshotState(state, cloneData, budget);
  copy.abrupt.clear();
  return copy;
}

/** Return every reachable completion represented by one abstract state. */
function completionPaths<T>(
  state: EnvState<T>,
  cloneData: (data: T) => T,
  budget: WorkBudget,
): EnvState<T>[] {
  const paths: EnvState<T>[] = [];
  const add = (path: EnvState<T>): void => {
    spendWork(budget);
    const copy = pathWithoutAlternatives(path, cloneData, budget);
    paths.push(copy);
    for (const nested of path.abrupt.values()) {
      for (const child of nested) add(child);
    }
  };
  add(state);
  return paths;
}

function setCompletion<T>(
  state: EnvState<T>,
  completion: InternalCompletion,
  label: string | null = null,
): void {
  state.completion = completion;
  state.completionLabel = label;
}

function isDefinitelyTrue(node: unknown): boolean {
  if (node == null) return true;
  const expr = unwrapExpression(node);
  if (!isNode(expr)) return false;
  return expr.type === "Literal" && (expr as unknown as { value?: unknown }).value === true;
}

function isDefinitelyFalse(node: unknown): boolean {
  const expr = unwrapExpression(node);
  return Boolean(
    isNode(expr) &&
    expr.type === "Literal" &&
    (expr as unknown as { value?: unknown }).value === false,
  );
}

export function visitChildren(
  node: ESTree.Node,
  visit: (child: unknown, traverseRoot: boolean) => void,
): void {
  for (const key of Object.keys(node)) {
    if (WALK_SKIP_KEYS.has(key)) continue;
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const child of value) visit(child, false);
    } else {
      visit(value, false);
    }
  }
}

function cloneRecord<T>(rec: SharedRecord<T>, cloneData: (data: T) => T): SharedRecord<T> {
  return {
    id: rec.id,
    escaped: rec.escaped,
    invalid: rec.invalid,
    data: cloneData(rec.data),
  };
}

function snapshotState<T>(
  state: EnvState<T>,
  cloneData: (data: T) => T,
  budget: WorkBudget,
): EnvState<T> {
  spendWork(budget, 1 + state.env.size + state.objects.size);
  const objects = new Map<ObjectId, SharedRecord<T>>();
  for (const [id, rec] of state.objects) {
    objects.set(id, cloneRecord(rec, cloneData));
  }
  return {
    env: new Map(state.env),
    objects,
    completion: state.completion,
    completionLabel: state.completionLabel,
    abrupt: cloneAbrupt(state.abrupt, cloneData, budget),
  };
}

function mergeRecords<T>(
  left: SharedRecord<T> | undefined,
  right: SharedRecord<T> | undefined,
  emptyData: () => T,
  mergeData: (left: T, right: T) => T,
): SharedRecord<T> | undefined {
  if (!left)
    return right
      ? { ...right, escaped: true, invalid: true, data: mergeData(right.data, emptyData()) }
      : undefined;
  if (!right)
    return { ...left, escaped: true, invalid: true, data: mergeData(left.data, emptyData()) };
  if (left.id !== right.id) return undefined;
  return {
    id: left.id,
    escaped: left.escaped || right.escaped,
    invalid: left.invalid || right.invalid,
    data: mergeData(left.data, right.data),
  };
}

/**
 * Join reachable states. Must-facts come from matching object identities.
 * Risk facts union. Different identities become unknown.
 */
function mergeStates<T>(
  left: EnvState<T>,
  right: EnvState<T>,
  emptyData: () => T,
  mergeData: (left: T, right: T) => T,
  mergeDistinctData?: (left: T, right: T) => T | undefined,
  alloc?: () => ObjectId,
): EnvState<T> {
  const env = new Map<BindingId, ObjectId | undefined>();
  const objects = new Map<ObjectId, SharedRecord<T>>();
  const objectIds = new Set([...left.objects.keys(), ...right.objects.keys()]);
  for (const objectId of objectIds) {
    const merged = mergeRecords(
      left.objects.get(objectId),
      right.objects.get(objectId),
      emptyData,
      mergeData,
    );
    if (merged) objects.set(objectId, merged);
  }
  const ids = new Set([...left.env.keys(), ...right.env.keys()]);
  for (const bindingId of ids) {
    const leftId = left.env.get(bindingId);
    const rightId = right.env.get(bindingId);
    const leftHas = left.env.has(bindingId);
    const rightHas = right.env.has(bindingId);
    if (!leftHas || !rightHas || leftId === undefined || rightId === undefined) {
      env.set(bindingId, undefined);
      continue;
    }
    if (leftId !== rightId) {
      const leftRecord = left.objects.get(leftId);
      const rightRecord = right.objects.get(rightId);
      const data =
        leftRecord && rightRecord
          ? mergeDistinctData?.(leftRecord.data, rightRecord.data)
          : undefined;
      if (data !== undefined && alloc) {
        const id = alloc();
        objects.set(id, {
          id,
          escaped: leftRecord!.escaped || rightRecord!.escaped,
          invalid: leftRecord!.invalid || rightRecord!.invalid,
          data,
        });
        env.set(bindingId, id);
      } else {
        env.set(bindingId, undefined);
      }
      continue;
    }
    if (!objects.has(leftId)) {
      env.set(bindingId, undefined);
      continue;
    }
    env.set(bindingId, leftId);
  }
  return { env, objects, completion: "normal", completionLabel: null, abrupt: new Map() };
}

function statesEqual<T>(
  left: EnvState<T>,
  right: EnvState<T>,
  equalsData: (left: T, right: T) => boolean,
): boolean {
  if (left.completion !== right.completion || left.completionLabel !== right.completionLabel)
    return false;
  if (left.env.size !== right.env.size || left.objects.size !== right.objects.size) return false;
  for (const [id, value] of left.env) {
    if (!right.env.has(id) || right.env.get(id) !== value) return false;
  }
  for (const [id, record] of left.objects) {
    const other = right.objects.get(id);
    if (!other) return false;
    if (record.escaped !== other.escaped || record.invalid !== other.invalid) return false;
    if (!equalsData(record.data, other.data)) return false;
  }
  return true;
}

function mergeMany<T>(
  paths: EnvState<T>[],
  emptyData: () => T,
  mergeData: (left: T, right: T) => T,
  mergeDistinctData?: (left: T, right: T) => T | undefined,
  alloc?: () => ObjectId,
): EnvState<T> | undefined {
  const reachable = paths.filter((path) => path.completion === "normal");
  if (reachable.length === 0) return undefined;
  let current = reachable[0]!;
  for (let i = 1; i < reachable.length; i++) {
    current = mergeStates(current, reachable[i]!, emptyData, mergeData, mergeDistinctData, alloc);
  }
  return current;
}

function replaceWith<T>(
  target: EnvState<T>,
  source: EnvState<T>,
  cloneData?: (data: T) => T,
  budget?: WorkBudget,
): void {
  target.env.clear();
  for (const [id, objectId] of source.env) target.env.set(id, objectId);
  target.objects.clear();
  for (const [id, rec] of source.objects) target.objects.set(id, rec);
  target.completion = source.completion;
  target.completionLabel = source.completionLabel;
  target.abrupt.clear();
  if (cloneData) {
    if (!budget) throw new Error("path analysis budget is required when cloning state");
    for (const [kind, paths] of source.abrupt) {
      target.abrupt.set(
        kind,
        paths.map((path) => snapshotState(path, cloneData, budget)),
      );
    }
  } else {
    for (const [kind, paths] of source.abrupt) target.abrupt.set(kind, paths);
  }
}

function ctorKind(
  analysis: ProvenanceQuery,
  node: unknown,
  kinds: readonly ProvenanceKind[],
): ProvenanceKind | null {
  const expr = unwrapExpression(node);
  if (!isNode(expr) || expr.type !== "NewExpression") return null;
  const callee = resolveConstValue((expr as ESTree.NewExpression).callee, analysis.bindings);
  if (!callee) return null;
  const name = resolvePlatformGlobalName(callee, analysis.bindings);
  if (!name) return null;
  const map: Record<string, ProvenanceKind> = {
    GlideRecord: "GlideRecord",
    GlideRecordSecure: "GlideRecord",
    GlideAggregate: "GlideAggregate",
    GlideAjax: "GlideAjax",
    GlideDateTime: "GlideDateTime",
    DataView: "DataView",
  };
  const kind = map[name];
  if (!kind || !kinds.includes(kind)) return null;
  if (!analysis.isPlatformCtor(callee, [name])) return null;
  return kind;
}

function resolveBinding(
  bindings: FileBindings,
  node: unknown,
  ancestors: readonly ESTree.Node[],
): LexicalBinding | null {
  const expr = unwrapExpression(node);
  const name = getName(expr);
  if (!name || !isNode(expr)) return null;
  return bindings.resolve(name, expr, ancestors);
}

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
      const declared = binding ? bindings.tree.scopeById(binding.scopeId) : null;
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
export function analyzePathBindings<T>(options: PathAnalysisOptions<T>): void {
  const {
    program,
    analysis,
    kinds,
    emptyData,
    cloneData,
    mergeData,
    mergeDistinctData,
    equalsData,
    onCall,
    onRef,
    onValue,
    onExit,
    maxWork = DEFAULT_MAX_WORK,
    onBudgetExceeded,
  } = options;
  if (!Number.isSafeInteger(maxWork) || maxWork < 1) {
    throw new RangeError("path analysis maxWork must be a positive safe integer");
  }
  const budget: WorkBudget = { remaining: maxWork };
  const bindings = analysis.bindings;
  let nextObjectId = 1;
  const alloc = (): ObjectId => {
    nextObjectId += 1;
    return nextObjectId;
  };
  const ancestors: ESTree.Node[] = [];
  const newExpressionIds = new WeakMap<ESTree.Node, ObjectId>();
  const platformObjects = new Map<string, ObjectId>();
  const functionDefs = new Map<BindingId, ESTree.Node>();
  const declaredFunctions = new Map<BindingId, ESTree.Node>();
  const directlyCalledFunctions = new WeakSet<ESTree.Node>();
  const activeFunctions = new Set<ESTree.Node>();
  const functionCaptures = new WeakMap<ESTree.Node, readonly BindingId[]>();
  const tryThrowPaths: EnvState<T>[][] = [];
  const PLATFORM_ALIASES = new Set(["g_form", "gs", "current"]);

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
      const id = (node as { id?: ESTree.Node | null }).id;
      const name = getName(id);
      if (!id || !name) return;
      const binding = bindings.resolve(name, id);
      if (binding) {
        functionDefs.set(binding.id, node);
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
      if (!isNode(callee) || callee.type !== "Identifier") return;
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

  const objectFromExpr = (state: EnvState<T>, node: unknown): ObjectId | undefined => {
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return undefined;
    if (expr.type === "Identifier") {
      const binding = resolveBinding(bindings, expr, ancestors);
      if (binding) return state.env.get(binding.id);
      const name = getName(expr);
      if (name && PLATFORM_ALIASES.has(name) && analysis.isPlatformGlobal(expr)) {
        let objectId = platformObjects.get(name);
        if (objectId === undefined) {
          objectId = alloc();
          platformObjects.set(name, objectId);
        }
        ensure(state, objectId);
        return objectId;
      }
      return undefined;
    }
    if (expr.type === "NewExpression" && ctorKind(analysis, expr, kinds)) {
      const existing = newExpressionIds.get(expr);
      if (existing !== undefined) {
        ensure(state, existing);
        return existing;
      }
      const rec: SharedRecord<T> = {
        id: alloc(),
        escaped: false,
        invalid: false,
        data: emptyData(),
      };
      state.objects.set(rec.id, rec);
      newExpressionIds.set(expr, rec.id);
      onRef?.({
        node: expr,
        rec,
        name: getName((expr as ESTree.NewExpression).callee),
        bindingId: null,
      });
      return rec.id;
    }
    if (expr.type === "SequenceExpression") {
      const expressions = (expr as ESTree.SequenceExpression).expressions;
      return objectFromExpr(state, expressions[expressions.length - 1]);
    }
    if (expr.type === "ConditionalExpression") {
      const conditional = expr as ESTree.ConditionalExpression;
      const left = objectFromExpr(state, conditional.consequent);
      const right = objectFromExpr(state, conditional.alternate);
      return left !== undefined && left === right ? left : undefined;
    }
    if (expr.type === "LogicalExpression") {
      const logical = expr as ESTree.LogicalExpression;
      const left = objectFromExpr(state, logical.left);
      const right = objectFromExpr(state, logical.right);
      // A logical expression can return either operand. Preserve an alias
      // only when every statically tracked outcome is the same identity. This
      // is safe for &&, ||, and ?? when both reachable operands are the same.
      return left !== undefined && left === right ? left : undefined;
    }
    if (expr.type === "AssignmentExpression") {
      const assignment = expr as ESTree.AssignmentExpression;
      // Assignment expressions evaluate to their right-hand result. Compound
      // assignments may retain/coerce the previous value, so stay unknown.
      return assignment.operator === "=" ? objectFromExpr(state, assignment.right) : undefined;
    }
    if (onValue) {
      const existing = newExpressionIds.get(expr);
      if (existing !== undefined) {
        const record = state.objects.get(existing);
        if (!record || record.invalid || record.escaped) {
          const data = onValue(expr);
          if (data === undefined) return undefined;
          // Allocation sites are reused to keep loop fixpoints finite, but a
          // binding can still point at the site's value from an earlier
          // evaluation. Detach those stale aliases before publishing facts
          // for the newly evaluated host value.
          for (const [bindingId, objectId] of state.env) {
            if (objectId === existing) state.env.set(bindingId, undefined);
          }
          const refreshed: SharedRecord<T> = {
            id: existing,
            escaped: false,
            invalid: false,
            data,
          };
          state.objects.set(existing, refreshed);
          onRef?.({ node: expr, rec: refreshed, name: getName(expr), bindingId: null });
        }
        return existing;
      }
      const data = onValue(expr);
      if (data !== undefined) {
        const rec: SharedRecord<T> = {
          id: alloc(),
          escaped: false,
          invalid: false,
          data,
        };
        state.objects.set(rec.id, rec);
        newExpressionIds.set(expr, rec.id);
        onRef?.({ node: expr, rec, name: getName(expr), bindingId: null });
        return rec.id;
      }
    }
    return undefined;
  };

  const markEscape = (state: EnvState<T>, node: unknown): void => {
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return;
    switch (expr.type) {
      case "Identifier": {
        const binding = resolveBinding(bindings, expr, ancestors);
        if (!binding) return;
        const fn = functionDefs.get(binding.id);
        if (fn) {
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

  const invalidatePattern = (state: EnvState<T>, pattern: unknown): void => {
    const inner = unwrapExpression(pattern);
    if (!isNode(inner)) return;
    if (inner.type === "Identifier") {
      const binding = resolveBinding(bindings, inner, ancestors);
      if (binding) {
        state.env.set(binding.id, undefined);
        functionDefs.delete(binding.id);
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
      const value = unwrapExpression(right);
      if (binding && isNode(value) && isFunctionLike(value)) {
        functionDefs.set(binding.id, value);
      } else if (binding && isNode(value) && value.type === "Identifier") {
        const source = resolveBinding(bindings, value, ancestors);
        const fn = source ? functionDefs.get(source.id) : undefined;
        if (fn) functionDefs.set(binding.id, fn);
        else functionDefs.delete(binding.id);
      } else if (binding) {
        functionDefs.delete(binding.id);
      }
    }
  };

  const joinInto = (state: EnvState<T>, paths: EnvState<T>[]): void => {
    const flattened = paths.flatMap((path) => completionPaths(path, cloneData, budget));
    const normal = flattened.filter((path) => path.completion === "normal");
    const abrupt = flattened.filter((path) => path.completion !== "normal");
    const merged = mergeMany(normal, emptyData, mergeData, mergeDistinctData, alloc);
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

  const visit = (node: unknown, state: EnvState<T>, traverseRoot: boolean): void => {
    if (!isNode(node) || state.completion !== "normal") return;
    if (ancestors.length >= MAX_PATH_DEPTH) throw BUDGET_EXCEEDED;
    spendWork(budget);

    if (isFunctionLike(node) && !traverseRoot) {
      if (node.type === "FunctionDeclaration") {
        const id = (node as { id?: ESTree.Node | null }).id;
        const binding = id ? resolveBinding(bindings, id, ancestors) : null;
        if (binding) functionDefs.set(binding.id, node);
      }
      // Analyze local syntax once, without definition-time outer values. A
      // proven direct call below replays it with invocation-time arguments.
      if (!directlyCalledFunctions.has(node)) {
        const local = snapshotState(state, cloneData, budget);
        local.env.clear();
        local.objects.clear();
        visit(node, local, true);
      }
      return;
    }

    ancestors.push(node);
    switch (node.type) {
      case "ObjectExpression":
      case "ArrayExpression":
        visitChildren(node, (child) => visit(child, state, false));
        markEscape(state, node);
        break;
      case "VariableDeclarator": {
        const decl = node as ESTree.VariableDeclarator;
        if (decl.init) visit(decl.init, state, false);
        visitPatternExpressions(state, decl.id);
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
          if (target.computed) visit(target.property, state, false);
        } else if (assign.operator !== "=") {
          visit(assign.left, state, false);
        }
        if (logicalAssignment) {
          const afterLeft = snapshotState(state, cloneData, budget);
          visit(assign.right, state, false);
          joinInto(state, [afterLeft, snapshotState(state, cloneData, budget)]);
        } else {
          visit(assign.right, state, false);
        }
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
        // Both prefix and postfix update coerce the old value and write a
        // number back to the binding. The expression result is never the
        // tracked object identity.
        invalidatePattern(state, update.argument);
        break;
      }
      case "IfStatement": {
        const stmt = node as ESTree.IfStatement;
        visit(stmt.test, state, false);
        if (isDefinitelyTrue(stmt.test)) {
          visit(stmt.consequent, state, false);
          break;
        }
        if (isDefinitelyFalse(stmt.test)) {
          if (stmt.alternate) visit(stmt.alternate, state, false);
          break;
        }
        const consequent = snapshotState(state, cloneData, budget);
        visit(stmt.consequent, consequent, false);
        const alternate = snapshotState(state, cloneData, budget);
        if (stmt.alternate) visit(stmt.alternate, alternate, false);
        joinInto(state, [consequent, alternate]);
        break;
      }
      case "ConditionalExpression": {
        const expr = node as ESTree.ConditionalExpression;
        visit(expr.test, state, false);
        if (isDefinitelyTrue(expr.test)) {
          visit(expr.consequent, state, false);
          break;
        }
        if (isDefinitelyFalse(expr.test)) {
          visit(expr.alternate, state, false);
          break;
        }
        const consequent = snapshotState(state, cloneData, budget);
        visit(expr.consequent, consequent, false);
        const alternate = snapshotState(state, cloneData, budget);
        visit(expr.alternate, alternate, false);
        joinInto(state, [consequent, alternate]);
        break;
      }
      case "LogicalExpression": {
        const expr = node as ESTree.LogicalExpression;
        visit(expr.left, state, false);
        const afterLeft = snapshotState(state, cloneData, budget);
        visit(expr.right, state, false);
        joinInto(state, [afterLeft, snapshotState(state, cloneData, budget)]);
        break;
      }
      case "LabeledStatement": {
        const statement = node as ESTree.LabeledStatement;
        const label = getName(statement.label);
        visit(statement.body, state, false);
        const paths = completionPaths(state, cloneData, budget);
        for (const path of paths) {
          if (path.completion === "break" && path.completionLabel === label) {
            setCompletion(path, "normal");
          }
        }
        joinInto(state, paths);
        break;
      }
      case "SwitchStatement": {
        const stmt = node as ESTree.SwitchStatement;
        visit(stmt.discriminant, state, false);
        const before = snapshotState(state, cloneData, budget);
        const exits: EnvState<T>[] = [];
        const abruptExits: EnvState<T>[] = [];
        let hasDefault = false;
        let fall: EnvState<T> | undefined;
        const directState = snapshotState(before, cloneData, budget);
        for (const switchCase of stmt.cases) {
          if (!switchCase.test) hasDefault = true;
          if (switchCase.test) visit(switchCase.test, directState, false);
          const direct = snapshotState(directState, cloneData, budget);
          const entry = fall
            ? mergeStates(direct, fall, emptyData, mergeData, mergeDistinctData, alloc)
            : direct;
          for (const consequent of switchCase.consequent) visit(consequent, entry, false);
          if (entry.completion === "break" && !entry.completionLabel) {
            setCompletion(entry, "normal");
            exits.push(entry);
            fall = undefined;
          } else if (entry.completion === "normal") {
            fall = entry;
          } else {
            abruptExits.push(entry);
            fall = undefined;
          }
        }
        if (!hasDefault) exits.push(snapshotState(directState, cloneData, budget));
        if (fall?.completion === "normal") exits.push(fall);
        joinInto(state, [...exits, ...abruptExits]);
        break;
      }
      case "ForStatement":
      case "WhileStatement":
      case "DoWhileStatement":
      case "ForInStatement":
      case "ForOfStatement": {
        // Evaluate loop headers before taking the zero-iteration snapshot. A
        // condition can mutate a tracked object even when it immediately
        // yields false, so the post-test state is the loop's zero-body path.
        if (node.type === "ForStatement" && (node as ESTree.ForStatement).init) {
          visit((node as ESTree.ForStatement).init, state, false);
        }
        if (node.type === "ForInStatement" || node.type === "ForOfStatement") {
          const iterable = node as ESTree.ForInStatement | ESTree.ForOfStatement;
          if (iterable.right) visit(iterable.right, state, false);
        }

        const beforeTest = snapshotState(state, cloneData, budget);
        const testState = snapshotState(beforeTest, cloneData, budget);
        const isFor = node.type === "ForStatement";
        const isWhile = node.type === "WhileStatement";
        const isDoWhile = node.type === "DoWhileStatement";
        const parent = ancestors[ancestors.length - 2];
        const loopLabel =
          parent?.type === "LabeledStatement" && (parent as ESTree.LabeledStatement).body === node
            ? getName((parent as ESTree.LabeledStatement).label)
            : null;
        const ownsLoopCompletion = (path: EnvState<T>, kind: "break" | "continue"): boolean =>
          path.completion === kind && (!path.completionLabel || path.completionLabel === loopLabel);
        if (isFor) {
          const test = (node as ESTree.ForStatement).test;
          if (test) visit(test, testState, false);
        } else if (isWhile) {
          visit((node as ESTree.WhileStatement).test, testState, false);
        }

        const test = isFor
          ? (node as ESTree.ForStatement).test
          : isWhile
            ? (node as ESTree.WhileStatement).test
            : isDoWhile
              ? (node as ESTree.DoWhileStatement).test
              : undefined;
        const infinite = (isFor || isWhile || isDoWhile) && isDefinitelyTrue(test);
        const exits: EnvState<T>[] =
          isDoWhile || infinite ? [] : [snapshotState(testState, cloneData, budget)];
        const initialHeader = snapshotState(isDoWhile ? beforeTest : testState, cloneData, budget);
        let header = snapshotState(initialHeader, cloneData, budget);
        let converged = false;
        for (let iteration = 0; iteration < 16; iteration += 1) {
          const bodyState = snapshotState(header, cloneData, budget);
          if (node.type === "ForInStatement" || node.type === "ForOfStatement") {
            const left = (node as ESTree.ForInStatement | ESTree.ForOfStatement).left;
            if (left.type === "VariableDeclaration") visit(left, bodyState, false);
            else invalidatePattern(bodyState, left);
          }
          const body = isFor
            ? (node as ESTree.ForStatement).body
            : isWhile
              ? (node as ESTree.WhileStatement).body
              : isDoWhile
                ? (node as ESTree.DoWhileStatement).body
                : (node as ESTree.ForInStatement | ESTree.ForOfStatement).body;
          visit(body, bodyState, false);

          const backEdges: EnvState<T>[] = [];
          for (const path of completionPaths(bodyState, cloneData, budget)) {
            if (ownsLoopCompletion(path, "break")) {
              setCompletion(path, "normal");
              exits.push(path);
              continue;
            }
            if (ownsLoopCompletion(path, "continue")) setCompletion(path, "normal");
            if (path.completion !== "normal") {
              exits.push(path);
              continue;
            }
            if (isFor) {
              const update = (node as ESTree.ForStatement).update;
              if (update) visit(update, path, false);
            }
            if (isDoWhile) {
              visit((node as ESTree.DoWhileStatement).test, path, false);
            } else if (test) {
              visit(test, path, false);
            }
            if (!infinite) exits.push(snapshotState(path, cloneData, budget));
            backEdges.push(path);
          }
          const back = mergeMany(backEdges, emptyData, mergeData, mergeDistinctData, alloc);
          if (!back) {
            converged = true;
            break;
          }
          const nextHeader = mergeStates(
            initialHeader,
            back,
            emptyData,
            mergeData,
            mergeDistinctData,
            alloc,
          );
          if (statesEqual(header, nextHeader, equalsData)) {
            converged = true;
            break;
          }
          header = nextHeader;
        }
        if (exits.length === 0) setCompletion(state, "unreachable");
        else if (converged) joinInto(state, exits);
        else throw BUDGET_EXCEEDED;
        break;
      }

      case "TryStatement": {
        const stmt = node as ESTree.TryStatement;
        const tried = snapshotState(state, cloneData, budget);
        const possibleThrows: EnvState<T>[] = [];
        tryThrowPaths.push(possibleThrows);
        try {
          visit(stmt.block, tried, false);
        } finally {
          tryThrowPaths.pop();
        }
        const handled: EnvState<T>[] = [];
        for (const path of [...completionPaths(tried, cloneData, budget), ...possibleThrows]) {
          if (path.completion === "throw" && stmt.handler) {
            setCompletion(path, "normal");
            visit(stmt.handler, path, false);
            handled.push(path);
            continue;
          }
          handled.push(path);
        }
        if (stmt.finalizer) {
          for (const path of handled) {
            if (path.completion === "unreachable") continue;
            const priorCompletion = path.completion;
            const priorLabel = path.completionLabel ?? null;
            setCompletion(path, "normal");
            visit(stmt.finalizer, path, false);
            if (path.completion === "normal") setCompletion(path, priorCompletion, priorLabel);
          }
        }
        joinInto(state, handled);
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
          const object = unwrapExpression(member.object);
          receiver = isNode(object) ? object : null;
          objectName = getName(object);
          receiverId = objectFromExpr(state, object);
          if (member.computed) visit(member.property, state, false);
          ancestors.pop();
        } else {
          visit(call.callee, state, false);
        }
        const argumentIds: Array<ObjectId | undefined> = [];
        for (const arg of call.arguments) {
          visit(arg, state, false);
          argumentIds.push(objectFromExpr(state, arg));
        }
        // Invocation remains able to throw after all argument effects complete.
        recordPossibleThrow(state);
        const rec = recordOf(state, receiverId);
        onCall({ call, rec, receiver, objectName, property });
        if (rec && property === null) {
          // A computed call whose property cannot be resolved may invoke any
          // mutating platform method. Keep the receiver identity out of later
          // must-fact and risk conclusions rather than guessing its effects.
          rec.escaped = true;
        }
        const direct = unwrapExpression(call.callee);
        let fn: ESTree.Node | undefined;
        if (isNode(direct) && isFunctionLike(direct)) {
          fn = direct;
        } else if (isNode(direct) && direct.type === "Identifier") {
          const binding = resolveBinding(bindings, direct, ancestors);
          fn = binding ? functionDefs.get(binding.id) : undefined;
        }
        const deferred = Boolean((fn as unknown as { generator?: boolean } | undefined)?.generator);
        if (fn && !deferred && !activeFunctions.has(fn)) {
          activeFunctions.add(fn);
          const invocation = snapshotState(state, cloneData, budget);
          const params = (fn as unknown as { params: readonly ESTree.Node[] }).params;
          ancestors.push(fn);
          for (let index = 0; index < params.length; index += 1) {
            const param = unwrapExpression(params[index]);
            if (
              index >= call.arguments.length &&
              isNode(param) &&
              param.type === "AssignmentPattern"
            ) {
              const assignment = param as ESTree.AssignmentPattern;
              visit(assignment.right, invocation, false);
              bindPattern(
                invocation,
                assignment.left,
                objectFromExpr(invocation, assignment.right),
              );
            } else {
              bindPattern(invocation, params[index], argumentIds[index]);
            }
          }
          const body = (fn as unknown as { body: ESTree.Node }).body;
          visit(body, invocation, false);
          ancestors.pop();
          const returned = completionPaths(invocation, cloneData, budget);
          for (const path of returned) {
            if (path.completion === "return") setCompletion(path, "normal");
          }
          const capturedIds = capturesOf(fn);
          const projected = returned.map((path) => {
            const result = snapshotState(state, cloneData, budget);
            result.objects = new Map(path.objects);
            for (const id of capturedIds) {
              result.env.set(id, path.env.get(id));
            }
            setCompletion(result, path.completion, path.completionLabel ?? null);
            return result;
          });
          joinInto(state, projected);
          activeFunctions.delete(fn);
        } else if (fn && deferred) {
          const parent = ancestors[ancestors.length - 2];
          const discarded =
            parent?.type === "ExpressionStatement" &&
            (parent as ESTree.ExpressionStatement).expression === call;
          if (!discarded) {
            for (const capturedId of capturesOf(fn)) {
              const objectId = state.env.get(capturedId);
              const captured = objectId === undefined ? undefined : state.objects.get(objectId);
              if (captured) captured.escaped = true;
            }
          }
          for (const arg of call.arguments) markEscape(state, arg);
        } else {
          if (fn) {
            for (const capturedId of capturesOf(fn)) {
              const objectId = state.env.get(capturedId);
              const captured = objectId === undefined ? undefined : state.objects.get(objectId);
              if (captured) captured.escaped = true;
            }
          }
          for (const arg of call.arguments) markEscape(state, arg);
        }
        break;
      }
      case "NewExpression": {
        const expr = node as ESTree.NewExpression;
        recordPossibleThrow(state);
        const prior = newExpressionIds.get(expr);
        if (prior !== undefined) state.objects.delete(prior);
        visit(expr.callee, state, false);
        for (const arg of expr.arguments) visit(arg, state, false);
        // Construction can throw after argument evaluation but before allocation.
        recordPossibleThrow(state);
        for (const arg of expr.arguments) markEscape(state, arg);
        objectFromExpr(state, expr);
        break;
      }
      case "ReturnStatement":
        markEscape(state, (node as ESTree.ReturnStatement).argument);
        visit((node as ESTree.ReturnStatement).argument, state, false);
        state.completion = "return";
        break;
      case "ThrowStatement":
        markEscape(state, (node as ESTree.ThrowStatement).argument);
        visit((node as ESTree.ThrowStatement).argument, state, false);
        state.completion = "throw";
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
          onRef?.({
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
    ancestors.pop();
  };

  const finalState: EnvState<T> = {
    env: new Map(),
    objects: new Map(),
    completion: "normal",
    abrupt: new Map(),
  };
  try {
    visit(program, finalState, true);
    if (onExit) {
      onExit(
        completionPaths(finalState, cloneData, budget).map((path) => ({
          completion: path.completion,
          records: [...path.objects.values()],
        })),
      );
    }
  } catch (error) {
    if (error !== BUDGET_EXCEEDED) throw error;
    budgetExceededCount += 1;
    onBudgetExceeded?.();
  }
}
