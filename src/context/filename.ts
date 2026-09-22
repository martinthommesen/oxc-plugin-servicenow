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

const SCRIPT_EXTENSION_GLOB = "{js,cjs,mjs}";

export const ACL_FILE_GLOBS = [
  `**/{acl,*[-_.]acl}.${SCRIPT_EXTENSION_GLOB}`,
  `**/{acl,*[-_.]acl}[-_.]*.${SCRIPT_EXTENSION_GLOB}`,
  `**/{access-control,access-controls,*[-_.]access-control,*[-_.]access-controls}.${SCRIPT_EXTENSION_GLOB}`,
  `**/{access-control,access-controls,*[-_.]access-control,*[-_.]access-controls}[-_.]*.${SCRIPT_EXTENSION_GLOB}`,
  `**/{access_control,access_controls,*[-_.]access_control,*[-_.]access_controls}.${SCRIPT_EXTENSION_GLOB}`,
  `**/{access_control,access_controls,*[-_.]access_control,*[-_.]access_controls}[-_.]*.${SCRIPT_EXTENSION_GLOB}`,
  `**/{access.control,access.controls,*[-_.]access.control,*[-_.]access.controls}.${SCRIPT_EXTENSION_GLOB}`,
  `**/{access.control,access.controls,*[-_.]access.control,*[-_.]access.controls}[-_.]*.${SCRIPT_EXTENSION_GLOB}`,
  `**/{accesscontrol,accesscontrols,*[-_.]accesscontrol,*[-_.]accesscontrols}.${SCRIPT_EXTENSION_GLOB}`,
  `**/{accesscontrol,accesscontrols,*[-_.]accesscontrol,*[-_.]accesscontrols}[-_.]*.${SCRIPT_EXTENSION_GLOB}`,
  `**/{acl,acls,access-control,access-controls,access_control,access_controls,accesscontrol,accesscontrols}/**/*.${SCRIPT_EXTENSION_GLOB}`,
];

const CLIENT_FILE =
  /(?:^|[-_.])(?:client[-_.]?script|catalog[-_.]?client|ui[-_.]?script|on[-_.]?change|on[-_.]?load|on[-_.]?submit|ui[-_.]?policy)(?=[-_.]|$)|^(?:sys_script_client|catalog_script_client)(?=[-_.]|$)|(?:^|[-_.])(?:client|cs)(?=[-_.]|$)/i;
const BR_FILE =
  /(?:^|[-_.])business[-_.]?rule(?=[-_.]|$)|(?:^|[-_.])br(?=\.[cm]?js$)|^sys_script\.[cm]?js$/i;
const ACL_FILE =
  /(?:^|[-_.])(?:access[-_.]?controls?|acl)(?=[-_.]|$)|^sys_security_acl(?=[-_.]|$)/i;
const SI_FILE =
  /(?:^|[-_.])script[-_.]?include(?=[-_.]|$)|(?:^|[-_.])si(?=\.[cm]?js$)|^sys_script_include(?=[-_.]|$)/i;
const UI_ACTION_FILE =
  /(?:^|[-_.])ui[-_.]?action(?=[-_.]|$)|(?:^|[-_.])ua(?=\.[cm]?js$)|^sys_ui_action(?=[-_.]|$)/i;
const SCHEDULED_FILE =
  /(?:^|[-_.])scheduled[-_.]?script(?=[-_.]|$)|(?:^|[-_.])ss(?=\.[cm]?js$)|^(?:sysauto_script|sys_trigger)(?=[-_.]|$)/i;
const FIX_SCRIPT_FILE =
  /(?:^|[-_.])fix[-_.]?script(?=[-_.]|$)|(?:^|[-_.])fix(?=\.[cm]?js$)|^sys_script_fix(?=[-_.]|$)/i;
const SERVER_FILE = /(?:^|[-_.])server(?=\.[cm]?js$)/i;
/**
 * The documented compound server UI Action suffix (`approve.server.ui-action.js`).
 * `SERVER_FILE` only matches `server` directly before the extension, so the
 * record-type token in between has to be recognized separately
 * (FINDINGS.md COR-017).
 */
const SERVER_UI_ACTION_FILE = /(?:^|[-_.])server[-_.](?:ui[-_.]?action|ua)(?=\.[cm]?js$)/i;

const CLIENT_DIR = /(?:^|\/)client(?:\/|$)/i;
const BR_DIR = /(?:^|\/)(?:br|business[-_]?rules?)(?:\/|$)/i;
const ACL_DIR = /(?:^|\/)(?:acls?|access[-_]?controls?)(?:\/|$)/i;
const SI_DIR = /(?:^|\/)(?:script[-_]?includes?|si)(?:\/|$)/i;
const UI_ACTION_DIR = /(?:^|\/)(?:ui[-_]?actions?|ua)(?:\/|$)/i;
const SCHEDULED_DIR = /(?:^|\/)(?:scheduled[-_]?scripts?|ss)(?:\/|$)/i;
const FIX_SCRIPT_DIR = /(?:^|\/)(?:fix[-_]?scripts?|fix)(?:\/|$)/i;
const SERVER_DIR = /(?:^|\/)server(?:\/|$)/i;

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

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:\//.test(path);
}

/**
 * The path the directory-convention patterns may inspect. Directory names
 * above the project root (a checkout under `~/client/`, a `/srv/server/`
 * volume) are not project layout, so an absolute filename contributes
 * directory evidence only for its project-relative part, and only its
 * basename when it lies outside the project.
 */
function directoryEvidencePath(path: string, baseDirectory: string | undefined): string {
  if (!isAbsolutePath(path)) return path;
  if (baseDirectory) {
    let base = normalizeFilename(baseDirectory);
    while (base.length > 1 && base.endsWith("/")) base = base.slice(0, -1);
    // A root base directory ("/" or "C:/") keeps everything below it.
    if (base.endsWith("/") && path.startsWith(base)) return path.slice(base.length);
    if (!base.endsWith("/") && base.length > 0 && path.startsWith(`${base}/`)) {
      return path.slice(base.length + 1);
    }
  }
  return basename(path);
}

export function surfacesFromFilename(filename: string, baseDirectory?: string): ScriptSurface[] {
  const path = normalizeFilename(filename);
  const file = basename(path);
  const directoryPath = directoryEvidencePath(path, baseDirectory);
  const surfaces = new Set<ScriptSurface>();
  if (UI_ACTION_FILE.test(file) || UI_ACTION_DIR.test(directoryPath)) surfaces.add("ui-action");
  if (CLIENT_FILE.test(file) || CLIENT_DIR.test(directoryPath)) surfaces.add("client");
  if (ACL_FILE.test(file) || ACL_DIR.test(directoryPath)) surfaces.add("acl");
  if (BR_FILE.test(file) || BR_DIR.test(directoryPath)) surfaces.add("business-rule");
  if (SI_FILE.test(file) || SI_DIR.test(directoryPath)) surfaces.add("script-include");
  if (SCHEDULED_FILE.test(file) || SCHEDULED_DIR.test(directoryPath))
    surfaces.add("scheduled-script");
  if (FIX_SCRIPT_FILE.test(file) || FIX_SCRIPT_DIR.test(directoryPath)) surfaces.add("fix-script");
  // A generic server directory is weaker evidence than a specific script
  // subtype in the filename. Keep `src/server/helper.si.js` as a Script
  // Include rather than making the evidence contradictory and returning [].
  // The UI Action subtype is the exception: it names a record type, not an
  // execution surface, so it composes with server evidence instead of
  // displacing it. `approve.server.ui-action.js` and a UI Action under
  // `src/server/` therefore keep the documented server surface
  // (FINDINGS.md COR-017).
  const serverEvidence =
    SERVER_DIR.test(directoryPath) || SERVER_FILE.test(file) || SERVER_UI_ACTION_FILE.test(file);
  const serverComposes =
    surfaces.size === 0 ||
    (surfaces.has("ui-action") &&
      [...surfaces].every((surface) => surface === "ui-action" || surface === "client"));
  if (serverEvidence && serverComposes) surfaces.add("server");

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
