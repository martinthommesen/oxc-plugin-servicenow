import { SUPPORTED_SERVICENOW_RELEASES, type ServiceNowRelease } from "../settings/releases.js";
import type { ApplicationScope } from "../types.js";

/**
 * Versioned ServiceNow GlideRecord API capability table.
 *
 * Method names and roles come from the scoped and global GlideRecord
 * references for each reviewed documentation release. Do not infer a role
 * from a method name alone.
 *
 * Evidence:
 * https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
 * https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
 */

export const GLIDE_API_RELEASES: readonly ServiceNowRelease[] = SUPPORTED_SERVICENOW_RELEASES;

const GLIDE_METHOD_SUPPORT_BY_RELEASE: Readonly<Record<ServiceNowRelease, true>> = Object.freeze({
  zurich: true,
  australia: true,
});
const GLIDE_METHOD_RELEASES = Object.freeze(
  Object.keys(GLIDE_METHOD_SUPPORT_BY_RELEASE) as ServiceNowRelease[],
);

export interface GlideRecordEvidence {
  readonly scoped: string;
  readonly global: string;
  readonly officialReleaseLabel: string;
  readonly officialUpdatedAt: string | null;
  readonly reviewedAt: string;
}

export const GLIDE_RECORD_EVIDENCE: Readonly<Record<ServiceNowRelease, GlideRecordEvidence>> =
  Object.freeze({
    zurich: Object.freeze({
      scoped:
        "https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html",
      global:
        "https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordAPI.html",
      officialReleaseLabel: "Zurich",
      officialUpdatedAt: null,
      reviewedAt: "2026-08-22",
    }),
    australia: Object.freeze({
      scoped:
        "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html",
      global:
        "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html",
      officialReleaseLabel: "Australia",
      officialUpdatedAt: "2026-03-12",
      reviewedAt: "2026-08-22",
    }),
  });

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
  evidence: Readonly<Record<ServiceNowRelease, string>>;
  apiScope: GlideApiScope;
  supportedScopes: readonly GlideApiScope[];
  releases: readonly ServiceNowRelease[];
}

export type GlideDocumentedMethodInventory = Readonly<
  Record<ServiceNowRelease, Readonly<Record<GlideApiScope, readonly string[]>>>
>;

function method(
  name: string,
  roles: readonly GlideMethodRole[],
  extra: Partial<Pick<GlideMethodCapability, "apiScope" | "supportedScopes" | "releases">> = {},
): GlideMethodCapability {
  const apiScope = extra.apiScope ?? "scoped";
  const evidence = Object.freeze(
    Object.fromEntries(
      SUPPORTED_SERVICENOW_RELEASES.map((release) => [
        release,
        GLIDE_RECORD_EVIDENCE[release][apiScope],
      ]),
    ) as Record<ServiceNowRelease, string>,
  );
  return {
    name,
    roles,
    evidence,
    apiScope,
    supportedScopes: extra.supportedScopes ?? ["scoped", "global"],
    releases: extra.releases ?? GLIDE_METHOD_RELEASES,
  };
}

/**
 * Documented GlideRecord methods used by conservative query analysis.
 *
 * `addOrCondition` belongs to `GlideQueryCondition`, not GlideRecord.
 * `addInactiveQuery` and `addNotExistsQuery` are not on the reviewed scoped pages.
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
  method("_query", ["executor"]),
  method("queryNoDomain", ["executor"], {
    apiScope: "global",
    supportedScopes: ["global"],
  }),
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

const AUSTRALIA_SHARED_METHODS = [
  "addFunction",
  "canCreate",
  "canDelete",
  "canRead",
  "canWrite",
  "disableSysIdInOptimization",
  "getAttribute",
  "getClassDisplayValue",
  "getED",
  "getEncodedQuery",
  "getLabel",
  "getLink",
  "getRecordClassName",
  "getTableName",
  "isNewRecord",
  "isValid",
  "isValidField",
  "isValidRecord",
  "operation",
  "setAbortAction",
  "setNewGuidValue",
  "updateWithReferences",
] as const;

const AUSTRALIA_SCOPED_ONLY_METHODS = [
  "getElements",
  "getLastErrorMessage",
  "isActionAborted",
  "isEncodedQueryValid",
  "isValidEncodedQuery",
  "isView",
] as const;

const AUSTRALIA_GLOBAL_ONLY_METHODS = [
  "addDomainQuery",
  "addExtraField",
  "addInactiveQuery",
  "addValue",
  "applyEncodedQuery",
  "applyTemplate",
  "autoSysFields",
  "changes",
  "find",
  "getDynamicAttribute",
  "getDynamicAttributeDisplayValue",
  "getDynamicAttributeValue",
  "getEscapedDisplayValue",
  "getFields",
  "getLocation",
  "getPlural",
  "getRelatedLists",
  "getRelatedTables",
  "getRowNumber",
  "hasAttachments",
  "insertWithReferences",
  "instanceOf",
  "restoreLocation",
  "saveLocation",
  "setDisplayValue",
  "setDynamicAttributeDisplayValue",
  "setDynamicAttributeValue",
  "setDynamicAttributeValues",
  "setForceUpdate",
  "setLocation",
  "setNewGuid",
  "setQueryReferences",
  "setUseEngines",
] as const;

function sortedUniqueNames(...groups: readonly (readonly string[])[]): readonly string[] {
  return Object.freeze([...new Set(groups.flat())].sort());
}

function modeledNamesForScope(scope: GlideApiScope): readonly string[] {
  return GLIDE_RECORD_METHODS.filter((entry) => entry.supportedScopes.includes(scope)).map(
    (entry) => entry.name,
  );
}

const MODELED_SCOPED_METHODS = modeledNamesForScope("scoped");
const MODELED_GLOBAL_METHODS = modeledNamesForScope("global");

/**
 * Complete reviewed method-name inventories used only as a method-vs-field
 * firewall. Semantic query roles remain in `GLIDE_RECORD_METHODS`.
 *
 * Australia is complete against both official API pages. Zurich retains the
 * smaller role-bearing inventory until its own page-wide audit is completed;
 * Australia names are never asserted as Zurich API availability.
 */
export const GLIDE_DOCUMENTED_METHODS: GlideDocumentedMethodInventory = Object.freeze({
  zurich: Object.freeze({
    scoped: sortedUniqueNames(MODELED_SCOPED_METHODS),
    global: sortedUniqueNames(MODELED_GLOBAL_METHODS),
  }),
  australia: Object.freeze({
    scoped: sortedUniqueNames(
      MODELED_SCOPED_METHODS,
      AUSTRALIA_SHARED_METHODS,
      AUSTRALIA_SCOPED_ONLY_METHODS,
    ),
    global: sortedUniqueNames(
      MODELED_GLOBAL_METHODS,
      AUSTRALIA_SHARED_METHODS,
      AUSTRALIA_GLOBAL_ONLY_METHODS,
    ),
  }),
});

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

/** Every reviewed documented method name across supported releases and scopes. */
export const GLIDE_KNOWN_METHODS = new Set(
  SUPPORTED_SERVICENOW_RELEASES.flatMap((release) => [
    ...GLIDE_DOCUMENTED_METHODS[release].scoped,
    ...GLIDE_DOCUMENTED_METHODS[release].global,
  ]),
);

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
  readonly release: ServiceNowRelease | undefined;
  readonly releases: readonly ServiceNowRelease[];
  /** Methods documented for every admissible release and API scope. */
  readonly methods: readonly GlideMethodCapability[];
  readonly filters: ReadonlySet<string>;
  readonly modifiers: ReadonlySet<string>;
  readonly systemBypass: ReadonlySet<string>;
  /** Executors definitely available in the configured scope. */
  readonly executors: ReadonlySet<string>;
  /** Executors available in at least one API scope allowed by the configured scope. */
  readonly possibleExecutors: ReadonlySet<string>;
  readonly consumers: ReadonlySet<string>;
  readonly cursorAdvancers: ReadonlySet<string>;
  readonly bulk: ReadonlySet<string>;
  readonly valueExtractors: ReadonlySet<string>;
  /** Role-bearing methods whose effects are modeled by shared analysis. */
  readonly modeledMethods: ReadonlySet<string>;
  /** Complete documented-name firewall; does not imply a modeled effect. */
  readonly knownMethods: ReadonlySet<string>;
}

const CAPABILITY_CACHE = new Map<string, GlideCapabilityView>();
const GLIDE_API_SCOPES: readonly GlideApiScope[] = ["scoped", "global"];

/** Select documented methods for every admissible application scope and release. */
export function resolveGlideCapabilities(input: {
  scope: ApplicationScope;
  release?: ServiceNowRelease;
}): GlideCapabilityView {
  const key = `${input.scope}:${input.release ?? "*"}`;
  const existing = CAPABILITY_CACHE.get(key);
  if (existing) return existing;
  const releases = Object.freeze(
    input.release === undefined ? [...SUPPORTED_SERVICENOW_RELEASES] : [input.release],
  );
  const scopes: readonly GlideApiScope[] =
    input.scope === "unknown" ? GLIDE_API_SCOPES : [input.scope];
  const combinations = releases.flatMap((release) => scopes.map((scope) => ({ release, scope })));
  const supports = (
    entry: GlideMethodCapability,
    candidate: { release: ServiceNowRelease; scope: GlideApiScope },
  ) =>
    entry.releases.includes(candidate.release) && entry.supportedScopes.includes(candidate.scope);
  const possibleMethods = Object.freeze(
    GLIDE_RECORD_METHODS.filter((entry) =>
      combinations.some((candidate) => supports(entry, candidate)),
    ),
  );
  const methods = Object.freeze(
    possibleMethods.filter((entry) =>
      combinations.every((candidate) => supports(entry, candidate)),
    ),
  );
  const filters = readonlyNames(methods, "filter");
  const shape = readonlyNames(methods, "shape");
  const view: GlideCapabilityView = Object.freeze({
    scope: input.scope,
    release: input.release,
    releases,
    methods,
    filters,
    modifiers: new ReadonlySetView([...filters, ...shape]),
    systemBypass: readonlyNames(methods, "acl-bypass"),
    executors: readonlyNames(methods, "executor"),
    possibleExecutors: readonlyNames(possibleMethods, "executor"),
    consumers: readonlyNames(methods, "consumer"),
    cursorAdvancers: readonlyNames(methods, "cursor-advance"),
    bulk: readonlyNames(methods, "bulk"),
    valueExtractors: readonlyNames(methods, "value-extractor"),
    modeledMethods: readonlyNames(possibleMethods),
    // A documented method in either API scope must not be mistaken for a
    // GlideElement field. Scope misuse belongs to a separate diagnostic.
    knownMethods: new ReadonlySetView(
      releases.flatMap((release) => [
        ...GLIDE_DOCUMENTED_METHODS[release].scoped,
        ...GLIDE_DOCUMENTED_METHODS[release].global,
      ]),
    ),
  });
  CAPABILITY_CACHE.set(key, view);
  return view;
}
