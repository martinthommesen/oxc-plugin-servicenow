/**
 * Versioned ServiceNow Fluent capability manifest.
 *
 * Manual additions require an evidence URL. CI checks that every API and
 * directive has evidence and that official directives stay recognized.
 *
 * Verified against:
 * - https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html
 * - https://github.com/ServiceNow/sdk-examples
 * - ServiceNow SDK Fluent API lists used by current `@servicenow/sdk` samples
 */

export type FluentApiKind = "entity" | "column" | "automation" | "helper";

export type FluentIdRequirement = "required" | "optional" | "deprecated" | "forbidden" | "unknown";

export type FluentDirectivePlacement = "previous-line" | "first-line" | "anywhere";

export interface FluentEvidenceRecord {
  /** One authoritative URL or repository fixture, never a compound citation. */
  url: string;
  /** Exact exported symbol or directive covered by this record. */
  symbol: string;
  /** SDK version at which this record applies. */
  version: string;
  transition?: "introduced" | "deprecated" | "removed" | "renamed" | "current";
}

export interface FluentApiCapability {
  name: string;
  module: string | "unknown";
  kind: FluentApiKind;
  idRequirement: FluentIdRequirement;
  introduced?: string;
  deprecated?: string;
  evidence: string;
  evidenceRecords: readonly FluentEvidenceRecord[];
}

export interface FluentDirectiveCapability {
  name: string;
  placement: FluentDirectivePlacement;
  evidence: string;
  evidenceRecords: readonly FluentEvidenceRecord[];
}

export interface FluentSdkManifest {
  version: string;
  /** Semver key used by `settings.servicenow.fluentSdkVersion`. */
  sdkVersion?: string;
  evidence: readonly string[];
  apis: readonly FluentApiCapability[];
  directives: readonly FluentDirectiveCapability[];
  typos: Readonly<Record<string, string>>;
}

const FLUENT_OVERVIEW = "https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html";
const SDK_EXAMPLES = "https://github.com/ServiceNow/sdk-examples";
const SDK_CORE = "@servicenow/sdk/core";

function firstEvidenceUrl(evidence: string): string {
  return evidence.match(/https?:\/\/[^ )]+/)?.[0] ?? evidence;
}

function entity(
  name: string,
  idRequirement: FluentIdRequirement,
  extra: Partial<FluentApiCapability> = {},
): FluentApiCapability {
  const evidence = extra.evidence ?? `${FLUENT_OVERVIEW} and ${SDK_EXAMPLES}`;
  const version = extra.introduced ?? "3.0.0";
  return {
    name,
    module: SDK_CORE,
    kind: "entity",
    idRequirement,
    evidence,
    evidenceRecords: extra.evidenceRecords ?? [
      { url: firstEvidenceUrl(evidence), symbol: name, version, transition: extra.introduced ? "introduced" : "current" },
    ],
    ...extra,
  };
}

function column(name: string): FluentApiCapability {
  return {
    name,
    module: SDK_CORE,
    kind: "column",
    idRequirement: "forbidden",
    evidence: `${FLUENT_OVERVIEW} (Table schema column helpers)`,
    evidenceRecords: [
      { url: FLUENT_OVERVIEW, symbol: name, version: "3.0.0", transition: "current" },
    ],
  };
}

/**
 * Default manifest for current official Fluent documentation (Australia / Zurich SDK samples).
 */
export const DEFAULT_FLUENT_MANIFEST_VERSION = "sdk-docs-2026-03";

export const DEFAULT_FLUENT_MANIFEST: FluentSdkManifest = {
  version: DEFAULT_FLUENT_MANIFEST_VERSION,
  evidence: [FLUENT_OVERVIEW, SDK_EXAMPLES],
  apis: [
    entity("Acl", "required", { evidence: `${SDK_EXAMPLES}/acl-sample` }),
    entity("AliasTemplate", "required", { introduced: "4.8.0" }),
    entity("ApplicationMenu", "required", { evidence: `${SDK_EXAMPLES}/applicationmenu-sample` }),
    entity("BusinessRule", "required", { evidence: `${FLUENT_OVERVIEW} and ${SDK_EXAMPLES}/businessrule-sample` }),
    entity("CatalogClientScript", "required"),
    entity("CatalogItem", "required", { evidence: `${SDK_EXAMPLES}/service-catalog-sample` }),
    entity("CatalogItemRecordProducer", "required", { introduced: "4.8.0" }),
    entity("ClientScript", "required", { evidence: `${FLUENT_OVERVIEW} and ${SDK_EXAMPLES}/clientscript-sample` }),
    entity("CrossScopePrivilege", "required"),
    entity("DatabaseIndex", "optional"),
    entity("InboundEmailAction", "required"),
    // SDK 4.1 derives list IDs; the declaration keeps `$id` only as a
    // deprecated compatibility property.  Keep that policy distinct from
    // entities whose WithID contract requires an explicit identity.
    entity("List", "deprecated", {
      deprecated: "4.1.0",
      evidence: `${SDK_EXAMPLES}/list-sample`,
      evidenceRecords: [
        { url: SDK_EXAMPLES, symbol: "List", version: "3.0.0", transition: "current" },
        { url: SDK_EXAMPLES, symbol: "List", version: "4.1.0", transition: "deprecated" },
      ],
    }),
    entity("Module", "required"),
    entity("Property", "required"),
    entity("Record", "required", { evidence: `${FLUENT_OVERVIEW} and ${SDK_EXAMPLES}/record-sample` }),
    entity("UserPreference", "required", { evidence: `${FLUENT_OVERVIEW} and ${SDK_EXAMPLES}/user-preference-sample` }),
    entity("RestApi", "required", { evidence: `${SDK_EXAMPLES}/restapi-sample` }),
    entity("Role", "required"),
    entity("ScheduledScript", "required", { introduced: "4.8.0" }),
    entity("ScriptedRestApi", "required"),
    entity("SPMenu", "required", { introduced: "4.8.0", evidence: `${SDK_EXAMPLES}/service-portal-sample` }),
    entity("SPWidget", "required", { evidence: `${SDK_EXAMPLES}/service-portal-sample` }),
    entity("StateModel", "required", { introduced: "4.10.0" }),
    // Table's published 4.1 declaration has no WithID contract.  Its ID is
    // derived from the table metadata rather than supplied by callers.
    entity("Table", "forbidden", { evidence: `${FLUENT_OVERVIEW} and ${SDK_EXAMPLES}/table-sample` }),
    entity("Test", "required", { evidence: `${SDK_EXAMPLES}/test-atf-sample` }),
    entity("ScriptAction", "required", { evidence: `${FLUENT_OVERVIEW} and ${SDK_EXAMPLES}/script-action-sample` }),
    entity("ScriptInclude", "required", { evidence: `${FLUENT_OVERVIEW} and ${SDK_EXAMPLES}/script-include-sample` }),
    entity("UiAction", "required", { introduced: "4.8.0", evidence: `${FLUENT_OVERVIEW} and ${SDK_EXAMPLES}/ui-action-sample` }),
    entity("UiPage", "required", { introduced: "4.8.0", evidence: `${FLUENT_OVERVIEW} and ${SDK_EXAMPLES}/ui-page-sample` }),
    entity("UiFormatter", "required"),
    entity("UiPolicy", "required"),
    entity("Flow", "unknown", {
      kind: "automation",
      module: "unknown",
      evidence: `${SDK_EXAMPLES}/flow-sample`,
      evidenceRecords: [{ url: `${SDK_EXAMPLES}/flow-sample`, symbol: "Flow", version: "3.0.0", transition: "current" }],
    }),
    column("BooleanColumn"),
    column("ChoiceColumn"),
    column("ConditionsColumn"),
    column("DateColumn"),
    column("DateTimeColumn"),
    column("DecimalColumn"),
    column("FieldNameColumn"),
    column("HtmlColumn"),
    column("IntegerColumn"),
    column("ListColumn"),
    column("ReferenceColumn"),
    column("ScriptColumn"),
    column("StringColumn"),
    column("TableNameColumn"),
    column("TranslatedFieldColumn"),
    column("TranslatedTextColumn"),
    column("UserRolesColumn"),
  ],
  directives: [
    {
      name: "fluent-ignore",
      placement: "previous-line",
      evidence: FLUENT_OVERVIEW,
      evidenceRecords: [{ url: FLUENT_OVERVIEW, symbol: "fluent-ignore", version: "3.0.0", transition: "current" }],
    },
    {
      name: "fluent-disable-sync",
      placement: "previous-line",
      evidence: FLUENT_OVERVIEW,
      evidenceRecords: [{ url: FLUENT_OVERVIEW, symbol: "fluent-disable-sync", version: "3.0.0", transition: "current" }],
    },
    {
      name: "fluent-disable-sync-for-file",
      placement: "first-line",
      evidence: FLUENT_OVERVIEW,
      evidenceRecords: [{ url: FLUENT_OVERVIEW, symbol: "fluent-disable-sync-for-file", version: "3.0.0", transition: "current" }],
    },
  ],
  typos: {
    "fluent-ignre": "fluent-ignore",
    "fluent-igonre": "fluent-ignore",
    "fluent-ignore-next-line": "fluent-ignore",
    "fluent-ignore-sync": "fluent-disable-sync",
    "fluent-disable": "fluent-disable-sync",
    "fluent-disable-sync-next-line": "fluent-disable-sync",
    "fluent-disable-sync-file": "fluent-disable-sync-for-file",
    "fluent-disable-file": "fluent-disable-sync-for-file",
    "fluent-skip": "fluent-ignore",
    "fluent-nosync": "fluent-disable-sync",
  },
};

export function apisByName(manifest: FluentSdkManifest = DEFAULT_FLUENT_MANIFEST): Map<string, FluentApiCapability> {
  return new Map(manifest.apis.map((api) => [api.name, api]));
}

export function knownDirectiveNames(manifest: FluentSdkManifest = DEFAULT_FLUENT_MANIFEST): ReadonlySet<string> {
  return new Set(manifest.directives.map((directive) => directive.name));
}

export function entitiesRequiringId(manifest: FluentSdkManifest = DEFAULT_FLUENT_MANIFEST): ReadonlySet<string> {
  return new Set(
    manifest.apis.filter((api) => api.kind === "entity" && api.idRequirement === "required").map((api) => api.name),
  );
}

export function importOwnedApis(manifest: FluentSdkManifest = DEFAULT_FLUENT_MANIFEST): ReadonlyMap<string, string> {
  const owned = new Map<string, string>();
  for (const api of manifest.apis) {
    if (api.module !== "unknown") owned.set(api.name, api.module);
  }
  return owned;
}

export const FLUENT_CORE_MODULE = SDK_CORE;
