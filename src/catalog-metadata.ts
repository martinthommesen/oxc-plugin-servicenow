import type { ApplicationScope, JavaScriptMode } from "./types.js";

export type EvidenceVerifiedBy = "fixture" | "declaration-snapshot" | "integration-test" | "manual";

export interface RuleEvidenceRecord {
  verificationId: string;
  url: string;
  claim: string;
  verifiedBy: EvidenceVerifiedBy;
  verifiedAt: string;
}

export type SurfaceConfidence = "high" | "filename-inferred" | "explicit-only";

export interface StructuredApplicability {
  authoring: "classic" | "fluent" | "both";
  surfaces: readonly string[];
  minimumSurfaceConfidence: SurfaceConfidence;
  javascriptModes: readonly JavaScriptMode[] | "n/a";
  scopes: readonly ApplicationScope[];
  serviceNowReleases: readonly string[];
  fluentSdkRange?: string;
}

export interface RuleDocMetadata {
  applicability: StructuredApplicability;
  evidence: readonly RuleEvidenceRecord[];
  overlaps: readonly string[];
  lifecycleAssumptions?: string;
}

export const ALL_SCOPES = ["global", "scoped", "unknown"] as const;
export const CLASSIC_SURFACES = [
  "client",
  "server",
  "business-rule",
  "script-include",
  "ui-action",
  "scheduled-script",
  "fix-script",
] as const;
export const SERVER_SURFACES = [
  "server",
  "business-rule",
  "script-include",
  "ui-action",
  "scheduled-script",
  "fix-script",
] as const;
export const CLIENT_SURFACES = ["client", "ui-action"] as const;
export const ZURICH = ["zurich"] as const;
export const ES5_MODES = ["compatibility", "es5"] as const;
export const ALL_MODES = ["compatibility", "es5", "es2021"] as const;

export const SN_GR =
  "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html";
export const SN_GR_GLOBAL =
  "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html";
export const SN_JS_MODES =
  "https://www.servicenow.com/docs/r/zurich/api-reference/scripts/c_JS_modes.html";
export const SN_JS_FEATURES =
  "https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html";
export const SN_FLUENT = "https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html";
export const SN_FLUENT_CONSTRUCTS =
  "https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html";
export const SN_AJAX = "https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html";
export const SN_GLIDEAJAX = "https://www.servicenow.com/docs/r/api-reference/c_GlideAjaxAPI.html";
export const SN_FORM = "https://www.servicenow.com/docs/r/api-reference/c_GlideFormAPI.html";
export const SN_BR =
  "https://www.servicenow.com/docs/r/application-development/business-rules-classic/c_BusinessRules.html";
export const SN_GDT =
  "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideDateTimeAPI.html";

export function evidenceRecord(
  url: string,
  claim: string,
  verifiedBy: EvidenceVerifiedBy,
  verifiedAt: string,
): RuleEvidenceRecord {
  let hash = 0x811c9dc5;
  for (const character of `${url}\0${claim}\0${verifiedBy}\0${verifiedAt}`) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return {
    verificationId: `rule-evidence-${(hash >>> 0).toString(16).padStart(8, "0")}`,
    url,
    claim,
    verifiedBy,
    verifiedAt,
  };
}

export function latestEvidenceDate(evidence: readonly RuleEvidenceRecord[]): string {
  return evidence.reduce((max, item) => (item.verifiedAt > max ? item.verifiedAt : max), "");
}

export function meta(
  applicability: StructuredApplicability,
  evidence: readonly RuleEvidenceRecord[],
  extra: Omit<RuleDocMetadata, "applicability" | "evidence">,
): RuleDocMetadata {
  return {
    applicability,
    evidence,
    overlaps: extra.overlaps,
    lifecycleAssumptions: extra.lifecycleAssumptions,
  };
}

export function classic(
  surfaces: readonly string[],
  modes: StructuredApplicability["javascriptModes"] = "n/a",
): StructuredApplicability {
  return {
    authoring: "classic",
    surfaces,
    minimumSurfaceConfidence: "filename-inferred",
    javascriptModes: modes,
    scopes: ALL_SCOPES,
    serviceNowReleases: [...ZURICH],
  };
}

export function engine(modes: readonly JavaScriptMode[]): StructuredApplicability {
  return {
    authoring: "classic",
    surfaces: CLASSIC_SURFACES,
    minimumSurfaceConfidence: "filename-inferred",
    javascriptModes: modes,
    scopes: ALL_SCOPES,
    serviceNowReleases: [...ZURICH],
  };
}

export function fluent(): StructuredApplicability {
  return {
    authoring: "fluent",
    surfaces: ["fluent"],
    minimumSurfaceConfidence: "filename-inferred",
    javascriptModes: "n/a",
    scopes: ALL_SCOPES,
    serviceNowReleases: [...ZURICH],
    fluentSdkRange: "3.0.0 || 4.1.0 || 4.8.0 || 4.10.0 || 4.10.1 || 4.11.0",
  };
}

export function formatJavascriptModes(modes: StructuredApplicability["javascriptModes"]): string {
  if (modes === "n/a") {
    return "Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.";
  }
  return `Runs when javascriptMode is ${modes.join(", ")}. Unknown mode stays silent.`;
}

export function formatSurfaces(surfaces: readonly string[]): string {
  if (surfaces.length === 1 && surfaces[0] === "fluent") {
    return "Fluent `.now.ts` metadata only.";
  }
  return `Applies to ${surfaces.join(", ")} when those surfaces are known. Unknown surfaces stay silent.`;
}
