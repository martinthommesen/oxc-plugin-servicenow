import type {
  ApplicationScope,
  BusinessRuleSourceFormat,
  BusinessRuleWhen,
  JavaScriptMode,
  ScriptAuthoring,
  ScriptKind,
  ScriptSurface,
  ServiceNowSettings,
  SettingsDeprecation,
  ValidatedServiceNowSettings,
} from "../types.js";
import { ServiceNowSettingsError } from "./errors.js";

const SCRIPT_KINDS = new Set<ScriptKind>([
  "fluent",
  "client",
  "business-rule",
  "script-include",
  "server",
  "ui-action",
  "unknown",
]);

const SCRIPT_TYPE_VALUES = new Set<string>(["auto", ...SCRIPT_KINDS]);

const JAVASCRIPT_MODES = new Set<JavaScriptMode>(["compatibility", "es5", "es2021", "unknown"]);

const AUTHORING_VALUES = new Set<ScriptAuthoring | "auto">(["auto", "classic", "fluent"]);

const SURFACES = new Set<ScriptSurface>([
  "client",
  "server",
  "business-rule",
  "script-include",
  "ui-action",
  "scheduled-script",
  "fix-script",
]);

const SCOPES = new Set<ApplicationScope>(["global", "scoped", "unknown"]);

const BR_FORMATS = new Set<BusinessRuleSourceFormat>(["full-script", "body-only", "unknown"]);

const BR_WHEN = new Set<BusinessRuleWhen>(["before", "after", "async", "display", "unknown"]);

const ALLOWED_KEYS = new Set([
  "allowedSysIds",
  "allowedTables",
  "scriptType",
  "ecmaLatest",
  "javascriptMode",
  "authoring",
  "surfaces",
  "scope",
  "scopePrefix",
  "release",
  "businessRuleSourceFormat",
  "businessRuleWhen",
  "fluentSdkVersion",
]);

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SCOPE_PREFIX = /^[a-z][a-z0-9_]*$/;
const RELEASE = /^[a-z][a-z0-9._-]*$/;
const SDK_VERSION = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/;
const SYS_ID = /^[0-9a-f]{32}$/;
const TABLE_NAME = /^[a-z][a-z0-9_]*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function expectStringArray(path: string, value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new ServiceNowSettingsError(path, `expected an array of strings, got ${typeName(value)}`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new ServiceNowSettingsError(`${path}[${index}]`, `expected a string, got ${typeName(item)}`);
    }
    return item;
  });
}

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function expectEnum<T extends string>(path: string, value: unknown, allowed: ReadonlySet<T>): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new ServiceNowSettingsError(
      path,
      `expected one of ${[...allowed].join(", ")}, got ${JSON.stringify(value)}`,
    );
  }
  return value as T;
}

export interface ValidatedSettingsResult {
  settings: ValidatedServiceNowSettings;
  deprecations: SettingsDeprecation[];
}

/**
 * Validate and normalize `settings.servicenow`.
 * Throws {@link ServiceNowSettingsError} for unknown keys, wrong types, or conflicts.
 */
export function validateServiceNowSettings(raw: unknown): ValidatedSettingsResult {
  if (raw === undefined) {
    return { settings: emptyValidatedSettings(), deprecations: [] };
  }
  if (!isPlainObject(raw)) {
    throw new ServiceNowSettingsError("", `expected an object, got ${typeName(raw)}`);
  }

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new ServiceNowSettingsError(`.${key}`, "unknown setting");
    }
  }

  const deprecations: SettingsDeprecation[] = [];
  const allowedSysIds = raw.allowedSysIds === undefined ? [] : expectStringArray(".allowedSysIds", raw.allowedSysIds);
  for (const [index, id] of allowedSysIds.entries()) {
    if (!SYS_ID.test(id)) {
      throw new ServiceNowSettingsError(
        `.allowedSysIds[${index}]`,
        "expected a 32-character lowercase hexadecimal sys_id",
      );
    }
  }

  const allowedTables =
    raw.allowedTables === undefined ? [] : expectStringArray(".allowedTables", raw.allowedTables);
  for (const [index, table] of allowedTables.entries()) {
    if (!TABLE_NAME.test(table)) {
      throw new ServiceNowSettingsError(`.allowedTables[${index}]`, "expected a lowercase ServiceNow table name");
    }
  }

  let scriptType: "auto" | ScriptKind = "auto";
  if (raw.scriptType !== undefined) {
    scriptType = expectEnum(".scriptType", raw.scriptType, SCRIPT_TYPE_VALUES) as "auto" | ScriptKind;
    if (scriptType !== "auto") {
      deprecations.push({
        path: "settings.servicenow.scriptType",
        message:
          "`scriptType` is deprecated. Set `authoring` and `surfaces` instead. `scriptType` remains mapped for one major-release cycle.",
      });
    }
  }

  let ecmaLatest: boolean | undefined;
  if (raw.ecmaLatest !== undefined) {
    if (typeof raw.ecmaLatest !== "boolean") {
      throw new ServiceNowSettingsError(".ecmaLatest", `expected a boolean, got ${typeName(raw.ecmaLatest)}`);
    }
    ecmaLatest = raw.ecmaLatest;
    deprecations.push({
      path: "settings.servicenow.ecmaLatest",
      message:
        "`ecmaLatest` is deprecated. Set `javascriptMode` to `es2021`, `es5`, `compatibility`, or `unknown`. `true` maps to `es2021`. `false` does not assume ES5.",
    });
  }

  let javascriptMode: JavaScriptMode | undefined;
  if (raw.javascriptMode !== undefined) {
    javascriptMode = expectEnum(".javascriptMode", raw.javascriptMode, JAVASCRIPT_MODES);
  }

  if (ecmaLatest === true && javascriptMode !== undefined && javascriptMode !== "es2021") {
    throw new ServiceNowSettingsError(
      ".ecmaLatest",
      `conflicts with javascriptMode ${JSON.stringify(javascriptMode)}. Use javascriptMode only.`,
    );
  }

  const authoring =
    raw.authoring === undefined
      ? "auto"
      : expectEnum(".authoring", raw.authoring, AUTHORING_VALUES);

  let surfaces: "auto" | ScriptSurface[] = "auto";
  if (raw.surfaces !== undefined) {
    if (raw.surfaces === "auto") {
      surfaces = "auto";
    } else if (Array.isArray(raw.surfaces)) {
      surfaces = raw.surfaces.map((item, index) =>
        expectEnum(`.surfaces[${index}]`, item, SURFACES),
      );
      if (new Set(surfaces).size !== surfaces.length) {
        throw new ServiceNowSettingsError(".surfaces", "duplicate surface values");
      }
    } else {
      throw new ServiceNowSettingsError(
        ".surfaces",
        `expected "auto" or an array of surfaces, got ${typeName(raw.surfaces)}`,
      );
    }
  }

  if (scriptType !== "auto" && scriptType !== "unknown" && scriptType !== "fluent") {
    if (surfaces !== "auto" && !surfaces.includes(scriptType)) {
      throw new ServiceNowSettingsError(
        ".scriptType",
        `conflicts with surfaces ${JSON.stringify(surfaces)}. Use surfaces only.`,
      );
    }
  }

  if (scriptType === "fluent" && authoring === "classic") {
    throw new ServiceNowSettingsError(".scriptType", 'conflicts with authoring "classic". Use authoring only.');
  }

  const scope = raw.scope === undefined ? "unknown" : expectEnum(".scope", raw.scope, SCOPES);

  let scopePrefix: string | undefined;
  if (raw.scopePrefix !== undefined) {
    if (typeof raw.scopePrefix !== "string" || !SCOPE_PREFIX.test(raw.scopePrefix)) {
      throw new ServiceNowSettingsError(
        ".scopePrefix",
        "expected a lowercase application scope prefix such as x_acme",
      );
    }
    scopePrefix = raw.scopePrefix;
  }

  let release: string | undefined;
  if (raw.release !== undefined) {
    if (typeof raw.release !== "string" || !RELEASE.test(raw.release)) {
      throw new ServiceNowSettingsError(".release", "expected a lowercase ServiceNow release identifier");
    }
    release = raw.release;
  }

  const businessRuleSourceFormat =
    raw.businessRuleSourceFormat === undefined
      ? "unknown"
      : expectEnum(".businessRuleSourceFormat", raw.businessRuleSourceFormat, BR_FORMATS);

  const businessRuleWhen =
    raw.businessRuleWhen === undefined
      ? "unknown"
      : expectEnum(".businessRuleWhen", raw.businessRuleWhen, BR_WHEN);

  let fluentSdkVersion: string | undefined;
  if (raw.fluentSdkVersion !== undefined) {
    if (typeof raw.fluentSdkVersion !== "string" || !SDK_VERSION.test(raw.fluentSdkVersion)) {
      throw new ServiceNowSettingsError(".fluentSdkVersion", "expected a semver string such as 4.1.0");
    }
    fluentSdkVersion = raw.fluentSdkVersion;
  }

  return {
    settings: {
      allowedSysIds,
      allowedTables,
      scriptType,
      ecmaLatest,
      javascriptMode,
      authoring,
      surfaces,
      scope,
      scopePrefix,
      release,
      businessRuleSourceFormat,
      businessRuleWhen,
      fluentSdkVersion,
    },
    deprecations,
  };
}

export function emptyValidatedSettings(): ValidatedServiceNowSettings {
  return {
    allowedSysIds: [],
    allowedTables: [],
    scriptType: "auto",
    ecmaLatest: undefined,
    javascriptMode: undefined,
    authoring: "auto",
    surfaces: "auto",
    scope: "unknown",
    scopePrefix: undefined,
    release: undefined,
    businessRuleSourceFormat: "unknown",
    businessRuleWhen: "unknown",
    fluentSdkVersion: undefined,
  };
}

export function isIdentifierLike(value: string): boolean {
  return IDENTIFIER.test(value);
}

export type { ServiceNowSettings };
