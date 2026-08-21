/**
 * Deep-freeze a value so shared settings defaults cannot be mutated.
 * Already-frozen objects are still walked so nested values freeze too.
 */
export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) return value;
  seen.add(value);
  const rec = value as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(rec)) {
    const desc = Object.getOwnPropertyDescriptor(rec, key);
    if (desc && "value" in desc) {
      deepFreeze(desc.value, seen);
    }
  }
  return Object.freeze(value);
}
