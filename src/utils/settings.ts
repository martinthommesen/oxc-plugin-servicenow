import type { Context } from "@oxlint/plugins";
import type { ServiceNowSettings } from "../types.js";

const EMPTY_SETTINGS: ServiceNowSettings = Object.freeze({});

export function getSettings(context: Context): ServiceNowSettings {
  const raw = context.settings as { servicenow?: ServiceNowSettings } | undefined;
  return raw?.servicenow ?? EMPTY_SETTINGS;
}

export function optionAt<T>(context: Context, index: number, fallback: T): T {
  const value = context.options[index];
  return (value as T | undefined) ?? fallback;
}
