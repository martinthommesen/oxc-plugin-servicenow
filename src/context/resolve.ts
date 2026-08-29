import type { Context } from "@oxlint/plugins";
import { getValidatedSettingsResult } from "../settings/index.js";
import type {
  ContextConfidence,
  ContextSourceMap,
  JavaScriptMode,
  ScriptAuthoring,
  ScriptKind,
  ScriptSurface,
  ServiceNowScriptContext,
  SettingsDeprecation,
  ValidatedServiceNowSettings,
} from "../types.js";
import { ServiceNowSettingsError } from "../settings/errors.js";
import { immutableSet } from "../utils/immutable.js";
import {
  ES_LATEST_IN_COMMENT,
  authoringFromFilename,
  isFluentFile,
  surfacesFromFilename,
} from "./filename.js";

export const CONTEXT_CONFIDENCE_ORDER: Readonly<Record<ContextConfidence, number>> = {
  unknown: 0,
  inferred: 1,
  filename: 2,
  explicit: 3,
};

function weakest(sources: ContextSourceMap): ContextConfidence {
  return [sources.authoring, sources.surfaces, sources.javascriptMode, sources.scope].reduce(
    (min, item) => (CONTEXT_CONFIDENCE_ORDER[item] < CONTEXT_CONFIDENCE_ORDER[min] ? item : min),
  );
}

function kindToSurface(kind: ScriptKind): ScriptSurface | undefined {
  switch (kind) {
    case "client":
    case "business-rule":
    case "script-include":
    case "server":
    case "ui-action":
      return kind;
    case "fluent":
    case "unknown":
      return undefined;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function commentsOf(context: Context): Array<{ value: string }> {
  const sourceCode = context.sourceCode as { getAllComments?: () => Array<{ value: string }> };
  if (typeof sourceCode.getAllComments === "function") {
    return sourceCode.getAllComments();
  }
  return [];
}

function hasEsLatestPragma(context: Context): boolean {
  return commentsOf(context).some((comment) => ES_LATEST_IN_COMMENT.test(comment.value));
}

function resolveAuthoring(
  filename: string,
  settings: ValidatedServiceNowSettings,
): { authoring: ScriptAuthoring; confidence: ContextConfidence } {
  if (settings.authoring !== "auto") {
    return { authoring: settings.authoring, confidence: "explicit" };
  }
  // `scriptType` predates the independent authoring/surface dimensions. While
  // it remains supported, an explicit legacy value outranks filename hints;
  // otherwise a `client` script saved as `thing.now.ts` would silently become
  // Fluent and disable all of its relevant rules.
  if (settings.scriptType !== "auto") {
    return {
      authoring: settings.scriptType === "fluent" ? "fluent" : "classic",
      confidence: "explicit",
    };
  }
  const fromFile = authoringFromFilename(filename);
  if (fromFile) {
    return { authoring: fromFile, confidence: "filename" };
  }
  return { authoring: "classic", confidence: "unknown" };
}

function resolveSurfaces(
  filename: string,
  settings: ValidatedServiceNowSettings,
  authoring: ScriptAuthoring,
  inferClient?: () => boolean,
  inferSurfaces?: () => { client: boolean; server: boolean },
): { surfaces: Set<ScriptSurface>; confidence: ContextConfidence } {
  if (authoring === "fluent") {
    if (settings.surfaces !== "auto" && settings.surfaces.length > 0) {
      throw new ServiceNowSettingsError(
        ".surfaces",
        "Fluent authoring cannot list instance execution surfaces",
      );
    }
    return { surfaces: new Set(), confidence: "filename" };
  }

  if (settings.surfaces !== "auto") {
    return { surfaces: new Set(settings.surfaces), confidence: "explicit" };
  }

  if (
    settings.scriptType !== "auto" &&
    settings.scriptType !== "unknown" &&
    settings.scriptType !== "fluent"
  ) {
    const surface = kindToSurface(settings.scriptType);
    return { surfaces: new Set(surface ? [surface] : []), confidence: "explicit" };
  }

  const fromFile = surfacesFromFilename(filename);
  if (fromFile.length > 0) {
    // A bare UI Action names the record type, not its execution surface. Keep
    // that evidence, then continue with AST evidence so a client UI Action is
    // not mistaken for an unresolved/server script.
    if (fromFile.length === 1 && fromFile[0] === "ui-action") {
      const inferred = inferSurfaces?.() ?? { client: Boolean(inferClient?.()), server: false };
      const surfaces = new Set<ScriptSurface>(["ui-action"]);
      if (inferred.client) surfaces.add("client");
      if (inferred.server) surfaces.add("server");
      return {
        surfaces,
        confidence: inferred.client || inferred.server ? "inferred" : "filename",
      };
    }
    return { surfaces: new Set(fromFile), confidence: "filename" };
  }

  const inferred = inferSurfaces?.() ?? { client: Boolean(inferClient?.()), server: false };
  if (inferred.client || inferred.server) {
    const surfaces = new Set<ScriptSurface>();
    if (inferred.client) surfaces.add("client");
    if (inferred.server) surfaces.add("server");
    return { surfaces, confidence: "inferred" };
  }

  return { surfaces: new Set(), confidence: "unknown" };
}

function resolveJavaScriptMode(
  context: Context,
  settings: ValidatedServiceNowSettings,
  authoring: ScriptAuthoring,
  deprecations: SettingsDeprecation[],
): { mode: JavaScriptMode; confidence: ContextConfidence } {
  if (settings.javascriptMode !== undefined) {
    return { mode: settings.javascriptMode, confidence: "explicit" };
  }
  if (settings.ecmaLatest === true) {
    return { mode: "es2021", confidence: "explicit" };
  }
  if (authoring === "fluent" || isFluentFile(context.filename)) {
    return { mode: "unknown", confidence: "filename" };
  }
  if (hasEsLatestPragma(context)) {
    deprecations.push({
      path: "@sn-es-latest",
      message:
        "`@sn-es-latest` is a repository convention, not ServiceNow metadata. Set `settings.servicenow.javascriptMode` instead. The pragma maps to `es2021` for one major-release cycle.",
    });
    return { mode: "es2021", confidence: "inferred" };
  }
  return { mode: "unknown", confidence: "unknown" };
}

export interface ScriptContextExtras {
  program?: unknown;
  inferClient?: () => boolean;
  /** AST evidence for execution surfaces in an otherwise bare record file. */
  inferSurfaces?: () => { client: boolean; server: boolean };
}

export function resolveScriptContext(
  context: Context,
  extras: ScriptContextExtras = {},
): ServiceNowScriptContext {
  const { settings, deprecations } = getValidatedSettingsResult(context);
  const filename = context.filename;

  const authoring = resolveAuthoring(filename, settings);
  const surfaces = resolveSurfaces(
    filename,
    settings,
    authoring.authoring,
    extras.inferClient,
    extras.inferSurfaces,
  );
  const localDeprecations = [...deprecations];
  const javascriptMode = resolveJavaScriptMode(
    context,
    settings,
    authoring.authoring,
    localDeprecations,
  );
  const scopeConfidence: ContextConfidence = settings.scope === "unknown" ? "unknown" : "explicit";

  const sources: ContextSourceMap = Object.freeze({
    authoring: authoring.confidence,
    surfaces: surfaces.confidence,
    javascriptMode: javascriptMode.confidence,
    scope: scopeConfidence,
  });

  return Object.freeze({
    authoring: authoring.authoring,
    surfaces: immutableSet(surfaces.surfaces),
    javascriptMode: javascriptMode.mode,
    scope: settings.scope,
    // Confidence is the weakest independent dimension. A strong filename or
    // authoring hint must not hide unknown mode, scope, or surface evidence.
    confidence: weakest(sources),
    sources,
    businessRuleSourceFormat: settings.businessRuleSourceFormat,
    businessRuleWhen: settings.businessRuleWhen,
    settings,
    deprecations: Object.freeze(localDeprecations),
  });
}

export function hasSurface(ctx: ServiceNowScriptContext, surface: ScriptSurface): boolean {
  return ctx.surfaces.has(surface);
}

export function isFluentContext(ctx: ServiceNowScriptContext): boolean {
  return ctx.authoring === "fluent";
}

export function isInstanceScript(ctx: ServiceNowScriptContext): boolean {
  if (ctx.authoring === "fluent") return false;
  return ctx.sources.authoring !== "unknown" || ctx.sources.surfaces !== "unknown";
}

export function javascriptModeIs(
  ctx: ServiceNowScriptContext,
  ...modes: JavaScriptMode[]
): boolean {
  return modes.includes(ctx.javascriptMode);
}

/**
 * Mode-specific engine rules run only when the mode is known and is one of `modes`.
 * Unknown mode never assumes ES5.
 */
export function appliesInJavaScriptModes(
  ctx: ServiceNowScriptContext,
  modes: readonly JavaScriptMode[],
): boolean {
  if (isFluentContext(ctx)) return false;
  if (ctx.javascriptMode === "unknown") return false;
  return modes.includes(ctx.javascriptMode);
}

/**
 * Features that ServiceNow documents as unsupported in every instance mode
 * may run when the file is an instance script, including unknown mode.
 */
export function appliesToInstanceScripts(ctx: ServiceNowScriptContext): boolean {
  return isInstanceScript(ctx);
}

export function appliesOnSurface(
  ctx: ServiceNowScriptContext,
  surface: ScriptSurface,
  minimum: ContextConfidence = "inferred",
): boolean {
  if (isFluentContext(ctx)) return false;
  if (!ctx.surfaces.has(surface)) return false;
  return CONTEXT_CONFIDENCE_ORDER[ctx.sources.surfaces] >= CONTEXT_CONFIDENCE_ORDER[minimum];
}

const SERVER_ONLY_SURFACES: readonly ScriptSurface[] = [
  "business-rule",
  "script-include",
  "server",
  "scheduled-script",
  "fix-script",
];

/**
 * Client-capable files need an inferred or stronger client surface.
 * Unknown surface is not client-capable.
 */
export function isClientCapableContext(ctx: ServiceNowScriptContext): boolean {
  if (isFluentContext(ctx)) return false;
  return appliesOnSurface(ctx, "client");
}

function hasServerExecutionSurface(
  ctx: ServiceNowScriptContext,
  minimum: ContextConfidence,
): boolean {
  if (SERVER_ONLY_SURFACES.some((surface) => appliesOnSurface(ctx, surface, minimum))) return true;
  if (appliesOnSurface(ctx, "ui-action", minimum) && appliesOnSurface(ctx, "server", minimum))
    return true;
  // A bare UI Action may execute on either side. Without explicit server
  // evidence, do not report server-only diagnostics.
  return false;
}

/**
 * Server-side instance scripts. Unknown surface is not server-capable.
 */
export function isServerInstanceContext(
  ctx: ServiceNowScriptContext,
  minimum: ContextConfidence = "inferred",
): boolean {
  if (isFluentContext(ctx)) return false;
  return hasServerExecutionSurface(ctx, minimum);
}

export function isMixedUiActionContext(ctx: ServiceNowScriptContext): boolean {
  return (
    appliesOnSurface(ctx, "ui-action") &&
    appliesOnSurface(ctx, "client") &&
    appliesOnSurface(ctx, "server")
  );
}
