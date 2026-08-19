import type { Rule } from "@oxlint/plugins";

/**
 * JavaScript runtime mode for instance-executed ServiceNow scripts.
 *
 * Unknown means the plugin does not know the mode and must not assume ES5.
 *
 * @see https://www.servicenow.com/docs/r/xanadu/api-reference/scripts/c_JS_modes.html
 */
export type JavaScriptMode = "compatibility" | "es5" | "es2021" | "unknown";

/** Whether the file is classic instance script or Fluent build metadata. */
export type ScriptAuthoring = "classic" | "fluent";

/**
 * Execution surfaces that can apply to one file at the same time.
 * A UI Action may be client, server, or both.
 */
export type ScriptSurface =
  | "client"
  | "server"
  | "business-rule"
  | "script-include"
  | "ui-action"
  | "scheduled-script"
  | "fix-script";

export type ApplicationScope = "global" | "scoped" | "unknown";

export type ContextConfidence = "explicit" | "filename" | "inferred" | "unknown";

export type BusinessRuleSourceFormat = "full-script" | "body-only" | "unknown";

/**
 * How the plugin classified one context dimension.
 * `unknown` means no evidence was found.
 */
export interface ContextSourceMap {
  authoring: ContextConfidence;
  surfaces: ContextConfidence;
  javascriptMode: ContextConfidence;
  scope: ContextConfidence;
}

/**
 * Per-file ServiceNow execution context.
 *
 * Authoring form, surfaces, JavaScript mode, and scope are independent.
 */
export interface ServiceNowScriptContext {
  authoring: ScriptAuthoring;
  surfaces: ReadonlySet<ScriptSurface>;
  javascriptMode: JavaScriptMode;
  scope: ApplicationScope;
  confidence: ContextConfidence;
  sources: ContextSourceMap;
  businessRuleSourceFormat: BusinessRuleSourceFormat;
  settings: ValidatedServiceNowSettings;
  deprecations: readonly SettingsDeprecation[];
}

export interface SettingsDeprecation {
  path: string;
  message: string;
}

/**
 * Shared `settings.servicenow` shape.
 *
 * Configure once in `.oxlintrc.json` / ESLint `settings`.
 *
 * @example
 * ```json
 * {
 *   "settings": {
 *     "servicenow": {
 *       "javascriptMode": "es2021",
 *       "surfaces": ["business-rule"],
 *       "scope": "scoped",
 *       "scopePrefix": "x_acme",
 *       "allowedSysIds": ["97c04b3b1b12100043ab85e5bd0713e2"]
 *     }
 *   }
 * }
 * ```
 */
export interface ServiceNowSettings {
  /** 32-char sys_ids that are allowed (for example well-known global records). */
  allowedSysIds?: string[];
  /** Table names that `no-hardcoded-table-names` should ignore. */
  allowedTables?: string[];
  /**
   * @deprecated Use `authoring` and `surfaces`. Kept for one major-release cycle.
   *
   * `"auto"` (default) classifies from the filename and conservative markers.
   */
  scriptType?: "auto" | ScriptKind;
  /**
   * @deprecated Use `javascriptMode`. `true` maps to `javascriptMode: "es2021"`.
   * `false` does not assume ES5.
   */
  ecmaLatest?: boolean;
  /** Instance JavaScript mode. Defaults to `unknown`. */
  javascriptMode?: JavaScriptMode;
  /** Authoring form. Defaults to filename detection, then classic. */
  authoring?: ScriptAuthoring | "auto";
  /**
   * Execution surfaces. `"auto"` (default) uses filename conventions, then
   * conservative inference. A UI Action can list `ui-action` plus `client`
   * and/or `server`.
   */
  surfaces?: "auto" | ScriptSurface[];
  /** Application scope. Defaults to `unknown`. */
  scope?: ApplicationScope;
  /** Application scope prefix, for example `x_acme`. Used by naming rules. */
  scopePrefix?: string;
  /** ServiceNow release identifier used for versioned knowledge, for example `zurich`. */
  release?: string;
  /** How Business Rule source is stored when that is known. */
  businessRuleSourceFormat?: BusinessRuleSourceFormat;
  /** Fluent SDK version the manifest should evaluate, for example `4.1.0`. */
  fluentSdkVersion?: string;
}

/**
 * Normalized settings after runtime validation.
 * Deprecated fields are preserved so migration docs can mention them.
 */
export interface ValidatedServiceNowSettings {
  allowedSysIds: readonly string[];
  allowedTables: readonly string[];
  scriptType: "auto" | ScriptKind;
  ecmaLatest: boolean | undefined;
  javascriptMode: JavaScriptMode | undefined;
  authoring: ScriptAuthoring | "auto";
  surfaces: "auto" | readonly ScriptSurface[];
  scope: ApplicationScope;
  scopePrefix: string | undefined;
  release: string | undefined;
  businessRuleSourceFormat: BusinessRuleSourceFormat;
  fluentSdkVersion: string | undefined;
}

/**
 * @deprecated Use `ServiceNowScriptContext` surfaces and authoring.
 * Retained so existing configs that set `scriptType` keep working.
 */
export type ScriptKind =
  | "fluent"
  | "client"
  | "business-rule"
  | "script-include"
  | "server"
  | "ui-action"
  | "unknown";

export type RuleModule = Rule;

export type Severity = "error" | "warn" | "off";

export type RuleConfigMap = Record<string, Severity | [Severity, ...unknown[]]>;
