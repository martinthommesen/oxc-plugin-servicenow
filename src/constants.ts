import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FLUENT_MANIFEST,
  FLUENT_CORE_MODULE as MANIFEST_CORE_MODULE,
  entitiesRequiringId,
} from "./fluent/manifest.js";

/** Canonical plugin name used in rule ids (`servicenow/<rule>`). */
export const PLUGIN_NAME = "servicenow";

export const PACKAGE_NAME = "oxc-plugin-servicenow";

function readPackageVersion(): string {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
  ) as {
    version: string;
  };
  return manifest.version;
}

/** Derived from `package.json` at load time so the export cannot drift. */
export const PACKAGE_VERSION = readPackageVersion();

export const DOCS_BASE_URL =
  "https://github.com/martinthommesen/oxc-plugin-servicenow/blob/main/docs/rules";

export function ruleDocsUrl(ruleName: string): string {
  return `${DOCS_BASE_URL}/${ruleName}.md`;
}

/**
 * Fluent entity factories imported from `@servicenow/sdk/core`.
 * Derived from the versioned SDK manifest.
 */
export const FLUENT_CORE_APIS = DEFAULT_FLUENT_MANIFEST.apis
  .filter((api) => api.kind === "entity" && api.module === MANIFEST_CORE_MODULE)
  .map((api) => api.name);

export type FluentCoreApi = (typeof FLUENT_CORE_APIS)[number];

export const FLUENT_CORE_API_SET: ReadonlySet<string> = new Set(FLUENT_CORE_APIS);

/** Column helpers that also come from `@servicenow/sdk/core`. */
export const FLUENT_COLUMN_APIS = DEFAULT_FLUENT_MANIFEST.apis
  .filter((api) => api.kind === "column")
  .map((api) => api.name);

export const FLUENT_IMPORT_SET: ReadonlySet<string> = new Set(
  DEFAULT_FLUENT_MANIFEST.apis.filter((api) => api.module !== "unknown").map((api) => api.name),
);

export const FLUENT_CORE_MODULE = MANIFEST_CORE_MODULE;

/**
 * Fluent factories that must declare `$id` (Tables use `name` instead).
 */
export const FLUENT_ENTITIES_REQUIRING_ID: ReadonlySet<string> = entitiesRequiringId();

export const KNOWN_FLUENT_DIRECTIVES = DEFAULT_FLUENT_MANIFEST.directives.map(
  (directive) => directive.name,
);

export const FLUENT_DIRECTIVE_TYPOS: Record<string, string> = {
  ...DEFAULT_FLUENT_MANIFEST.typos,
};

/** Properties that typically hold large script / markup payloads in Fluent. */
export const FLUENT_LARGE_CONTENT_KEYS: ReadonlySet<string> = new Set([
  "script",
  "client_script",
  "clientScript",
  "processing_script",
  "processingScript",
  "css",
  "html",
  "xml",
  "template",
  "render",
]);

export const GLIDE_MUTATING_METHODS = [
  "insert",
  "update",
  "updateMultiple",
  "deleteRecord",
  "deleteMultiple",
  "get",
  "next",
] as const;

export const PROMISE_STATIC_METHODS = [
  "all",
  "allSettled",
  "any",
  "race",
  "reject",
  "resolve",
  "try",
  "withResolvers",
] as const;

export const TYPED_ARRAY_CTORS = [
  "Int8Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int16Array",
  "Uint16Array",
  "Int32Array",
  "Uint32Array",
  "Float32Array",
  "Float64Array",
  "BigInt64Array",
  "BigUint64Array",
  "DataView",
] as const;

/**
 * Common ServiceNow tables. Used by `no-hardcoded-table-names` when
 * `allowBuiltins` is enabled.
 */
export const BUILTIN_TABLES: ReadonlySet<string> = new Set([
  "sys_user",
  "sys_user_group",
  "sys_user_role",
  "sys_user_has_role",
  "sys_group_has_role",
  "sys_properties",
  "sys_script",
  "sys_script_include",
  "sys_script_client",
  "sys_ui_policy",
  "sys_ui_action",
  "sys_ui_page",
  "sys_security_acl",
  "sys_dictionary",
  "sys_db_object",
  "sys_choice",
  "sys_attachment",
  "sys_email",
  "sys_journal_field",
  "sys_audit",
  "task",
  "incident",
  "problem",
  "change_request",
  "change_task",
  "sc_request",
  "sc_req_item",
  "sc_task",
  "kb_knowledge",
  "cmdb_ci",
  "cmdb_rel_ci",
  "ast_contract",
  "sysapproval_approver",
]);

/** Client-side globals that only exist in browser scripts. Safe classification evidence. */
export const CLIENT_GLOBALS_STRONG = [
  "g_form",
  "g_user",
  "g_list",
  "g_navigation",
  "g_tabs2Sections",
] as const;

/** Ambiguous globals: g_scratchpad is written by server-side display Business Rules; gel is short enough to collide. Never used for classification. */
export const CLIENT_GLOBALS_WEAK = ["g_scratchpad", "gel"] as const;

export const CLIENT_GLOBALS = [...CLIENT_GLOBALS_STRONG, ...CLIENT_GLOBALS_WEAK] as const;

/** Constructors that produce a GlideRecord-like cursor. */
export const GLIDE_RECORD_CTORS = ["GlideRecord", "GlideRecordSecure"] as const;
