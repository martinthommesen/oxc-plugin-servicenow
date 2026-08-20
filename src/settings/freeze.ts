/**
 * Deep-freeze a value so shared settings defaults cannot be mutated.
 * Already-frozen objects are still walked so nested values freeze too.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  const rec = value as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(rec)) {
    const desc = Object.getOwnPropertyDescriptor(rec, key);
    if (desc && "value" in desc) {
      deepFreeze(desc.value);
    }
  }
  return Object.freeze(value);
}
