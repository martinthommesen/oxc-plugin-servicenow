import type { Context } from "@oxlint/plugins";
import { CLIENT_GLOBALS } from "../constants.js";
import type { ScriptKind, ServiceNowSettings } from "../types.js";
import { getSettings } from "./settings.js";

const CLIENT_FILE = /(\.client\.|\.cs\.|client[-_.]?script|catalog[-_.]?client|ui[-_.]?script|ui_script|on[-_]?change|on[-_]?load|on[-_]?submit|ui[-_.]?policy)/i;
const BR_FILE = /(business[-_.]?rule|\.br\.|sys_script[^_]|\/br\/)/i;
const SI_FILE = /(script[-_.]?include|\.si\.|\/script-include)/i;
const SERVER_DIR = /(?:^|[\\/])(?:src[\\/])?server[\\/]/i;

const ES_LATEST_PRAGMA = /(?:^|\n)\s*(?:\/\/|\/\*)\s*@sn-es-latest\b/;

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

export function hasEsLatestPragma(sourceText: string): boolean {
  return ES_LATEST_PRAGMA.test(sourceText);
}

export function looksLikeClientSource(sourceText: string): boolean {
  return CLIENT_GLOBALS.some((name) => new RegExp(`\\b${name}\\b`).test(sourceText));
}

export function classifyFile(
  filename: string,
  sourceText: string,
  settings: ServiceNowSettings,
): ScriptKind {
  if (settings.scriptType && settings.scriptType !== "auto") {
    return settings.scriptType;
  }

  if (isFluentFile(filename)) return "fluent";
  if (CLIENT_FILE.test(filename) || looksLikeClientSource(sourceText)) return "client";
  if (BR_FILE.test(filename)) return "business-rule";
  if (SI_FILE.test(filename)) return "script-include";
  if (SERVER_DIR.test(filename)) return "server";
  return "unknown";
}

export function classifyFromContext(context: Context): ScriptKind {
  return classifyFile(context.filename, context.sourceCode.text, getSettings(context));
}

/**
 * Classic Rhino/ES5 engine restrictions apply unless the file is Fluent
 * metadata, marked `@sn-es-latest`, or `settings.servicenow.ecmaLatest`.
 */
export function usesClassicEngine(context: Context): boolean {
  const settings = getSettings(context);
  if (settings.ecmaLatest) return false;
  if (hasEsLatestPragma(context.sourceCode.text)) return false;
  if (isFluentFile(context.filename)) return false;
  return true;
}
