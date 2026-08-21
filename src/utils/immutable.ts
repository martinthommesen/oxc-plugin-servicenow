export function immutableSet<T>(values: Iterable<T>): ReadonlySet<T> {
  const set = new Set(values);
  let view: ReadonlySet<T>;

  view = Object.freeze({
    get size() {
      return set.size;
    },
    has(value: T) {
      return set.has(value);
    },
    entries() {
      return set.entries();
    },
    keys() {
      return set.keys();
    },
    values() {
      return set.values();
    },
    forEach(callback: (value: T, value2: T, set: ReadonlySet<T>) => void, thisArg?: unknown) {
      set.forEach((value) => callback.call(thisArg, value, value, view));
    },
    [Symbol.iterator]() {
      return set[Symbol.iterator]();
    },
  });

  return view;
}
