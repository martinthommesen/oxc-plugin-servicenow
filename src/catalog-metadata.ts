import type { ApplicationScope, JavaScriptMode } from "./types.js";
import { SUPPORTED_FLUENT_SDK_VERSIONS } from "./fluent/index.js";
import { ENGINE_FEATURE_EVIDENCE } from "./engine/index.js";
import { GLIDE_AGGREGATE_EVIDENCE, GLIDE_RECORD_EVIDENCE } from "./glide/index.js";
import { CLASSIC_SURFACES, CLIENT_SURFACES, SERVER_SURFACES } from "./surfaces.js";

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
  fluentSdkRange?: string;
}

export interface RuleDocMetadata {
  applicability: StructuredApplicability;
  evidence: readonly RuleEvidenceRecord[];
  overlaps: readonly string[];
  lifecycleAssumptions?: string | undefined;
  limitationPreamble?: string | undefined;
}

export const ALL_SCOPES = ["global", "scoped", "unknown"] as const;
export { CLASSIC_SURFACES, CLIENT_SURFACES, SERVER_SURFACES };
export const ES5_MODES = ["compatibility", "es5"] as const;
export const ALL_INSTANCE_MODES = ["compatibility", "es5", "es2021", "unknown"] as const;

export const SN_GR = GLIDE_RECORD_EVIDENCE.zurich.scoped;
export const SN_GR_GLOBAL = GLIDE_RECORD_EVIDENCE.zurich.global;
export const SN_GR_AUSTRALIA = GLIDE_RECORD_EVIDENCE.australia.scoped;
export const SN_GR_GLOBAL_AUSTRALIA = GLIDE_RECORD_EVIDENCE.australia.global;
// Derived from the manifest so both evidence strings match by construction.
// There is no reviewed Zurich global aggregate page.
export const SN_GA = GLIDE_AGGREGATE_EVIDENCE.zurich.scoped as string;
export const SN_GA_AUSTRALIA = GLIDE_AGGREGATE_EVIDENCE.australia.scoped as string;
export const SN_GA_GLOBAL_AUSTRALIA = GLIDE_AGGREGATE_EVIDENCE.australia.global as string;
export const SN_JS_MODES =
  "https://www.servicenow.com/docs/r/api-reference/scripts/c_JS_modes.html";
export const SN_JS_FEATURES = ENGINE_FEATURE_EVIDENCE.zurich.url;
export const SN_JS_FEATURES_AUSTRALIA = ENGINE_FEATURE_EVIDENCE.australia.url;
export const SN_JS_ENGINE_UPDATES_AUSTRALIA =
  "https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html";
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
export const SN_CLIENT_GR =
  "https://www.servicenow.com/docs/r/api-reference/c_GlideRecordClientSideAPI.html";
export const SN_CLIENT_BEST_PRACTICES =
  "https://www.servicenow.com/docs/r/api-reference/scripts/client-script-best-practices.html";
export const SN_SECURE_DATA =
  "https://www.servicenow.com/docs/r/zurich/application-development/building-applications/secure-data.html";
export const SN_SECURE_DATA_AUSTRALIA =
  "https://www.servicenow.com/docs/r/application-development/secure-data.html";
export const SN_ACL_AUSTRALIA =
  "https://www.servicenow.com/docs/r/platform-security/access-control/t_CreateAnACLRule.html";
export const SN_PACKAGES_REMOVAL =
  "https://www.servicenow.com/docs/r/api-reference/scripts/c_PackagesCallRemovalTool.html";

export function evidenceRecord(
  url: string,
  claim: string,
  verifiedBy: EvidenceVerifiedBy,
  verifiedAt: string,
  /** Optional identity salt for one shared claim attested independently by multiple rules. */
  identity = "",
): RuleEvidenceRecord {
  let hash = 0x811c9dc5;
  const hashInput = identity
    ? `${identity}\0${url}\0${claim}\0${verifiedBy}\0${verifiedAt}`
    : `${url}\0${claim}\0${verifiedBy}\0${verifiedAt}`;
  for (const character of hashInput) {
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
    limitationPreamble: extra.limitationPreamble,
  };
}

export function classic(
  surfaces: readonly string[],
  modes: StructuredApplicability["javascriptModes"] = "n/a",
  scopes: readonly ApplicationScope[] = ALL_SCOPES,
): StructuredApplicability {
  return {
    authoring: "classic",
    surfaces,
    minimumSurfaceConfidence: "filename-inferred",
    javascriptModes: modes,
    scopes,
  };
}

export function engine(modes: readonly JavaScriptMode[]): StructuredApplicability {
  return {
    authoring: "classic",
    surfaces: SERVER_SURFACES,
    minimumSurfaceConfidence: "filename-inferred",
    javascriptModes: modes,
    scopes: ALL_SCOPES,
  };
}

export function fluent(): StructuredApplicability {
  return {
    authoring: "fluent",
    surfaces: ["fluent"],
    minimumSurfaceConfidence: "filename-inferred",
    javascriptModes: "n/a",
    scopes: ALL_SCOPES,
    fluentSdkRange: SUPPORTED_FLUENT_SDK_VERSIONS.join(" || "),
  };
}

export function formatJavascriptModes(modes: StructuredApplicability["javascriptModes"]): string {
  if (modes === "n/a") {
    return "Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.";
  }
  if (modes.includes("unknown")) {
    return `Runs when javascriptMode is ${modes.join(", ")}. Universal restrictions can run with unknown mode when the file is a known instance script.`;
  }
  return `Runs when javascriptMode is ${modes.join(", ")}. Unknown mode stays silent.`;
}

export function formatSurfaces(applicability: StructuredApplicability): string {
  const { javascriptModes, surfaces } = applicability;
  if (surfaces.length === 1 && surfaces[0] === "fluent") {
    return "Fluent `.now.ts` metadata only.";
  }
  const uiActionQualification = !surfaces.includes("ui-action")
    ? ""
    : surfaces.includes("server")
      ? " UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified."
      : " Mixed client/server UI Actions stay silent because execution regions are not classified.";
  if (javascriptModes !== "n/a") {
    return `Applies to ${surfaces.join(", ")} when those surfaces are known.${uiActionQualification} An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.`;
  }
  return `Applies to ${surfaces.join(", ")} when those surfaces are known.${uiActionQualification} Unknown surfaces stay silent.`;
}
