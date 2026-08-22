import type { Context } from "@oxlint/plugins";
import type { ServiceNowSettings, ValidatedServiceNowSettings } from "../types.js";
import { structuralFingerprint, validateServiceNowSettings } from "./validate.js";
import type { ValidatedSettingsResult } from "./validate.js";

export { ServiceNowConfigError, ServiceNowSettingsError } from "./errors.js";
export { validateServiceNowSettings, emptyValidatedSettings } from "./validate.js";
export type { ValidatedSettingsResult } from "./validate.js";
export { isSupportedServiceNowRelease, SUPPORTED_SERVICENOW_RELEASES } from "./releases.js";
export type { ServiceNowRelease } from "./releases.js";

const EMPTY: ValidatedSettingsResult = validateServiceNowSettings(undefined);

const memo = new WeakMap<object, { snapshot: string; result: ValidatedSettingsResult }>();

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
  if (raw === undefined) return EMPTY;
  if (!raw || typeof raw !== "object") return validateServiceNowSettings(raw);
  const snapshot = structuralFingerprint(raw);
  const cached = snapshot === undefined ? undefined : memo.get(raw);
  if (cached && cached.snapshot === snapshot) return cached.result;
  const result = validateServiceNowSettings(raw);
  if (snapshot !== undefined) memo.set(raw, { snapshot, result });
  return result;
}

/** Stable structural fingerprint used by validation and file-analysis caches. */
export function fingerprintServiceNowSettings(value: object): string {
  return structuralFingerprint(value) ?? "unavailable";
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
