/** Canonical plugin name used in rule ids (`servicenow/<rule>`). */
export const PLUGIN_NAME = "servicenow";

export const PACKAGE_NAME = "oxc-plugin-servicenow";

export const PACKAGE_VERSION = "1.1.0";

export const DOCS_BASE_URL =
  "https://github.com/martinthommesen/oxc-plugin-servicenow/blob/main/docs/rules";

export function ruleDocsUrl(ruleName: string): string {
  return `${DOCS_BASE_URL}/${ruleName}.md`;
}

/**
 * Fluent entity factories imported from `@servicenow/sdk/core`.
 * Keep in sync with the ServiceNow SDK Fluent API surface.
 */
export const FLUENT_CORE_APIS = [
  "Acl",
  "AliasTemplate",
  "ApplicationMenu",
  "BusinessRule",
  "CatalogClientScript",
  "CatalogItem",
  "CatalogItemRecordProducer",
  "ClientScript",
  "CrossScopePrivilege",
  "DatabaseIndex",
  "InboundEmailAction",
  "Module",
  "Property",
  "Record",
  "RestApi",
  "Role",
  "ScheduledScript",
  "ScriptAction",
  "ScriptedRestApi",
  "ScriptInclude",
  "SPMenu",
  "SPWidget",
  "StateModel",
  "Table",
  "UiAction",
  "UiFormatter",
  "UiPage",
  "UiPolicy",
] as const;

export type FluentCoreApi = (typeof FLUENT_CORE_APIS)[number];

export const FLUENT_CORE_API_SET: ReadonlySet<string> = new Set(FLUENT_CORE_APIS);

/** Column helpers that also come from `@servicenow/sdk/core`. */
export const FLUENT_COLUMN_APIS = [
  "BooleanColumn",
  "ChoiceColumn",
  "ConditionsColumn",
  "DateColumn",
  "DateTimeColumn",
  "DecimalColumn",
  "FieldNameColumn",
  "HtmlColumn",
  "IntegerColumn",
  "ListColumn",
  "ReferenceColumn",
  "ScriptColumn",
  "StringColumn",
  "TableNameColumn",
  "TranslatedFieldColumn",
  "TranslatedTextColumn",
  "UserRolesColumn",
] as const;

export const FLUENT_IMPORT_SET: ReadonlySet<string> = new Set([
  ...FLUENT_CORE_APIS,
  ...FLUENT_COLUMN_APIS,
]);

export const FLUENT_CORE_MODULE = "@servicenow/sdk/core";

/**
 * Fluent factories that must declare `$id` (Tables use `name` instead).
 */
export const FLUENT_ENTITIES_REQUIRING_ID: ReadonlySet<string> = new Set([
  "Acl",
  "AliasTemplate",
  "ApplicationMenu",
  "BusinessRule",
  "CatalogClientScript",
  "CatalogItem",
  "CatalogItemRecordProducer",
  "ClientScript",
  "CrossScopePrivilege",
  "InboundEmailAction",
  "Module",
  "Property",
  "Record",
  "RestApi",
  "Role",
  "ScheduledScript",
  "ScriptAction",
  "ScriptedRestApi",
  "ScriptInclude",
  "SPMenu",
  "SPWidget",
  "StateModel",
  "UiAction",
  "UiFormatter",
  "UiPage",
  "UiPolicy",
]);

export const KNOWN_FLUENT_DIRECTIVES = [
  "fluent-ignore",
  "fluent-disable-sync",
] as const;

export const FLUENT_DIRECTIVE_TYPOS: Record<string, string> = {
  "fluent-ignre": "fluent-ignore",
  "fluent-igonre": "fluent-ignore",
  "fluent-ignore-next-line": "fluent-ignore",
  "fluent-ignore-sync": "fluent-disable-sync",
  "fluent-disable": "fluent-disable-sync",
  "fluent-disable-sync-next-line": "fluent-disable-sync",
  "fluent-skip": "fluent-ignore",
  "fluent-nosync": "fluent-disable-sync",
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
