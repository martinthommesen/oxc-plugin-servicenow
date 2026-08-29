import type { FluentApiCapability } from "./manifest.js";

export interface FluentLifecycleSnapshot {
  readonly introduced: string | null;
  readonly deprecated: string | null;
}

/**
 * Compare runtime lifecycle metadata with its reviewed declaration snapshot.
 * Missing optional fields normalize to null so deleting one cannot pass open.
 */
export function assertFluentLifecycleMatches(
  api: Pick<FluentApiCapability, "name" | "introduced" | "deprecated">,
  snapshot: FluentLifecycleSnapshot,
  label = api.name,
): void {
  if ((api.introduced ?? null) !== snapshot.introduced)
    throw new Error(`${label} introduction lifecycle drifted`);
  if ((api.deprecated ?? null) !== snapshot.deprecated)
    throw new Error(`${label} deprecation lifecycle drifted`);
}
