import type { Context } from "@oxlint/plugins";
import { getScriptContext, isFluentFile } from "../context/index.js";
import {
  BR_FILE,
  CLIENT_FILE,
  looksLikeClientSource,
  SI_FILE,
  surfacesFromFilename,
  UI_ACTION_FILE,
} from "../context/filename.js";
import type { ScriptKind, ServiceNowSettings } from "../types.js";
import { getValidatedSettings } from "../settings/index.js";

export {
  basename,
  isFluentFile,
  looksLikeClientSource,
  normalizeFilename,
} from "../context/filename.js";

/**
 * @deprecated Use `getScriptContext`. Maps the new context model onto the
 * historical single ScriptKind value for callers that have not migrated.
 */
export function classifyFile(
  filename: string,
  sourceText: string,
  settings: ServiceNowSettings,
): ScriptKind {
  if (settings.scriptType && settings.scriptType !== "auto") {
    return settings.scriptType;
  }
  if (isFluentFile(filename) || settings.authoring === "fluent") return "fluent";
  const surfaces = surfacesFromFilename(filename);
  if (surfaces.includes("ui-action")) return "ui-action";
  if (surfaces.includes("client")) return "client";
  if (surfaces.includes("business-rule")) return "business-rule";
  if (surfaces.includes("script-include")) return "script-include";
  if (looksLikeClientSource(sourceText)) return "client";
  if (surfaces.includes("server")) return "server";
  return "unknown";
}

export function classifyFromContext(context: Context): ScriptKind {
  const ctx = getScriptContext(context);
  if (ctx.authoring === "fluent") return "fluent";
  if (ctx.surfaces.has("ui-action") && !ctx.surfaces.has("client") && !ctx.surfaces.has("server")) {
    return "ui-action";
  }
  if (ctx.surfaces.has("business-rule")) return "business-rule";
  if (ctx.surfaces.has("client")) return "client";
  if (ctx.surfaces.has("script-include")) return "script-include";
  if (ctx.surfaces.has("server")) return "server";
  if (ctx.surfaces.has("ui-action")) return "ui-action";
  return "unknown";
}

/**
 * @deprecated Use `getScriptContext().javascriptMode`.
 * Returns true only for explicit Compatibility/ES5. Unknown mode is not classic.
 */
export function usesClassicEngine(context: Context): boolean {
  const ctx = getScriptContext(context);
  return (
    ctx.authoring === "classic" &&
    (ctx.javascriptMode === "es5" || ctx.javascriptMode === "compatibility")
  );
}

export function hasEsLatestPragma(context: Context): boolean {
  return getScriptContext(context).deprecations.some((item) => item.path === "@sn-es-latest");
}

export { BR_FILE, CLIENT_FILE, SI_FILE, UI_ACTION_FILE, getValidatedSettings };
