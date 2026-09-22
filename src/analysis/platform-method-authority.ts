import type { ESTree } from "@oxlint/plugins";
import type { BindingWriteQuery } from "./binding-writes.js";
import { staticPropertyName } from "./members.js";
import type { MutationQuery } from "./mutations.js";
import type { Provenance, ProvenanceKind, ProvenanceQuery } from "./provenance.js";

export interface PlatformMethodAuthorityFacts {
  readonly bindingWrites: BindingWriteQuery;
  readonly mutations: MutationQuery;
  readonly browserMutations?: MutationQuery;
}

/** Authority facts plus the provenance query they are judged against. */
export interface ProvenPlatformFacts extends PlatformMethodAuthorityFacts {
  readonly provenance: ProvenanceQuery;
}

export interface ProvenReceiverMethodOptions {
  readonly kind: ProvenanceKind;
  readonly method: string;
  readonly runtime?: "instance" | "browser";
}

/**
 * The provenance of `node` while it is a proven, unescaped `kind` value.
 *
 * This is the receiver half every caller of the authority predicates repeats:
 * ask the trust-aware query, then require the expected kind.
 */
export function provenReceiver(
  provenance: ProvenanceQuery,
  node: unknown,
  kind: ProvenanceKind,
): Provenance | null {
  const proven = provenance.trustedExpression(node);
  return proven?.kind === kind ? proven : null;
}

/**
 * The member access of `call` when it invokes `method` on an expression proven
 * to hold a `kind` value whose method is still authoritative, otherwise null.
 */
export function provenReceiverMethod(
  file: ProvenPlatformFacts,
  call: ESTree.CallExpression,
  { kind, method, runtime }: ProvenReceiverMethodOptions,
): ESTree.MemberExpression | null {
  if (call.callee.type !== "MemberExpression") return null;
  const member = call.callee as ESTree.MemberExpression;
  if (staticPropertyName(member) !== method) return null;
  if (!provenReceiver(file.provenance, member.object, kind)) return null;
  return hasAuthoritativeConstructedMethod(file, member.object, kind, method, runtime)
    ? member
    : null;
}

interface GlobalObjectMethodOptions {
  readonly prototypeConstructor?: string;
  readonly runtime?: "instance" | "browser";
}

export const GLIDE_RECORD_CONSTRUCTORS = ["GlideRecord", "GlideRecordSecure"] as const;

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

function hasConstructorPathAuthority(
  mutations: MutationQuery,
  constructorName: string,
  property: string,
): boolean {
  return (
    !mutations.isGlobalAuthorityLost(constructorName) &&
    !mutations.isGlobalPathAuthorityLost([constructorName, "prototype"]) &&
    !mutations.isGlobalPathAuthorityLost([constructorName, "prototype", property])
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
    hasConstructorPathAuthority(mutations, constructorName, property)
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
  return (
    hasReceiverMethodAuthority(facts, facts.mutations, receiver, property) &&
    GLIDE_RECORD_CONSTRUCTORS.every((constructorName) =>
      hasConstructorPathAuthority(facts.mutations, constructorName, property),
    )
  );
}
