import type { Context } from "@oxlint/plugins";
import type { ValidatedServiceNowSettings } from "../types.js";
import {
  settingsFingerprint,
  structuralFingerprint,
  validateServiceNowSettings,
} from "./validate.js";
import type { ValidatedSettingsResult } from "./validate.js";

export { ServiceNowConfigError, ServiceNowSettingsError } from "./errors.js";
export { validateServiceNowSettings } from "./validate.js";
export type { ValidatedSettingsResult } from "./validate.js";
export { isSupportedServiceNowRelease, SUPPORTED_SERVICENOW_RELEASES } from "./releases.js";
export type { ServiceNowRelease } from "./releases.js";

const memo = new WeakMap<object, { snapshot: string; result: ValidatedSettingsResult }>();

/**
 * Validate `settings.servicenow` once per file and reuse the result.
 * Throws {@link ServiceNowSettingsError} when configuration is invalid.
 */
export function getValidatedSettingsResult(context: Context): ValidatedSettingsResult {
  const raw = (context.settings as { servicenow?: unknown } | undefined)?.servicenow;
  // `validateServiceNowSettings` returns its own shared result for `undefined`.
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
  return settingsFingerprint(value);
}

export function getValidatedSettings(context: Context): ValidatedServiceNowSettings {
  return getValidatedSettingsResult(context).settings;
}
