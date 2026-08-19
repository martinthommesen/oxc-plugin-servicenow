import type { Context } from "@oxlint/plugins";
import { CLIENT_GLOBALS_STRONG } from "../constants.js";
import type { ScriptKind, ServiceNowSettings } from "../types.js";
import { getSettings } from "./settings.js";

const CLIENT_FILE =
  /(\.client\.|\.cs\.|client[-_.]?script|catalog[-_.]?client|sys_script_client|catalog_script_client|ui[-_.]?script|ui_script|on[-_]?change|on[-_]?load|on[-_]?submit|ui[-_.]?policy)/i;
const BR_FILE = /(business[-_.]?rule|\.br\.|sys_script(?![_a-z])|\/br\/)/i;
const SI_FILE = /(script[-_.]?include|\.si\.|\/script-include)/i;
const UI_ACTION_FILE = /(ui[-_.]?action|\.ua\.|sys_ui_action)/i;
const SERVER_DIR = /(?:^|[\\/])(?:src[\\/])?server[\\/]/i;

const CLIENT_GLOBAL_RE = new RegExp(`\\b(?:${CLIENT_GLOBALS_STRONG.join("|")})\\b`);
const ES_LATEST_IN_COMMENT = /(^|\s)@sn-es-latest\b/;

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

function fallbackComments(text: string): Array<{ value: string }> {
  const out: Array<{ value: string }> = [];
  const re = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const raw = match[0];
    const value = raw.startsWith("//") ? raw.slice(2) : raw.slice(2, -2);
    out.push({ value });
  }
  return out;
}

export function hasEsLatestPragma(context: Context): boolean {
  const sc = context.sourceCode as {
    getAllComments?: () => Array<{ value: string }>;
    text: string;
  };
  const comments =
    typeof sc.getAllComments === "function" ? sc.getAllComments() : fallbackComments(sc.text);
  return comments.some((c) => ES_LATEST_IN_COMMENT.test(c.value));
}

export function looksLikeClientSource(sourceText: string): boolean {
  return CLIENT_GLOBAL_RE.test(sourceText);
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
  if (UI_ACTION_FILE.test(filename)) return "ui-action";
  if (CLIENT_FILE.test(filename)) return "client";
  if (BR_FILE.test(filename)) return "business-rule";
  if (SI_FILE.test(filename)) return "script-include";
  if (looksLikeClientSource(sourceText)) return "client";
  if (SERVER_DIR.test(filename)) return "server";
  return "unknown";
}

// oxlint's JS-plugin model processes one file at a time. A single-entry memo
// avoids retaining the previous file's source. Concurrent interleaving would
// need keyed storage.
let memoFilename: string | undefined;
let memoText: string | undefined;
let memoSettings: ServiceNowSettings | undefined;
let memoKind: ScriptKind | undefined;

export function classifyFromContext(context: Context): ScriptKind {
  const settings = getSettings(context);
  const { filename } = context;
  const text = context.sourceCode.text;
  if (filename === memoFilename && text === memoText && settings === memoSettings) {
    return memoKind!;
  }
  memoFilename = filename;
  memoText = text;
  memoSettings = settings;
  memoKind = classifyFile(filename, text, settings);
  return memoKind;
}

/**
 * Classic Rhino/ES5 engine restrictions apply unless the file is Fluent
 * metadata, marked `@sn-es-latest`, or `settings.servicenow.ecmaLatest`.
 */
export function usesClassicEngine(context: Context): boolean {
  const settings = getSettings(context);
  if (settings.ecmaLatest) return false;
  if (settings.scriptType === "fluent") return false;
  if (hasEsLatestPragma(context)) return false;
  if (isFluentFile(context.filename)) return false;
  return true;
}
