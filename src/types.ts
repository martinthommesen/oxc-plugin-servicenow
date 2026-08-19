import type { Rule } from "@oxlint/plugins";

/**
 * Shared `settings.servicenow` shape.
 *
 * Configure once in `.oxlintrc.json` / ESLint `settings` and every rule reads it.
 *
 * @example
 * ```json
 * {
 *   "settings": {
 *     "servicenow": {
 *       "allowedSysIds": ["97c04b3b1b12100043ab85e5bd0713e2"],
 *       "allowedTables": ["x_acme_widget"],
 *       "scopePrefix": "x_acme",
 *       "ecmaLatest": false
 *     }
 *   }
 * }
 * ```
 */
export interface ServiceNowSettings {
  /** 32-char sys_ids that are allowed (e.g. well-known global records). */
  allowedSysIds?: string[];
  /** Table names that `no-hardcoded-table-names` should ignore. */
  allowedTables?: string[];
  /**
   * Force a script type. `"auto"` (default) classifies from the filename
   * and source markers (`g_form`, `.now.ts`, …).
   */
  scriptType?: "auto" | "client" | "server" | "business-rule" | "fluent";
  /**
   * When true, skip classic-engine bans (`no-promise`, `no-async-await`,
   * `no-bigint`, …). Use for Fluent server modules with `$meta.useEsLatest`.
   */
  ecmaLatest?: boolean;
  /** Application scope prefix, e.g. `x_acme`. Used by naming rules. */
  scopePrefix?: string;
}

export type ScriptKind =
  | "fluent"
  | "client"
  | "business-rule"
  | "script-include"
  | "server"
  | "unknown";

export type RuleModule = Rule;

export type Severity = "error" | "warn" | "off";

export type RuleConfigMap = Record<string, Severity | [Severity, ...unknown[]]>;
