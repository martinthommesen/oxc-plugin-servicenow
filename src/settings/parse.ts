import { ServiceNowSettingsError } from "./errors.js";

export function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function expectEnum<T extends string>(
  path: string,
  value: unknown,
  allowed: ReadonlySet<T>,
): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new ServiceNowSettingsError(
      path,
      `expected one of ${[...allowed].join(", ")}, got ${JSON.stringify(value)}`,
    );
  }
  return value as T;
}
