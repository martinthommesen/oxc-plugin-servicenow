export function shallowClone<T>(data: T): T {
  return { ...data };
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
