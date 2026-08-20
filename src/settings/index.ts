import type { Context } from "@oxlint/plugins";
import type { ServiceNowSettings, ValidatedServiceNowSettings } from "../types.js";
import { ServiceNowConfigError } from "./errors.js";
import { validateServiceNowSettings } from "./validate.js";
import type { ValidatedSettingsResult } from "./validate.js";

export { ServiceNowConfigError, ServiceNowSettingsError } from "./errors.js";
export { validateServiceNowSettings, emptyValidatedSettings } from "./validate.js";
export type { ValidatedSettingsResult } from "./validate.js";
export {
  isSupportedServiceNowRelease,
  SUPPORTED_SERVICENOW_RELEASES,
} from "./releases.js";
export type { ServiceNowRelease } from "./releases.js";

const EMPTY: ValidatedSettingsResult = validateServiceNowSettings(undefined);

let memoFilename: string | undefined;
let memoRaw: unknown;
let memoResult: ValidatedSettingsResult | undefined;

function readRawSettings(context: Context): unknown {
  const settings = context.settings as { servicenow?: unknown } | undefined;
  return settings?.servicenow;
}

/**
 * Validate `settings.servicenow` once per file and reuse the result.
 * Throws {@link ServiceNowSettingsError} when configuration is invalid.
 */
export function getValidatedSettingsResult(context: Context): ValidatedSettingsResult {
  const raw = readRawSettings(context);
  const { filename } = context;
  if (filename === memoFilename && raw === memoRaw && memoResult) {
    return memoResult;
  }
  const result = raw === undefined ? EMPTY : validateServiceNowSettings(raw);
  memoFilename = filename;
  memoRaw = raw;
  memoResult = result;
  return result;
}

export function getValidatedSettings(context: Context): ValidatedServiceNowSettings {
  return getValidatedSettingsResult(context).settings;
}

/**
 * @deprecated Prefer {@link getValidatedSettings}. Returns the raw object for
 * callers that have not migrated. Invalid shapes still throw.
 */
export function getSettings(context: Context): ServiceNowSettings {
  return getValidatedSettings(context) as ServiceNowSettings;
}

export function optionAt<T>(context: Context, index: number, fallback: T): T {
  const value = context.options[index];
  return (value as T | undefined) ?? fallback;
}

export function objectOptionAt<T extends object>(
  context: Context,
  index: number,
  allowedKeys: ReadonlySet<string>,
  fallback: T,
): T {
  const value = context.options[index];
  if (value === undefined) return fallback;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ServiceNowConfigError(`options[${index}]`, `expected an object, got ${typeof value}`);
  }
  const rec = value as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (!allowedKeys.has(key)) {
      throw new ServiceNowConfigError(`options[${index}].${key}`, "unknown option");
    }
  }
  return value as T;
}
