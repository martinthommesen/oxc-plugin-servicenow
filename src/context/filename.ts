import { CLIENT_GLOBALS_STRONG } from "../constants.js";
import type { ScriptAuthoring, ScriptSurface } from "../types.js";

export const CLIENT_FILE =
  /(\.client\.|\.cs\.|client[-_.]?script|catalog[-_.]?client|sys_script_client|catalog_script_client|ui[-_.]?script|ui_script|on[-_]?change|on[-_]?load|on[-_]?submit|ui[-_.]?policy)/i;
export const BR_FILE = /(business[-_.]?rule|\.br\.|sys_script(?![_a-z])|\/br\/)/i;
export const SI_FILE = /(script[-_.]?include|\.si\.|\/script-include)/i;
export const UI_ACTION_FILE = /(ui[-_.]?action|\.ua\.|sys_ui_action)/i;
export const SCHEDULED_FILE = /(scheduled[-_.]?script|\.ss\.|sysauto_script|sys_trigger)/i;
export const FIX_SCRIPT_FILE = /(fix[-_.]?script|\.fix\.|sys_script_fix)/i;
export const SERVER_DIR = /(?:^|[\\/])(?:src[\\/])?server[\\/]/i;
/** Public convention for server-side classic scripts (for example `thing.server.js`). */
export const SERVER_FILE = /\.server\.(?:[cm]?[jt]sx?)$/i;
export const CLIENT_DIR = /(?:^|[\\/])(?:src[\\/])?client[\\/]/i;

const CLIENT_GLOBAL_RE = new RegExp(`\\b(?:${CLIENT_GLOBALS_STRONG.join("|")})\\b`);
export const ES_LATEST_IN_COMMENT = /(^|\s)@sn-es-latest\b/;

export function normalizeFilename(filename: string): string {
  return filename.replace(/\\/g, "/");
}

export function isFluentFile(filename: string): boolean {
  return /\.now\.tsx?$/i.test(normalizeFilename(filename));
}

export function basename(filename: string): string {
  const normalized = normalizeFilename(filename);
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

export function looksLikeClientSource(sourceText: string): boolean {
  return CLIENT_GLOBAL_RE.test(sourceText);
}

export function surfacesFromFilename(filename: string): ScriptSurface[] {
  const path = normalizeFilename(filename);
  const surfaces: ScriptSurface[] = [];

  if (UI_ACTION_FILE.test(path)) surfaces.push("ui-action");
  if (CLIENT_FILE.test(path) || CLIENT_DIR.test(path)) surfaces.push("client");
  if (BR_FILE.test(path)) surfaces.push("business-rule");
  if (SI_FILE.test(path)) surfaces.push("script-include");
  if (SCHEDULED_FILE.test(path)) surfaces.push("scheduled-script");
  if (FIX_SCRIPT_FILE.test(path)) surfaces.push("fix-script");
  if (SERVER_DIR.test(path) || SERVER_FILE.test(path)) surfaces.push("server");

  return unique(surfaces);
}

export function authoringFromFilename(filename: string): ScriptAuthoring | undefined {
  return isFluentFile(filename) ? "fluent" : undefined;
}

function unique(values: ScriptSurface[]): ScriptSurface[] {
  return [...new Set(values)];
}
