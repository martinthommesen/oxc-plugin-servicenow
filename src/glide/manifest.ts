/**
 * Versioned ServiceNow GlideRecord API capability table.
 *
 * Method names and roles come from the scoped GlideRecord reference for the
 * Zurich documentation set. Do not match a method only because its name
 * starts with `addSystem`.
 *
 * Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
 */

export const GLIDE_API_RELEASE = "zurich";

export const GLIDE_SCOPED_RECORD_EVIDENCE =
  "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html";

export type GlideMethodRole =
  | "filter"
  | "shape"
  | "acl-bypass"
  | "executor"
  | "consumer"
  | "bulk"
  | "value-extractor"
  | "neutral";

export interface GlideMethodCapability {
  name: string;
  roles: readonly GlideMethodRole[];
  evidence: string;
}

function method(name: string, roles: readonly GlideMethodRole[]): GlideMethodCapability {
  return { name, roles, evidence: GLIDE_SCOPED_RECORD_EVIDENCE };
}

/**
 * Documented scoped GlideRecord methods used by conservative query analysis.
 *
 * `addOrCondition` belongs to `GlideQueryCondition`, not GlideRecord.
 * `addInactiveQuery` and `addNotExistsQuery` are not on this Zurich page.
 * `getAsync` is not listed on this page, so Phase 3 executors omit it.
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
  method("next", ["consumer"]),
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

export const GLIDE_BULK_METHODS = namesWithRole("bulk");

export const GLIDE_VALUE_EXTRACTORS = namesWithRole("value-extractor");

/** Every method name in the versioned table, including neutrals. */
export const GLIDE_KNOWN_METHODS = new Set(GLIDE_RECORD_METHODS.map((entry) => entry.name));
