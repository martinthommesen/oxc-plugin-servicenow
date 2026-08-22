/**
 * Versioned ServiceNow GlideRecord API capability table.
 *
 * Method names and roles come from the scoped GlideRecord reference for the
 * Zurich documentation set. Do not match a method only because its name
 * starts with `addSystem`.
 *
 * Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
 */

export const GLIDE_API_RELEASE: ServiceNowRelease = "zurich";

export const GLIDE_SCOPED_RECORD_EVIDENCE =
  "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html";

export type GlideApiScope = "scoped" | "global";

export type GlideMethodRole =
  | "filter"
  | "shape"
  | "acl-bypass"
  | "executor"
  | "consumer"
  | "cursor-advance"
  | "bulk"
  | "value-extractor"
  | "neutral";

export interface GlideMethodCapability {
  name: string;
  roles: readonly GlideMethodRole[];
  evidence: string;
  apiScope: GlideApiScope;
  supportedScopes: readonly GlideApiScope[];
  releases: readonly ServiceNowRelease[];
}

function method(
  name: string,
  roles: readonly GlideMethodRole[],
  extra: Partial<
    Pick<GlideMethodCapability, "evidence" | "apiScope" | "supportedScopes" | "releases">
  > = {},
): GlideMethodCapability {
  return {
    name,
    roles,
    evidence: extra.evidence ?? GLIDE_SCOPED_RECORD_EVIDENCE,
    apiScope: extra.apiScope ?? "scoped",
    supportedScopes: extra.supportedScopes ?? ["scoped", "global"],
    releases: extra.releases ?? [GLIDE_API_RELEASE],
  };
}

/**
 * Documented GlideRecord methods used by conservative query analysis.
 *
 * `addOrCondition` belongs to `GlideQueryCondition`, not GlideRecord.
 * `addInactiveQuery` and `addNotExistsQuery` are not on the Zurich scoped page.
 */
export const GLIDE_RECORD_METHODS: readonly GlideMethodCapability[] = [
  method("addActiveQuery", ["filter"]),
  method("addEncodedQuery", ["filter"]),
  method("addJoinQuery", ["filter"]),
  method("addNotNullQuery", ["filter"]),
  method("addNullQuery", ["filter"]),
  method("addQuery", ["filter"]),
  method("addUserEncodedQuery", ["filter"]),
  method("addUserQuery", ["filter"]),
  method("addSystemEncodedQuery", ["filter", "acl-bypass"]),
  method("addSystemQuery", ["filter", "acl-bypass"]),
  method("addSystemOrderBy", ["shape", "acl-bypass"]),
  method("addSystemOrderByDesc", ["shape", "acl-bypass"]),
  method("addUserOrderBy", ["shape"]),
  method("addUserOrderByDesc", ["shape"]),
  method("orderBy", ["shape"]),
  method("orderByDesc", ["shape"]),
  method("setLimit", ["shape"]),
  method("chooseWindow", ["shape"]),
  method("setNoCount", ["shape"]),
  method("setCategory", ["shape"]),
  method("query", ["executor"]),
  method("get", ["executor"]),
  method("next", ["consumer", "cursor-advance"]),
  method("_next", ["consumer", "cursor-advance"]),
  method("hasNext", ["consumer"]),
  method("getRowCount", ["consumer"]),
  method("updateMultiple", ["bulk"]),
  method("deleteMultiple", ["bulk"]),
  method("getValue", ["value-extractor"]),
  method("getDisplayValue", ["value-extractor"]),
  method("getUniqueValue", ["value-extractor"]),
  method("setValue", ["neutral"]),
  method("insert", ["neutral"]),
  method("update", ["neutral"]),
  method("deleteRecord", ["neutral"]),
  method("initialize", ["neutral"]),
  method("newRecord", ["neutral"]),
  method("setWorkflow", ["neutral"]),
  method("getElement", ["neutral"]),
];

function namesWithRole(role: GlideMethodRole): Set<string> {
  return new Set(
    GLIDE_RECORD_METHODS.filter((entry) => entry.roles.includes(role)).map((entry) => entry.name),
  );
}

/** Query-condition builders. `query`, `orderBy`, `setLimit`, and `chooseWindow` are not filters. */
export const GLIDE_FILTER_METHODS = namesWithRole("filter");

/** Methods that shape the next `query()`, not the already-open cursor. */
export const GLIDE_QUERY_MODIFIERS = new Set<string>([
  ...namesWithRole("filter"),
  ...namesWithRole("shape"),
]);

/** Documented methods that bypass query ACL enforcement. */
export const GLIDE_SYSTEM_BYPASS_METHODS = namesWithRole("acl-bypass");

export const GLIDE_QUERY_EXECUTORS = namesWithRole("executor");

export const GLIDE_RESULT_CONSUMERS = namesWithRole("consumer");

/** Documented methods that advance a GlideRecord cursor and require an opened result. */
export const GLIDE_CURSOR_ADVANCERS = namesWithRole("cursor-advance");

export const GLIDE_BULK_METHODS = namesWithRole("bulk");

export const GLIDE_VALUE_EXTRACTORS = namesWithRole("value-extractor");

/** Every method name in the versioned table, including neutrals. */
export const GLIDE_KNOWN_METHODS = new Set(GLIDE_RECORD_METHODS.map((entry) => entry.name));

class ReadonlySetView<T> implements ReadonlySet<T> {
  readonly #values: Set<T>;

  constructor(values: Iterable<T>) {
    this.#values = new Set(values);
    Object.freeze(this);
  }

  get size(): number {
    return this.#values.size;
  }
  has(value: T): boolean {
    return this.#values.has(value);
  }
  forEach(callbackfn: (value: T, value2: T, set: ReadonlySet<T>) => void, thisArg?: unknown): void {
    this.#values.forEach((value) => callbackfn.call(thisArg, value, value, this));
  }
  entries(): SetIterator<[T, T]> {
    return this.#values.entries();
  }
  keys(): SetIterator<T> {
    return this.#values.keys();
  }
  values(): SetIterator<T> {
    return this.#values.values();
  }
  [Symbol.iterator](): SetIterator<T> {
    return this.#values[Symbol.iterator]();
  }
  get [Symbol.toStringTag](): string {
    return "Set";
  }
}

function readonlyNames(
  entries: readonly GlideMethodCapability[],
  role?: GlideMethodRole,
): ReadonlySet<string> {
  return new ReadonlySetView(
    entries
      .filter((entry) => role === undefined || entry.roles.includes(role))
      .map((entry) => entry.name),
  );
}

export interface GlideCapabilityView {
  readonly scope: ApplicationScope;
  readonly release: ServiceNowRelease;
  readonly methods: readonly GlideMethodCapability[];
  readonly filters: ReadonlySet<string>;
  readonly modifiers: ReadonlySet<string>;
  readonly systemBypass: ReadonlySet<string>;
  readonly executors: ReadonlySet<string>;
  readonly consumers: ReadonlySet<string>;
  readonly cursorAdvancers: ReadonlySet<string>;
  readonly bulk: ReadonlySet<string>;
  readonly valueExtractors: ReadonlySet<string>;
  readonly knownMethods: ReadonlySet<string>;
}

const CAPABILITY_CACHE = new Map<string, GlideCapabilityView>();

/** Select documented methods for one exact application scope and release. */
export function resolveGlideCapabilities(input: {
  scope: ApplicationScope;
  release?: ServiceNowRelease;
}): GlideCapabilityView {
  const release = input.release ?? GLIDE_API_RELEASE;
  const key = `${input.scope}:${release}`;
  const existing = CAPABILITY_CACHE.get(key);
  if (existing) return existing;
  const effectiveScope: GlideApiScope = input.scope === "global" ? "global" : "scoped";
  const methods = Object.freeze(
    GLIDE_RECORD_METHODS.filter(
      (entry) => entry.releases.includes(release) && entry.supportedScopes.includes(effectiveScope),
    ),
  );
  const filters = readonlyNames(methods, "filter");
  const shape = readonlyNames(methods, "shape");
  const view: GlideCapabilityView = Object.freeze({
    scope: input.scope,
    release,
    methods,
    filters,
    modifiers: new ReadonlySetView([...filters, ...shape]),
    systemBypass: readonlyNames(methods, "acl-bypass"),
    executors: readonlyNames(methods, "executor"),
    consumers: readonlyNames(methods, "consumer"),
    cursorAdvancers: readonlyNames(methods, "cursor-advance"),
    bulk: readonlyNames(methods, "bulk"),
    valueExtractors: readonlyNames(methods, "value-extractor"),
    knownMethods: readonlyNames(methods),
  });
  CAPABILITY_CACHE.set(key, view);
  return view;
}
import type { ServiceNowRelease } from "../settings/releases.js";
import type { ApplicationScope } from "../types.js";
