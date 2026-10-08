import type { ESTree } from "@oxlint/plugins";
import type {
  AbruptCompletion,
  BindingId,
  CallableValues,
  EnvState,
  InternalCompletion,
  ObjectId,
  SharedRecord,
} from "./path-types.js";
import { spendWork, type WorkBudget } from "./path-budget.js";

export function cloneAbrupt<T>(
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

export function pathWithoutAlternatives<T>(
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
export function completionPaths<T>(
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

export function setCompletion<T>(
  state: EnvState<T>,
  completion: InternalCompletion,
  label: string | null = null,
): void {
  state.completion = completion;
  state.completionLabel = label;
  for (const path of state.callablePaths) setCompletion(path, completion, label);
}

export function cloneRecord<T>(rec: SharedRecord<T>, cloneData: (data: T) => T): SharedRecord<T> {
  return {
    id: rec.id,
    escaped: rec.escaped,
    invalid: rec.invalid,
    data: cloneData(rec.data),
  };
}

export function snapshotState<T>(
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

export function mergeRecords<T>(
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
export interface MergePolicy<T> {
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
export function mergeFlatStates<T>(
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

function sameCallableValues(
  left: CallableValues,
  right: CallableValues | undefined,
  budget: WorkBudget,
): boolean {
  if (!right || left.length !== right.length) return false;
  spendWork(budget, left.length + right.length);
  const rightValues = new Set(right);
  return left.every((value) => rightValues.has(value));
}

export function sameCallableMap<K>(
  left: Map<K, CallableValues>,
  right: Map<K, CallableValues>,
  budget: WorkBudget,
): boolean {
  spendWork(budget, 1 + left.size + right.size);
  if (left.size !== right.size) return false;
  for (const [id, values] of left) {
    const other = right.get(id);
    if (!sameCallableValues(values, other, budget)) return false;
  }
  return true;
}

export function sameCallables<T>(
  left: EnvState<T>,
  right: EnvState<T>,
  budget: WorkBudget,
): boolean {
  return (
    sameCallableMap(left.functions, right.functions, budget) &&
    sameCallableMap(left.callableResults, right.callableResults, budget)
  );
}

/** Keep records paired with their callable identity until those identities agree. */
export function mergeStates<T>(
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

export function statesEqual<T>(
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
    if (!sameCallableValues(values, other, budget)) return false;
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

export function mergeMany<T>(
  paths: EnvState<T>[],
  policy: MergePolicy<T>,
): EnvState<T> | undefined {
  const reachable = paths.filter((path) => path.completion === "normal");
  if (reachable.length === 0) return undefined;
  let current = reachable[0]!;
  for (let i = 1; i < reachable.length; i++) {
    current = mergeStates(current, reachable[i]!, policy);
  }
  return current;
}

export function replaceWith<T>(target: EnvState<T>, source: EnvState<T>): void {
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
