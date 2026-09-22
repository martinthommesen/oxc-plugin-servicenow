import type {
  JavaScriptMode,
  ScriptAuthoring,
  ScriptKind,
  ScriptSurface,
  SettingsDeprecation,
  ValidatedServiceNowSettings,
} from "../types.js";
import { ServiceNowSettingsError } from "./errors.js";
import { expectEnum, typeName, type SettingsFieldDescriptor } from "./parse.js";

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

export const LEGACY_DESCRIPTOR_FIELDS = {
  scriptType: {
    defaultValue: () => "auto" as const,
    parse(path: string, value: unknown, deprecations: SettingsDeprecation[]) {
      const scriptType = expectEnum(path, value, SCRIPT_TYPE_VALUES) as "auto" | ScriptKind;
      if (scriptType !== "auto") {
        deprecations.push({
          path: "settings.servicenow.scriptType",
          message:
            "`scriptType` is deprecated. Set `authoring` and `surfaces` instead. `scriptType` remains mapped for one major-release cycle.",
        });
      }
      return scriptType;
    },
  } satisfies SettingsFieldDescriptor<"auto" | ScriptKind>,
  ecmaLatest: {
    defaultValue: () => undefined as boolean | undefined,
    parse(path: string, value: unknown, deprecations: SettingsDeprecation[]) {
      if (typeof value !== "boolean") {
        throw new ServiceNowSettingsError(path, `expected a boolean, got ${typeName(value)}`);
      }
      deprecations.push({
        path: "settings.servicenow.ecmaLatest",
        message:
          "`ecmaLatest` is deprecated. Set `javascriptMode` to `es2021`, `es5`, `compatibility`, or `unknown`. `true` maps to `es2021`. `false` does not assume ES5.",
      });
      return value;
    },
  } satisfies SettingsFieldDescriptor<boolean | undefined>,
};

export function checkLegacyConflicts(settings: ValidatedServiceNowSettings): void {
  const { scriptType, ecmaLatest, javascriptMode, authoring, surfaces } = settings;
  if (ecmaLatest === true && javascriptMode !== undefined && javascriptMode !== "es2021") {
    throw new ServiceNowSettingsError(
      ".ecmaLatest",
      `conflicts with javascriptMode ${JSON.stringify(javascriptMode)}. Use javascriptMode only.`,
    );
  }
  if (scriptType === "fluent") {
    if (authoring === "classic") {
      throw new ServiceNowSettingsError(
        ".scriptType",
        'conflicts with authoring "classic". Use authoring only.',
      );
    }
    if (surfaces !== "auto") {
      throw new ServiceNowSettingsError(
        ".scriptType",
        "conflicts with instance execution surfaces. Use authoring only.",
      );
    }
    return;
  }
  // The remaining legacy values that name an execution surface.
  if (scriptType === "auto" || scriptType === "unknown") return;
  if (surfaces !== "auto" && (surfaces.length !== 1 || surfaces[0] !== scriptType)) {
    throw new ServiceNowSettingsError(
      ".scriptType",
      `conflicts with surfaces ${JSON.stringify(surfaces)}. Omit deprecated scriptType and use surfaces only.`,
    );
  }
  if (authoring === "fluent") {
    throw new ServiceNowSettingsError(
      ".scriptType",
      'conflicts with authoring "fluent". Use authoring only.',
    );
  }
}

/**
 * Copy legacy `scriptType` / `ecmaLatest` values onto their modern fields when
 * those are unset, so context resolution reads one shape. Legacy fields keep
 * their raw values for deprecation reporting. Callers must run
 * {@link checkLegacyConflicts} first; conflicting explicit values throw there.
 */
export function normalizeLegacySettings(
  settings: ValidatedServiceNowSettings,
): ValidatedServiceNowSettings {
  const patch: {
    authoring?: ScriptAuthoring | "auto";
    surfaces?: "auto" | ScriptSurface[];
    javascriptMode?: JavaScriptMode | undefined;
  } = {};
  const { scriptType, ecmaLatest } = settings;
  if (scriptType === "fluent") {
    if (settings.authoring === "auto") patch.authoring = "fluent";
  } else if (scriptType !== "auto") {
    if (settings.authoring === "auto") patch.authoring = "classic";
    if (settings.surfaces === "auto" && scriptType !== "unknown") {
      patch.surfaces = [scriptType];
    }
  }
  if (ecmaLatest === true && settings.javascriptMode === undefined) {
    patch.javascriptMode = "es2021";
  }
  return Object.keys(patch).length === 0 ? settings : { ...settings, ...patch };
}
