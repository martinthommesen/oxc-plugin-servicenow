/**
 * Queries over the declaration snapshots.
 *
 * The generated module remains raw data. This module owns the joins the
 * registry needs, so callers do not depend on the generated record shape.
 */

import { FLUENT_DECLARATION_SNAPSHOTS } from "./declaration-snapshots.js";
import { SUPPORTED_FLUENT_SDK_VERSIONS } from "./sdk-versions.js";
import type { DeclarationIdPolicy, DeclarationSnapshot } from "./snapshot-types.js";

const snapshots: Readonly<Record<string, DeclarationSnapshot>> = FLUENT_DECLARATION_SNAPSHOTS;

export function hasDeclarationSnapshot(sdkVersion: string): boolean {
  return snapshots[sdkVersion] !== undefined;
}

/** The id policy the reviewed declarations give `name` in `sdkVersion`, if any. */
export function declaredIdPolicy(
  sdkVersion: string,
  name: string,
): DeclarationIdPolicy | undefined {
  return snapshots[sdkVersion]?.idPolicy[name];
}

/** The first reviewed version whose declarations assign `name` this id policy. */
export function firstPolicyIn(name: string, policy: DeclarationIdPolicy): string | undefined {
  return SUPPORTED_FLUENT_SDK_VERSIONS.find(
    (version) => snapshots[version]?.idPolicy[name] === policy,
  );
}

/** Every discovered name in a version, paired with its declaration record. */
export function discoveredEntries(
  sdkVersion: string,
): readonly (readonly [string, DeclarationSnapshot["discovered"][string]])[] {
  return Object.entries(snapshots[sdkVersion]?.discovered ?? {});
}
