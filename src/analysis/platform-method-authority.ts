import type { BindingWriteQuery } from "./binding-writes.js";
import type { MutationQuery } from "./mutations.js";

export interface PlatformMethodAuthorityFacts {
  readonly bindingWrites: BindingWriteQuery;
  readonly mutations: MutationQuery;
  readonly browserMutations?: MutationQuery;
}

interface GlobalObjectMethodOptions {
  readonly prototypeConstructor?: string;
  readonly runtime?: "instance" | "browser";
}

const GLIDE_RECORD_CONSTRUCTORS = ["GlideRecord", "GlideRecordSecure"] as const;

function hasReceiverMethodAuthority(
  facts: PlatformMethodAuthorityFacts,
  mutations: MutationQuery,
  receiver: unknown,
  property: string,
): boolean {
  return (
    !facts.bindingWrites.hasDynamicScope() &&
    !mutations.isObjectPropertyAuthorityLost(receiver, property)
  );
}

function mutationsFor(
  facts: PlatformMethodAuthorityFacts,
  runtime: "instance" | "browser",
): MutationQuery {
  return runtime === "browser" ? (facts.browserMutations ?? facts.mutations) : facts.mutations;
}

/**
 * Return true only while a method on a platform-owned global object still has
 * proven platform identity. Root replacement is deliberately file-wide: an
 * alias can be initialized from the replacement inside a deferred function
 * even when its declaration appears earlier in source order.
 */
export function hasAuthoritativeGlobalObjectMethod(
  facts: PlatformMethodAuthorityFacts,
  receiver: unknown,
  globalName: string,
  property: string,
  options: GlobalObjectMethodOptions,
): boolean {
  const mutations = mutationsFor(facts, options.runtime ?? "instance");
  if (!hasReceiverMethodAuthority(facts, mutations, receiver, property)) return false;
  if (mutations.isGlobalAuthorityLost(globalName)) return false;
  if (mutations.isGlobalPathAuthorityLost([globalName, property])) return false;
  return !(
    options.prototypeConstructor &&
    (mutations.isGlobalPathAuthorityLost([options.prototypeConstructor, "prototype"]) ||
      mutations.isGlobalPathAuthorityLost([options.prototypeConstructor, "prototype", property]))
  );
}

/**
 * Return true only while a method reached through a constructed platform
 * object still has proven platform identity. Mutation analysis is deliberately
 * file-wide because source order cannot establish runtime order across deferred
 * callbacks and function bodies.
 */
export function hasAuthoritativeConstructedMethod(
  facts: PlatformMethodAuthorityFacts,
  receiver: unknown,
  constructorName: string,
  property: string,
  runtime: "instance" | "browser" = "instance",
): boolean {
  const mutations = mutationsFor(facts, runtime);
  return (
    hasReceiverMethodAuthority(facts, mutations, receiver, property) &&
    !mutations.isGlobalAuthorityLost(constructorName) &&
    !mutations.isGlobalPathAuthorityLost([constructorName, "prototype"]) &&
    !mutations.isGlobalPathAuthorityLost([constructorName, "prototype", property])
  );
}

/**
 * GlideRecord and GlideRecordSecure intentionally share one provenance kind.
 * Until that public abstraction distinguishes constructors, require both
 * constructor/prototype paths to remain authoritative and prefer silence when
 * either may have changed.
 */
export function hasAuthoritativeGlideRecordMethod(
  facts: PlatformMethodAuthorityFacts,
  receiver: unknown,
  property: string,
): boolean {
  return GLIDE_RECORD_CONSTRUCTORS.every((constructorName) =>
    hasAuthoritativeConstructedMethod(facts, receiver, constructorName, property),
  );
}
