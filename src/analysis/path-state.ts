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
  type LexicalBinding,
  type ScopeNode,
} from "./bindings.js";
import { constantValue } from "./constant-value.js";
import { resolvePlatformGlobalName } from "./globals.js";
import { isDefinitelyUndefinedValue, resolveConstValue, staticPropertyName } from "./members.js";
import {
  isPlatformAliasGlobal,
  ctorProvenanceKind,
  type ProvenanceKind,
  type ProvenanceQuery,
} from "./provenance.js";

export type BindingId = number;
export type ObjectId = number;
export type Completion = "normal" | "return" | "throw" | "break" | "continue";
type InternalCompletion = Completion | "unreachable" | "suspend";

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
type CallableValues = readonly (ImmediateFunction | undefined)[];

// Snapshot cost grows superlinearly with file length (top-level `var`
// bindings stay live to end of file), so the default budget scales with
// program size while `maxWork` stays an explicit override and the ceiling
// still bounds adversarial input (FINDINGS.md PER-003).
const WORK_PER_NODE = 128;
/** Floor of the default work budget, whatever the program size. */
const MIN_WORK_BUDGET = 50_000;
/** Ceiling of the default work budget, whatever the program size. */
const MAX_WORK_BUDGET = 5_000_000;
const programNodeBudgets = new WeakMap<ESTree.Node, number>();
export const MAX_PATH_DEPTH = 128;
export const BUDGET_EXCEEDED = Symbol("path-analysis-budget-exceeded");
let budgetExceededCount = 0;

export function getPathBudgetExceededCount(): number {
  return budgetExceededCount;
}

export function resetPathBudgetExceededCount(): void {
  budgetExceededCount = 0;
}

// Keyed on node identity: nodeStart() returns -1 on hosts without offset
// shapes, which would collapse every finding onto one key (FINDINGS.md COR-016).
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

/** The default `cloneData` for a flat domain payload. */
export function shallowClone<T>(data: T): T {
  return { ...data };
}

export interface WorkBudget {
  remaining: number;
}

export function spendWork(budget: WorkBudget, amount = 1): void {
  budget.remaining -= amount;
  if (budget.remaining < 0) throw BUDGET_EXCEEDED;
}

interface EnvState<T> {
  env: Map<BindingId, ObjectId | undefined>;
  functions: Map<BindingId, CallableValues>;
  /** Callable values selected by expressions in the current statement. */
  callableResults: Map<ESTree.Node, CallableValues>;
  objects: Map<ObjectId, SharedRecord<T>>;
  /** Normal alternatives whose callable bindings differ, retaining their record correlations. */
  callablePaths: EnvState<T>[];
  completion: InternalCompletion;
  /** Label on break/continue completions, if any. */
  completionLabel?: string | null | undefined;
  /** Alternative abrupt paths retained until their owning construct consumes them. */
  abrupt: Map<AbruptCompletion, EnvState<T>[]>;
}

export type PathAnalysisOutcome = { outcome: "complete" } | { outcome: "exhausted" };

export function exhaustedPathAnalysis(analysis: ProvenanceQuery): PathAnalysisOutcome {
  budgetExceededCount += 1;
  analysis.onExhausted?.();
  return { outcome: "exhausted" };
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
  /** Input-dependent domain payload work charged before cloning, joining, comparing, and visiting hooks. */
  dataWork?: (data: T) => number;
  onCall?: (input: PathCallInput<T>) => void;
  onRef?: (input: PathRefInput<T>) => void;
  /** Allocate an abstract value; a later evaluation refreshes an invalid or escaped site. */
  onValue?: (node: ESTree.Node) => T | undefined;
  /**
   * Analyze function bodies that have no direct call in this file. Disable
   * this for execution diagnostics that must not inspect deferred or dead
   * helper bodies. Defaults to true for existing syntax and lifecycle passes.
   */
  analyzeUncalledFunctions?: boolean;
  /** Stop the current execution path at its first await while direct callers continue. */
  stopAtAwait?: boolean;
  /**
   * Retain records that no surviving binding references after a control-flow
   * join. Risk domains need these records for exit findings; program-point
   * alias domains can disable retention to keep loop fixpoints finite.
   */
  retainUnboundRecords?: boolean;
  /** Inspect every reachable program completion after the shared traversal. */
  onExit?: (states: readonly PathExitState<T>[]) => void;
  /** Internal deterministic work cap. Exceeding it returns an exhausted outcome. */
  maxWork?: number;
}

export interface PathExitState<T> {
  completion: Completion | "unreachable";
  records: readonly SharedRecord<T>[];
}

export interface PathFindingOptions<T, F extends { node: ESTree.Node }> extends Omit<
  PathAnalysisOptions<T>,
  "cloneData" | "onCall"
> {
  /** Defaults to a shallow copy, which suits every flat domain payload. */
  cloneData?: (data: T) => T;
  onCall: (input: PathCallInput<T>, report: (finding: F) => void) => void;
}

/**
 * Run one finder domain over the shared interpreter and return its findings.
 * Exhaustion returns no findings, so the silence rule lives here once instead
 * of in every finder's return statement.
 */
export function collectPathFindings<T, F extends { node: ESTree.Node }>(
  options: PathFindingOptions<T, F>,
  keyOf?: (finding: F) => string,
): F[] {
  const { cloneData = shallowClone, onCall, ...rest } = options;
  const findings: F[] = [];
  const report = (finding: F): void => {
    findings.push(finding);
  };
  const outcome = analyzePathBindings<T>({
    ...rest,
    cloneData,
    onCall: (input) => {
      onCall(input, report);
    },
  });
  return outcome.outcome === "complete" ? dedupePathFindings(findings, keyOf) : [];
}

export function mergeTri(
  left: boolean | "unknown",
  right: boolean | "unknown",
): boolean | "unknown" {
  if (left === right) return left;
  return "unknown";
}

/** Key-deduped union of branch alternatives; later duplicates replace earlier ones. */
export function mergeKeyedUnion<T>(
  left: readonly T[],
  right: readonly T[],
  key: (value: T) => string,
  clone: (value: T) => T,
): T[] {
  const merged = new Map<string, T>();
  for (const value of [...left, ...right]) {
    merged.set(key(value), clone(value));
  }
  return [...merged.values()];
}

/** A domain payload that carries a list of mutually exclusive alternatives. */
export interface KeyedAlternatives<A> {
  alternatives: A[];
}

/**
 * The `cloneData` / `equalsData` / `mergeData` triple for a keyed-alternatives
 * payload: clone element-wise, compare position-by-position on the key, and
 * union by key at joins.
 */
export function keyedAlternativeDomain<A>(
  key: (value: A) => string,
  clone: (value: A) => A,
  alternativeWork: (value: A) => number = () => 1,
): {
  cloneData: (data: KeyedAlternatives<A>) => KeyedAlternatives<A>;
  equalsData: (left: KeyedAlternatives<A>, right: KeyedAlternatives<A>) => boolean;
  mergeData: (left: KeyedAlternatives<A>, right: KeyedAlternatives<A>) => KeyedAlternatives<A>;
  dataWork: (data: KeyedAlternatives<A>) => number;
} {
  return {
    dataWork: (data) => data.alternatives.reduce((work, value) => work + alternativeWork(value), 1),
    cloneData: (data) => ({ alternatives: data.alternatives.map(clone) }),
    equalsData: (left, right) =>
      left.alternatives.length === right.alternatives.length &&
      left.alternatives.every((value, index) => key(value) === key(right.alternatives[index]!)),
    mergeData: (left, right) => ({
      alternatives: mergeKeyedUnion(left.alternatives, right.alternatives, key, clone),
    }),
  };
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
  copy.callablePaths = [];
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
    if (path.callablePaths.length) {
      for (const normal of path.callablePaths) add(normal);
    } else {
      paths.push(pathWithoutAlternatives(path, cloneData, budget));
    }
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
  for (const path of state.callablePaths) setCompletion(path, completion, label);
}

function isDefinitelyTrue(node: unknown): boolean {
  if (node == null) return true;
  return constantValue(node)?.truthy === true;
}

function isDefinitelyFalse(node: unknown): boolean {
  return constantValue(node)?.truthy === false;
}

/**
 * Whether a logical expression's right operand definitely runs, definitely
 * does not run, or depends on a value the interpreter cannot see.
 */
function logicalRightOperandRuns(expr: ESTree.LogicalExpression): boolean | null {
  const left = constantValue(expr.left);
  if (!left) return null;
  switch (expr.operator) {
    case "&&":
      return left.truthy;
    case "||":
      return !left.truthy;
    case "??":
      return left.nullish;
    default:
      return null;
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
  spendWork(
    budget,
    1 + state.env.size + state.objects.size + state.functions.size + state.callableResults.size,
  );
  const objects = new Map<ObjectId, SharedRecord<T>>();
  for (const [id, rec] of state.objects) {
    objects.set(id, cloneRecord(rec, cloneData));
  }
  return {
    env: new Map(state.env),
    functions: new Map(state.functions),
    callableResults: new Map(state.callableResults),
    objects,
    callablePaths: state.callablePaths.map((path) => snapshotState(path, cloneData, budget)),
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

/** The join policy for one `analyzePathBindings` run, bound once at its start. */
interface MergePolicy<T> {
  readonly budget: WorkBudget;
  readonly emptyData: () => T;
  readonly mergeData: (left: T, right: T) => T;
  readonly cloneData: (data: T) => T;
  readonly mergeDistinctData: ((left: T, right: T) => T | undefined) | undefined;
  readonly alloc: () => ObjectId;
  readonly retainUnboundRecords: boolean;
  readonly retainedObjectIds: ReadonlySet<ObjectId>;
}

/**
 * Join reachable states. Must-facts come from matching object identities.
 * Risk facts union. Different identities become unknown.
 */
function mergeFlatStates<T>(
  left: EnvState<T>,
  right: EnvState<T>,
  policy: MergePolicy<T>,
): EnvState<T> {
  const {
    emptyData,
    mergeData,
    mergeDistinctData,
    alloc,
    retainUnboundRecords,
    retainedObjectIds,
  } = policy;
  const env = new Map<BindingId, ObjectId | undefined>();
  const functions = new Map<BindingId, CallableValues>();
  for (const id of new Set([...left.functions.keys(), ...right.functions.keys()])) {
    const leftValues = left.functions.get(id) ?? [undefined];
    const rightValues = right.functions.get(id) ?? [undefined];
    spendWork(policy.budget, leftValues.length + rightValues.length);
    const values = [...new Set([...leftValues, ...rightValues])];
    if (values.some((value) => value !== undefined)) functions.set(id, values);
  }
  const callableResults = new Map<ESTree.Node, CallableValues>();
  for (const node of new Set([...left.callableResults.keys(), ...right.callableResults.keys()])) {
    const leftValues = left.callableResults.get(node) ?? [undefined];
    const rightValues = right.callableResults.get(node) ?? [undefined];
    spendWork(policy.budget, leftValues.length + rightValues.length);
    callableResults.set(node, [...new Set([...leftValues, ...rightValues])]);
  }
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
      if (data !== undefined) {
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
  if (!retainUnboundRecords) {
    const boundObjectIds = new Set(env.values());
    for (const objectId of objects.keys()) {
      if (!boundObjectIds.has(objectId) && !retainedObjectIds.has(objectId)) {
        objects.delete(objectId);
      }
    }
  }
  return {
    env,
    functions,
    callableResults,
    objects,
    callablePaths: [],
    completion: "normal",
    completionLabel: null,
    abrupt: new Map(),
  };
}

function sameCallableMap<K>(
  left: Map<K, CallableValues>,
  right: Map<K, CallableValues>,
  budget: WorkBudget,
): boolean {
  spendWork(budget, 1 + left.size + right.size);
  if (left.size !== right.size) return false;
  for (const [id, values] of left) {
    const other = right.get(id);
    if (!other || values.length !== other.length) return false;
    spendWork(budget, values.length + other.length);
    const rightValues = new Set(other);
    if (values.some((value) => !rightValues.has(value))) return false;
  }
  return true;
}

function sameCallables<T>(left: EnvState<T>, right: EnvState<T>, budget: WorkBudget): boolean {
  return (
    sameCallableMap(left.functions, right.functions, budget) &&
    sameCallableMap(left.callableResults, right.callableResults, budget)
  );
}

/** Keep records paired with their callable identity until those identities agree. */
function mergeStates<T>(
  left: EnvState<T>,
  right: EnvState<T>,
  policy: MergePolicy<T>,
): EnvState<T> {
  if (
    !left.callablePaths.length &&
    !right.callablePaths.length &&
    sameCallables(left, right, policy.budget)
  )
    return mergeFlatStates(left, right, policy);
  const groups: EnvState<T>[] = [];
  for (const path of [
    ...(left.callablePaths.length ? left.callablePaths : [left]),
    ...(right.callablePaths.length ? right.callablePaths : [right]),
  ]) {
    const index = groups.findIndex((other) => sameCallables(path, other, policy.budget));
    if (index === -1) groups.push(pathWithoutAlternatives(path, policy.cloneData, policy.budget));
    else groups[index] = mergeFlatStates(groups[index]!, path, policy);
  }
  let merged = groups[0]!;
  for (const path of groups.slice(1)) merged = mergeFlatStates(merged, path, policy);
  if (groups.length > 1) merged.callablePaths = groups;
  return merged;
}

function statesEqual<T>(
  left: EnvState<T>,
  right: EnvState<T>,
  equalsData: (left: T, right: T) => boolean,
  budget: WorkBudget,
): boolean {
  if (left.completion !== right.completion || left.completionLabel !== right.completionLabel)
    return false;
  if (left.callablePaths.length !== right.callablePaths.length) return false;
  for (const path of left.callablePaths) {
    const other = right.callablePaths.find((candidate) => sameCallables(path, candidate, budget));
    if (!other || !statesEqual(path, other, equalsData, budget)) return false;
  }
  if (!sameCallableMap(left.callableResults, right.callableResults, budget)) return false;
  if (
    left.env.size !== right.env.size ||
    left.objects.size !== right.objects.size ||
    left.functions.size !== right.functions.size
  )
    return false;
  for (const [id, values] of left.functions) {
    const other = right.functions.get(id);
    if (!other || values.length !== other.length) return false;
    spendWork(budget, values.length + other.length);
    const rightValues = new Set(other);
    if (values.some((value) => !rightValues.has(value))) return false;
  }
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

function mergeMany<T>(paths: EnvState<T>[], policy: MergePolicy<T>): EnvState<T> | undefined {
  const reachable = paths.filter((path) => path.completion === "normal");
  if (reachable.length === 0) return undefined;
  let current = reachable[0]!;
  for (let i = 1; i < reachable.length; i++) {
    current = mergeStates(current, reachable[i]!, policy);
  }
  return current;
}

function replaceWith<T>(target: EnvState<T>, source: EnvState<T>): void {
  target.env.clear();
  for (const [id, objectId] of source.env) target.env.set(id, objectId);
  target.functions = new Map(source.functions);
  target.callableResults = new Map(source.callableResults);
  target.callablePaths = source.callablePaths;
  target.objects.clear();
  for (const [id, rec] of source.objects) target.objects.set(id, rec);
  target.completion = source.completion;
  target.completionLabel = source.completionLabel;
  target.abrupt.clear();
  for (const [kind, paths] of source.abrupt) target.abrupt.set(kind, paths);
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
  const kind = ctorProvenanceKind(name);
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

function countNodes(program: ESTree.Node): number {
  let count = 0;
  const pending: ESTree.Node[] = [program];
  while (pending.length > 0) {
    const node = pending.pop()!;
    count += 1;
    visitChildren(node, (child) => {
      if (isNode(child)) pending.push(child);
    });
  }
  return count;
}

export function defaultMaxWork(program: ESTree.Node): number {
  const cached = programNodeBudgets.get(program);
  if (cached !== undefined) return cached;
  const budget = Math.min(
    MAX_WORK_BUDGET,
    Math.max(MIN_WORK_BUDGET, countNodes(program) * WORK_PER_NODE),
  );
  programNodeBudgets.set(program, budget);
  return budget;
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
  const platformObjects = new Map<string, ObjectId>();
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

  const objectFromExpr = (state: EnvState<T>, node: unknown): ObjectId | undefined => {
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return undefined;
    if (expr.type === "Identifier") {
      const binding = resolveBinding(bindings, expr, ancestors);
      if (binding) return state.env.get(binding.id);
      const name = getName(expr);
      if (name && isPlatformAliasGlobal(name) && analysis.isPlatformGlobal(expr)) {
        let objectId = platformObjects.get(name);
        if (objectId === undefined) {
          objectId = alloc();
          platformObjects.set(name, objectId);
          retainedPlatformObjectIds.add(objectId);
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
      publishRef({
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
      const selected = constantValue(conditional.test);
      if (selected)
        return objectFromExpr(
          state,
          selected.truthy ? conditional.consequent : conditional.alternate,
        );
      const left = objectFromExpr(state, conditional.consequent);
      const right = objectFromExpr(state, conditional.alternate);
      return left !== undefined && left === right ? left : undefined;
    }
    if (expr.type === "LogicalExpression") {
      const logical = expr as ESTree.LogicalExpression;
      const evaluateRight = logicalRightOperandRuns(logical);
      if (evaluateRight !== null)
        return objectFromExpr(state, evaluateRight ? logical.right : logical.left);
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
          publishRef({ node: expr, rec: refreshed, name: getName(expr), bindingId: null });
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
        publishRef({ node: expr, rec, name: getName(expr), bindingId: null });
        return rec.id;
      }
    }
    return undefined;
  };

  const functionsFromExpr = (state: EnvState<T>, node: unknown): CallableValues => {
    spendWork(budget);
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return [undefined];
    const result = state.callableResults.get(expr);
    if (result) return result;
    if (isFunctionLike(expr)) return [expr];
    if (expr.type === "Identifier") {
      const binding = resolveBinding(bindings, expr, ancestors);
      return (binding && state.functions.get(binding.id)) || [undefined];
    }
    if (expr.type === "SequenceExpression")
      return functionsFromExpr(state, expr.expressions.at(-1));
    if (expr.type === "AssignmentExpression" && expr.operator === "=")
      return functionsFromExpr(state, expr.right);
    if (expr.type === "ConditionalExpression") {
      const selected = constantValue(expr.test);
      if (selected)
        return functionsFromExpr(state, selected.truthy ? expr.consequent : expr.alternate);
      return [
        ...new Set([
          ...functionsFromExpr(state, expr.consequent),
          ...functionsFromExpr(state, expr.alternate),
        ]),
      ];
    }
    if (expr.type === "LogicalExpression") {
      const rightRuns = logicalRightOperandRuns(expr);
      if (rightRuns !== null) return functionsFromExpr(state, rightRuns ? expr.right : expr.left);
      return [
        ...new Set([
          ...functionsFromExpr(state, expr.left),
          ...functionsFromExpr(state, expr.right),
        ]),
      ];
    }
    return [undefined];
  };

  const normalValueFromExpr = (state: EnvState<T>, node: unknown): ESTree.Node | null => {
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return null;
    if (!stopAtAwait) return expr;
    if (expr.type === "AwaitExpression") return null;
    if (expr.type === "SequenceExpression") {
      const expressions = (expr as ESTree.SequenceExpression).expressions;
      for (const item of expressions.slice(0, -1)) {
        if (normalValueFromExpr(state, item) === null) return null;
      }
      return normalValueFromExpr(state, expressions[expressions.length - 1]);
    }
    if (expr.type === "ConditionalExpression") {
      const conditional = expr as ESTree.ConditionalExpression;
      const selected = constantValue(conditional.test);
      if (selected)
        return normalValueFromExpr(
          state,
          selected.truthy ? conditional.consequent : conditional.alternate,
        );
      const consequent = normalValueFromExpr(state, conditional.consequent);
      const alternate = normalValueFromExpr(state, conditional.alternate);
      if (consequent === null) return alternate;
      if (alternate === null) return consequent;
      const consequentId = objectFromExpr(state, consequent);
      const alternateId = objectFromExpr(state, alternate);
      if (consequentId !== undefined && consequentId === alternateId) return consequent;
      return expr;
    }
    if (expr.type === "LogicalExpression") {
      const logical = expr as ESTree.LogicalExpression;
      const rightRuns = logicalRightOperandRuns(logical);
      if (rightRuns !== null)
        return normalValueFromExpr(state, rightRuns ? logical.right : logical.left);
      const left = normalValueFromExpr(state, logical.left);
      if (left === null) return null;
      const right = normalValueFromExpr(state, logical.right);
      if (right === null) return left;
      const leftId = objectFromExpr(state, left);
      const rightId = objectFromExpr(state, right);
      return leftId !== undefined && leftId === rightId ? left : expr;
    }
    if (expr.type === "AssignmentExpression") {
      const assignment = expr as ESTree.AssignmentExpression;
      const right = normalValueFromExpr(state, assignment.right);
      if (right === null)
        return ["&&=", "||=", "??="].includes(assignment.operator) ? assignment.left : null;
      return assignment.operator === "=" ? right : expr;
    }
    return expr;
  };

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
      case "IfStatement": {
        const stmt = node as ESTree.IfStatement;
        visit(stmt.test, state, false);
        if (state.completion !== "normal") break;
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
        if (state.completion !== "normal") break;
        if (isDefinitelyTrue(expr.test)) {
          visit(expr.consequent, state, false);
          rememberCallableResult(state, expr, expr.consequent);
          break;
        }
        if (isDefinitelyFalse(expr.test)) {
          visit(expr.alternate, state, false);
          rememberCallableResult(state, expr, expr.alternate);
          break;
        }
        const consequent = snapshotState(state, cloneData, budget);
        visit(expr.consequent, consequent, false);
        rememberCallableResult(consequent, expr, expr.consequent);
        const alternate = snapshotState(state, cloneData, budget);
        visit(expr.alternate, alternate, false);
        rememberCallableResult(alternate, expr, expr.alternate);
        joinInto(state, [consequent, alternate]);
        break;
      }
      case "LogicalExpression": {
        const expr = node as ESTree.LogicalExpression;
        visit(expr.left, state, false);
        if (state.completion !== "normal") break;
        // A constant left operand fixes which short-circuit branch executes:
        // `true && f()` always evaluates `f()` and `false && f()` never does.
        // Only an unknown operand keeps the join of both paths (FINDINGS.md COR-003).
        const rightRuns = logicalRightOperandRuns(expr);
        if (rightRuns === false) {
          rememberCallableResult(state, expr, expr.left);
          break;
        }
        if (rightRuns === true) {
          visit(expr.right, state, false);
          rememberCallableResult(state, expr, expr.right);
          break;
        }
        const afterLeft = snapshotState(state, cloneData, budget);
        rememberCallableResult(afterLeft, expr, expr.left);
        visit(expr.right, state, false);
        rememberCallableResult(state, expr, expr.right);
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
        if (state.completion !== "normal") break;
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
          const entry = fall ? mergeStates(direct, fall, mergePolicy) : direct;
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
          if (
            node.type === "ForOfStatement" &&
            (node as ESTree.ForOfStatement).await &&
            stopAtAwait &&
            state.completion === "normal"
          ) {
            setCompletion(state, "suspend");
            break;
          }
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
        if (!isDoWhile && (isFor || isWhile) && isDefinitelyFalse(test)) {
          replaceWith(state, testState);
          break;
        }
        const infinite = (isFor || isWhile || isDoWhile) && isDefinitelyTrue(test);
        const exits: EnvState<T>[] =
          isDoWhile || infinite ? [] : [snapshotState(testState, cloneData, budget)];
        const initialHeader = snapshotState(isDoWhile ? beforeTest : testState, cloneData, budget);
        let header = snapshotState(initialHeader, cloneData, budget);
        let converged = false;
        const body = (node as { body: ESTree.Node }).body;
        for (let iteration = 0; iteration < 16; iteration += 1) {
          const bodyState = snapshotState(header, cloneData, budget);
          if (node.type === "ForInStatement" || node.type === "ForOfStatement") {
            const left = (node as ESTree.ForInStatement | ESTree.ForOfStatement).left;
            if (left.type === "VariableDeclaration") {
              visit(left, bodyState, false);
              // A `var` head declarator has no initializer, so the visit is a
              // runtime no-op; the head still rebinds its names on every
              // iteration whatever the declaration kind (FINDINGS.md COR-013).
              for (const declarator of (left as ESTree.VariableDeclaration).declarations) {
                invalidatePattern(bodyState, declarator.id);
              }
            } else invalidatePattern(bodyState, left);
          }
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
            if (!isDefinitelyFalse(test)) backEdges.push(path);
          }
          const back = mergeMany(backEdges, mergePolicy);
          if (!back) {
            converged = true;
            break;
          }
          const nextHeader = mergeStates(initialHeader, back, mergePolicy);
          if (statesEqual(header, nextHeader, equalsData, budget)) {
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
            if (path.completion === "unreachable" || path.completion === "suspend") continue;
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
