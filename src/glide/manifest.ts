import { SUPPORTED_SERVICENOW_RELEASES, type ServiceNowRelease } from "../settings/releases.js";
import { immutableSet } from "../utils/immutable.js";
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

/**
 * Reviewed GlideAggregate documentation, per release and API scope.
 *
 * Scoped and global pages are reviewed for both supported releases. A method
 * role applies only where the matching release and API-scope page supports it.
 */
export const GLIDE_AGGREGATE_EVIDENCE: Readonly<
  Record<ServiceNowRelease, Readonly<Partial<Record<GlideApiScope, string>>>>
> = Object.freeze({
  zurich: Object.freeze({
    scoped:
      "https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html",
    global:
      "https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideAggregateAPI.html",
  }),
  australia: Object.freeze({
    scoped:
      "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html",
    global:
      "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateAPI.html",
  }),
});

/**
 * Receiver kinds whose method roles the manifest resolves.
 *
 * Deliberately separate from `GlideMethodRole`: that union names what a method
 * does to a query, this names what a method is called on. Folding a receiver
 * into the role enum would make the per-kind table one-dimensional again.
 */
export type GlideReceiverKind = "GlideRecord" | "GlideAggregate";

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
  extra: Partial<Pick<GlideMethodCapability, "apiScope" | "supportedScopes" | "releases">> & {
    evidenceFor?: (release: ServiceNowRelease) => string;
  } = {},
): GlideMethodCapability {
  const apiScope = extra.apiScope ?? "scoped";
  const evidenceFor = extra.evidenceFor ?? ((release) => GLIDE_RECORD_EVIDENCE[release][apiScope]);
  const evidence = Object.freeze(
    Object.fromEntries(
      SUPPORTED_SERVICENOW_RELEASES.map((release) => [release, evidenceFor(release)]),
    ) as Record<ServiceNowRelease, string>,
  );
  return {
    name,
    roles,
    evidence,
    apiScope,
    supportedScopes: extra.supportedScopes ?? ["scoped", "global"],
    releases: extra.releases ?? SUPPORTED_SERVICENOW_RELEASES,
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

function aggregateMethod(name: string, roles: readonly GlideMethodRole[]): GlideMethodCapability {
  return method(name, roles, {
    evidenceFor: (release) => GLIDE_AGGREGATE_EVIDENCE[release].scoped as string,
  });
}

/**
 * Reviewed GlideAggregate methods whose query roles shared analysis cares about.
 *
 * These four roles reproduce the behaviour that used to be open-coded as string
 * literals in the finders: `query` commits an aggregate, `next` advances its
 * cursor, and `addAggregate`/`getAggregate` configure and read it. `addAggregate`
 * and `getAggregate` carry no role here because the finders key them on argument
 * tuples this manifest does not model.
 */
export const GLIDE_AGGREGATE_METHODS: readonly GlideMethodCapability[] = [
  aggregateMethod("query", ["executor"]),
  aggregateMethod("next", ["consumer", "cursor-advance"]),
  aggregateMethod("addAggregate", ["neutral"]),
  aggregateMethod("getAggregate", ["neutral"]),
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

function readonlyNames(
  entries: readonly GlideMethodCapability[],
  role?: GlideMethodRole,
): ReadonlySet<string> {
  return immutableSet(
    entries
      .filter((entry) => role === undefined || entry.roles.includes(role))
      .map((entry) => entry.name),
  );
}

/** The role sets a receiver kind exposes, resolved for the view's scope and release. */
export interface GlideMethodRoleSets {
  readonly filters: ReadonlySet<string>;
  readonly modifiers: ReadonlySet<string>;
  readonly systemBypass: ReadonlySet<string>;
  readonly executors: ReadonlySet<string>;
  readonly possibleExecutors: ReadonlySet<string>;
  readonly consumers: ReadonlySet<string>;
  readonly cursorAdvancers: ReadonlySet<string>;
  readonly bulk: ReadonlySet<string>;
  readonly valueExtractors: ReadonlySet<string>;
}

export interface GlideCapabilityView {
  readonly scope: ApplicationScope;
  readonly release: ServiceNowRelease | undefined;
  readonly releases: readonly ServiceNowRelease[];
  /** Methods documented for every admissible release and API scope. */
  readonly methods: readonly GlideMethodCapability[];
  /** Role membership per receiver kind. The flat sets below are the GlideRecord entry. */
  readonly byKind: Readonly<Record<GlideReceiverKind, GlideMethodRoleSets>>;
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
  release?: ServiceNowRelease | undefined;
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
  const roleSetsFor = (inventory: readonly GlideMethodCapability[]): GlideMethodRoleSets => {
    const possible = inventory.filter((entry) =>
      combinations.some((candidate) => supports(entry, candidate)),
    );
    const definite = possible.filter((entry) =>
      combinations.every((candidate) => supports(entry, candidate)),
    );
    const filters = readonlyNames(definite, "filter");
    return {
      filters,
      modifiers: immutableSet([...filters, ...readonlyNames(definite, "shape")]),
      systemBypass: readonlyNames(definite, "acl-bypass"),
      executors: readonlyNames(definite, "executor"),
      possibleExecutors: readonlyNames(possible, "executor"),
      consumers: readonlyNames(definite, "consumer"),
      cursorAdvancers: readonlyNames(definite, "cursor-advance"),
      bulk: readonlyNames(definite, "bulk"),
      valueExtractors: readonlyNames(definite, "value-extractor"),
    };
  };
  const byKind: Readonly<Record<GlideReceiverKind, GlideMethodRoleSets>> = Object.freeze({
    GlideRecord: roleSetsFor(GLIDE_RECORD_METHODS),
    GlideAggregate: roleSetsFor(GLIDE_AGGREGATE_METHODS),
  });
  const recordSets = byKind.GlideRecord;
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
  const view: GlideCapabilityView = Object.freeze({
    scope: input.scope,
    release: input.release,
    releases,
    methods,
    byKind,
    filters: recordSets.filters,
    modifiers: recordSets.modifiers,
    systemBypass: recordSets.systemBypass,
    executors: recordSets.executors,
    possibleExecutors: recordSets.possibleExecutors,
    consumers: recordSets.consumers,
    cursorAdvancers: recordSets.cursorAdvancers,
    bulk: recordSets.bulk,
    valueExtractors: recordSets.valueExtractors,
    modeledMethods: readonlyNames(possibleMethods),
    // A documented method in either API scope must not be mistaken for a
    // GlideElement field. Scope misuse belongs to a separate diagnostic.
    knownMethods: immutableSet(
      releases.flatMap((release) => [
        ...GLIDE_DOCUMENTED_METHODS[release].scoped,
        ...GLIDE_DOCUMENTED_METHODS[release].global,
      ]),
    ),
  });
  CAPABILITY_CACHE.set(key, view);
  return view;
}
