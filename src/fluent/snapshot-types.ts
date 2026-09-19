/**
 * Shape of the generated SDK declaration snapshots. The generated module
 * annotates its constant with this interface instead of `as const`, because
 * the literal type of a 27-version snapshot emits a ~939 KB declaration file
 * that no consumer uses (FINDINGS.md PER-001).
 *
 * The shipped projection carries only the fields `registry.ts` reads. The
 * declaration hashes, paths, `absent` and `lifecycle` blocks are drift
 * evidence, not package input, and stay in `tests/fixtures/fluent-sdk-declarations.json`,
 * which `scripts/audit-fluent-sdk.mjs` still writes in full.
 */
export type DeclarationIdPolicy = "required" | "deprecated" | "unknown";

/** One name the reviewed declarations export, reduced to the fields the runtime joins on. */
export interface DeclarationDiscoveredCapability {
  readonly module: string;
  /** The first reviewed version whose declarations export this name. */
  readonly introduced: string | null;
}

export interface DeclarationSnapshot {
  /** Name to id policy for declarations the reviewed manifest also owns. */
  readonly idPolicy: Readonly<Record<string, DeclarationIdPolicy>>;
  /** Name to module and introduction version for every other exported name. */
  readonly discovered: Readonly<Record<string, DeclarationDiscoveredCapability>>;
}
