import type {
  ApplicationScope,
  BusinessRuleSourceFormat,
  BusinessRuleWhen,
  JavaScriptMode,
  ScriptAuthoring,
  ScriptSurface,
  ServiceNowSettings,
  SettingsDeprecation,
  ValidatedServiceNowSettings,
} from "../types.js";
import { resolveFluentManifest } from "../fluent/registry.js";
import { isSupportedServiceNowRelease, SUPPORTED_SERVICENOW_RELEASES } from "./releases.js";
import { ServiceNowSettingsError } from "./errors.js";
import { expectEnum, typeName } from "./parse.js";
import { deepFreeze } from "./freeze.js";
import { immutableSet } from "../utils/immutable.js";
import { SURFACE_VALUES } from "../surfaces.js";
import {
  checkLegacyConflicts,
  LEGACY_DESCRIPTOR_FIELDS,
  normalizeLegacySettings,
} from "./legacy.js";

const JAVASCRIPT_MODES = new Set<JavaScriptMode>(["compatibility", "es5", "es2021", "unknown"]);

const AUTHORING_VALUES = new Set<ScriptAuthoring | "auto">(["auto", "classic", "fluent"]);

const SURFACES = new Set<ScriptSurface>(SURFACE_VALUES);

const SCOPES = new Set<ApplicationScope>(["global", "scoped", "unknown"]);

const BR_FORMATS = new Set<BusinessRuleSourceFormat>(["full-script", "body-only", "unknown"]);

const BR_WHEN = new Set<BusinessRuleWhen>(["before", "after", "async", "display", "unknown"]);

const SCOPE_PREFIX = /^[a-z][a-z0-9_]*$/;
const SDK_VERSION = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/;
const SYS_ID = /^[0-9a-f]{32}$/;
const TABLE_NAME = /^[a-z][a-z0-9_]*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function structuralFingerprint(value: object): string | undefined {
  try {
    const seen = new WeakMap<object, number>();
    let nextReference = 0;
    function visit(item: unknown): string {
      if (item === null) return "null";
      if (typeof item !== "object") return `${typeof item}:${String(item)}`;
      const prior = seen.get(item);
      if (prior !== undefined) return `ref:${prior}`;
      seen.set(item, nextReference);
      nextReference += 1;
      if (Array.isArray(item)) return `array:[${item.map(visit).join(",")}]`;
      return `object:{${Object.keys(item)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${visit((item as Record<string, unknown>)[key])}`)
        .join(",")}}`;
    }
    return visit(value);
  } catch {
    return undefined;
  }
}

function expectStringArray(path: string, value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new ServiceNowSettingsError(path, `expected an array of strings, got ${typeName(value)}`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new ServiceNowSettingsError(
        `${path}[${index}]`,
        `expected a string, got ${typeName(item)}`,
      );
    }
    return item;
  });
}

function expectPatternArray(
  path: string,
  value: unknown,
  pattern: RegExp,
  expected: string,
): string[] {
  const items = expectStringArray(path, value);
  for (const [index, item] of items.entries()) {
    if (!pattern.test(item)) {
      throw new ServiceNowSettingsError(`${path}[${index}]`, expected);
    }
  }
  return items;
}

export interface SettingsFieldDescriptor<T> {
  readonly defaultValue: () => T;
  readonly parse: (path: string, value: unknown, deprecations: SettingsDeprecation[]) => T;
}

type ParsedSettings<D extends Record<string, SettingsFieldDescriptor<unknown>>> = {
  [K in keyof D]: D[K] extends SettingsFieldDescriptor<infer T> ? T : never;
};

export function deriveSettingsDescriptorProducts<
  const D extends Record<string, SettingsFieldDescriptor<unknown>>,
>(descriptor: D) {
  const keys = immutableSet(Object.keys(descriptor));
  function defaults(): ParsedSettings<D> {
    return Object.fromEntries(
      Object.entries(descriptor).map(([key, field]) => [key, field.defaultValue()]),
    ) as ParsedSettings<D>;
  }
  function parse(
    raw: Record<string, unknown>,
    deprecations: SettingsDeprecation[],
  ): ParsedSettings<D> {
    const values = defaults();
    for (const [key, field] of Object.entries(descriptor)) {
      if (raw[key] !== undefined) {
        (values as Record<string, unknown>)[key] = field.parse(`.${key}`, raw[key], deprecations);
      }
    }
    return values;
  }
  function validate(
    raw: Record<string, unknown>,
    deprecations: SettingsDeprecation[] = [],
  ): ParsedSettings<D> {
    return deepFreeze(parse(raw, deprecations));
  }
  function fingerprint(value: ParsedSettings<D>): string {
    return structuralFingerprint(value) ?? "unavailable";
  }
  return Object.freeze({ keys, defaults, parse, validate, fingerprint });
}

const SETTINGS_DESCRIPTOR = {
  allowedSysIds: {
    defaultValue: () => [] as string[],
    parse: (path: string, value: unknown) =>
      expectPatternArray(
        path,
        value,
        SYS_ID,
        "expected a 32-character lowercase hexadecimal sys_id",
      ),
  },
  allowedTables: {
    defaultValue: () => [] as string[],
    parse: (path: string, value: unknown) =>
      expectPatternArray(path, value, TABLE_NAME, "expected a lowercase ServiceNow table name"),
  },
  ...LEGACY_DESCRIPTOR_FIELDS,
  javascriptMode: {
    defaultValue: () => undefined as JavaScriptMode | undefined,
    parse: (path: string, value: unknown) => expectEnum(path, value, JAVASCRIPT_MODES),
  },
  authoring: {
    defaultValue: () => "auto" as const,
    parse: (path: string, value: unknown) => expectEnum(path, value, AUTHORING_VALUES),
  },
  surfaces: {
    defaultValue: (): "auto" | ScriptSurface[] => "auto",
    parse(path: string, value: unknown) {
      if (value === "auto") return "auto" as const;
      if (!Array.isArray(value)) {
        throw new ServiceNowSettingsError(
          path,
          `expected "auto" or an array of surfaces, got ${typeName(value)}`,
        );
      }
      const surfaces = value.map((item, index) => expectEnum(`${path}[${index}]`, item, SURFACES));
      if (surfaces.length === 0) {
        throw new ServiceNowSettingsError(
          path,
          'expected a non-empty array. Omit the setting or use "auto" when the surface is unknown.',
        );
      }
      if (new Set(surfaces).size !== surfaces.length) {
        throw new ServiceNowSettingsError(path, "duplicate surface values");
      }
      return surfaces;
    },
  },
  scope: {
    defaultValue: () => "unknown" as const,
    parse: (path: string, value: unknown) => expectEnum(path, value, SCOPES),
  },
  scopePrefix: {
    defaultValue: () => undefined as string | undefined,
    parse(path: string, value: unknown) {
      if (typeof value !== "string" || !SCOPE_PREFIX.test(value)) {
        throw new ServiceNowSettingsError(
          path,
          "expected a lowercase application scope prefix such as x_acme",
        );
      }
      return value;
    },
  },
  release: {
    defaultValue: () => undefined as ValidatedServiceNowSettings["release"],
    parse(path: string, value: unknown) {
      if (typeof value !== "string" || !isSupportedServiceNowRelease(value)) {
        throw new ServiceNowSettingsError(
          path,
          `expected one of ${SUPPORTED_SERVICENOW_RELEASES.join(", ")}, got ${JSON.stringify(value)}`,
        );
      }
      return value;
    },
  },
  businessRuleSourceFormat: {
    defaultValue: () => "unknown" as const,
    parse: (path: string, value: unknown) => expectEnum(path, value, BR_FORMATS),
  },
  businessRuleWhen: {
    defaultValue: () => "unknown" as const,
    parse: (path: string, value: unknown) => expectEnum(path, value, BR_WHEN),
  },
  fluentSdkVersion: {
    defaultValue: () => undefined as string | undefined,
    parse(path: string, value: unknown) {
      if (typeof value !== "string" || !SDK_VERSION.test(value)) {
        throw new ServiceNowSettingsError(path, "expected a semver string such as 4.1.0");
      }
      resolveFluentManifest(value);
      return value;
    },
  },
} satisfies {
  [K in keyof ValidatedServiceNowSettings]: SettingsFieldDescriptor<ValidatedServiceNowSettings[K]>;
};

const SETTINGS_PRODUCTS = deriveSettingsDescriptorProducts(SETTINGS_DESCRIPTOR);

export interface ValidatedSettingsResult {
  readonly settings: ValidatedServiceNowSettings;
  readonly deprecations: readonly SettingsDeprecation[];
}

/**
 * Validate and normalize `settings.servicenow`.
 * Throws {@link ServiceNowSettingsError} for unknown keys, wrong types, or conflicts.
 */
const EMPTY_SETTINGS: ValidatedServiceNowSettings = deepFreeze(
  SETTINGS_PRODUCTS.validate({}) as ValidatedServiceNowSettings,
);

const EMPTY_RESULT: ValidatedSettingsResult = deepFreeze({
  settings: EMPTY_SETTINGS,
  deprecations: [],
});

export function validateServiceNowSettings(raw: unknown): ValidatedSettingsResult {
  if (raw === undefined) {
    return EMPTY_RESULT;
  }
  if (!isPlainObject(raw)) {
    throw new ServiceNowSettingsError("", `expected an object, got ${typeName(raw)}`);
  }

  for (const key of Object.keys(raw)) {
    if (!SETTINGS_PRODUCTS.keys.has(key)) {
      throw new ServiceNowSettingsError(`.${key}`, "unknown setting");
    }
  }

  const deprecations: SettingsDeprecation[] = [];
  const parsed = SETTINGS_PRODUCTS.validate(raw, deprecations) as ValidatedServiceNowSettings;
  checkLegacyConflicts(parsed);
  const settings = normalizeLegacySettings(parsed);
  const { authoring, surfaces } = settings;

  if (authoring === "fluent" && surfaces !== "auto" && surfaces.length > 0) {
    throw new ServiceNowSettingsError(
      ".surfaces",
      "Fluent authoring cannot list instance execution surfaces",
    );
  }

  return deepFreeze({
    settings,
    deprecations,
  });
}

export function emptyValidatedSettings(): ValidatedServiceNowSettings {
  return EMPTY_SETTINGS;
}

export type { ServiceNowSettings };
