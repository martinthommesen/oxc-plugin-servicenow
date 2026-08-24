import { CLIENT_GLOBALS_STRONG } from "../constants.js";
import type { ScriptAuthoring, ScriptSurface } from "../types.js";

const SCRIPT_EXTENSIONS = ["js", "cjs", "mjs"] as const;

function scriptGlobs(stems: readonly string[]): string[] {
  return stems.flatMap((stem) => SCRIPT_EXTENSIONS.map((extension) => `${stem}.${extension}`));
}

export const CLIENT_FILE_GLOBS = scriptGlobs([
  "**/*.client",
  "**/*.client.ui-action",
  "**/*.client.ui_action",
  "**/*.cs",
  "**/*client-script*",
  "**/*client_script*",
  "**/*clientscript*",
  "**/*catalog-client*",
  "**/*catalog_client*",
  "**/sys_script_client*",
  "**/catalog_script_client*",
  "**/*ui-script*",
  "**/*ui_script*",
  "**/*uiscript*",
  "**/*onchange*",
  "**/*onload*",
  "**/*onsubmit*",
  "**/*ui-policy*",
  "**/*ui_policy*",
  "**/*.client.ui-action",
  "**/client/**/*",
  "**/src/client/**/*",
]);

export const BUSINESS_RULE_FILE_GLOBS = scriptGlobs([
  "**/*.br",
  "**/*business-rule*",
  "**/*business_rule*",
  "**/*businessrule*",
  "**/sys_script",
  "**/br/**/*",
  "**/src/br/**/*",
]);

export const ACL_FILE_GLOBS = scriptGlobs([
  "**/*.acl",
  "**/*access-control*",
  "**/*access_control*",
  "**/*accesscontrol*",
  "**/sys_security_acl*",
  "**/acl/**/*",
  "**/acls/**/*",
  "**/access-control/**/*",
  "**/access-controls/**/*",
  "**/access_control/**/*",
  "**/access_controls/**/*",
]);

export const CLIENT_FILE =
  /(?:^|[-_.])(?:client[-_.]?script|catalog[-_.]?client|ui[-_.]?script|on[-_.]?change|on[-_.]?load|on[-_.]?submit|ui[-_.]?policy)(?=[-_.]|$)|^(?:sys_script_client|catalog_script_client)(?=[-_.]|$)|(?:^|[-_.])(?:client|cs)(?=[-_.]|$)/i;
export const BR_FILE =
  /(?:^|[-_.])business[-_.]?rule(?=[-_.]|$)|(?:^|[-_.])br(?=\.[cm]?js$)|^sys_script\.[cm]?js$/i;
export const ACL_FILE =
  /(?:^|[-_.])(?:access[-_.]?controls?|acl)(?=[-_.]|$)|^sys_security_acl(?=[-_.]|$)/i;
export const SI_FILE =
  /(?:^|[-_.])script[-_.]?include(?=[-_.]|$)|(?:^|[-_.])si(?=\.[cm]?js$)|^sys_script_include(?=[-_.]|$)/i;
export const UI_ACTION_FILE =
  /(?:^|[-_.])ui[-_.]?action(?=[-_.]|$)|(?:^|[-_.])ua(?=\.[cm]?js$)|^sys_ui_action(?=[-_.]|$)/i;
export const SCHEDULED_FILE =
  /(?:^|[-_.])scheduled[-_.]?script(?=[-_.]|$)|(?:^|[-_.])ss(?=\.[cm]?js$)|^(?:sysauto_script|sys_trigger)(?=[-_.]|$)/i;
export const FIX_SCRIPT_FILE =
  /(?:^|[-_.])fix[-_.]?script(?=[-_.]|$)|(?:^|[-_.])fix(?=\.[cm]?js$)|^sys_script_fix(?=[-_.]|$)/i;
export const SERVER_FILE = /(?:^|[-_.])server(?=\.[cm]?js$)/i;

const CLIENT_DIR = /(?:^|\/)client(?:\/|$)/i;
const BR_DIR = /(?:^|\/)(?:br|business[-_]?rules?)(?:\/|$)/i;
const ACL_DIR = /(?:^|\/)(?:acls?|access[-_]?controls?)(?:\/|$)/i;
const SI_DIR = /(?:^|\/)(?:script[-_]?includes?|si)(?:\/|$)/i;
const UI_ACTION_DIR = /(?:^|\/)(?:ui[-_]?actions?|ua)(?:\/|$)/i;
const SCHEDULED_DIR = /(?:^|\/)(?:scheduled[-_]?scripts?|ss)(?:\/|$)/i;
const FIX_SCRIPT_DIR = /(?:^|\/)(?:fix[-_]?scripts?|fix)(?:\/|$)/i;
const SERVER_DIR = /(?:^|\/)server(?:\/|$)/i;
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
  const file = basename(path);
  const surfaces = new Set<ScriptSurface>();
  if (UI_ACTION_FILE.test(file) || UI_ACTION_DIR.test(path)) surfaces.add("ui-action");
  if (CLIENT_FILE.test(file) || CLIENT_DIR.test(path)) surfaces.add("client");
  if (ACL_FILE.test(file) || ACL_DIR.test(path)) surfaces.add("acl");
  if (BR_FILE.test(file) || BR_DIR.test(path)) surfaces.add("business-rule");
  if (SI_FILE.test(file) || SI_DIR.test(path)) surfaces.add("script-include");
  if (SCHEDULED_FILE.test(file) || SCHEDULED_DIR.test(path)) surfaces.add("scheduled-script");
  if (FIX_SCRIPT_FILE.test(file) || FIX_SCRIPT_DIR.test(path)) surfaces.add("fix-script");
  // A generic server directory is weaker evidence than a specific script
  // subtype in the filename. Keep `src/server/helper.si.js` as a Script
  // Include rather than making the evidence contradictory and returning [].
  const specificSurface = [...surfaces].some((surface) => surface !== "server");
  if (!specificSurface && (SERVER_DIR.test(path) || SERVER_FILE.test(file))) surfaces.add("server");

  if (
    surfaces.has("server") &&
    [...surfaces].some((surface) =>
      ["acl", "business-rule", "script-include", "scheduled-script", "fix-script"].includes(
        surface,
      ),
    )
  ) {
    surfaces.delete("server");
  }

  if (surfaces.has("ui-action")) {
    if ([...surfaces].some((surface) => !["ui-action", "client", "server"].includes(surface)))
      return [];
    return [...surfaces];
  }
  return surfaces.size > 1 ? [] : [...surfaces];
}

export function authoringFromFilename(filename: string): ScriptAuthoring | undefined {
  return isFluentFile(filename) ? "fluent" : undefined;
}
