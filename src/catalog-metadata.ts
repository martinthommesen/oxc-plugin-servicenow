import type { ApplicationScope, JavaScriptMode } from "./types.js";
import type { ServiceNowRelease } from "./settings/releases.js";
import { SUPPORTED_SERVICENOW_RELEASES } from "./settings/releases.js";
import { SUPPORTED_FLUENT_SDK_VERSIONS } from "./fluent/index.js";
import { ENGINE_FEATURE_EVIDENCE } from "./engine/index.js";
import { GLIDE_RECORD_EVIDENCE } from "./glide/index.js";

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
  lifecycleAssumptions?: string;
  limitationPreamble?: string;
}

export const ALL_SCOPES = ["global", "scoped", "unknown"] as const;
export const CLASSIC_SURFACES = [
  "client",
  "server",
  "acl",
  "business-rule",
  "script-include",
  "ui-action",
  "scheduled-script",
  "fix-script",
] as const;
export const SERVER_SURFACES = [
  "server",
  "acl",
  "business-rule",
  "script-include",
  "ui-action",
  "scheduled-script",
  "fix-script",
] as const;
export const CLIENT_SURFACES = ["client", "ui-action"] as const;
export const ES5_MODES = ["compatibility", "es5"] as const;
export const ALL_INSTANCE_MODES = ["compatibility", "es5", "es2021", "unknown"] as const;

export const SN_GR = GLIDE_RECORD_EVIDENCE.zurich.scoped;
export const SN_GR_GLOBAL = GLIDE_RECORD_EVIDENCE.zurich.global;
export const SN_GR_AUSTRALIA = GLIDE_RECORD_EVIDENCE.australia.scoped;
export const SN_GR_GLOBAL_AUSTRALIA = GLIDE_RECORD_EVIDENCE.australia.global;
export const SN_GA =
  "https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html";
export const SN_GA_AUSTRALIA =
  "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html";
export const SN_GA_GLOBAL_AUSTRALIA =
  "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateAPI.html";
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

export type ReleaseReviewBasis =
  | "direct"
  | "engine-matrix"
  | "engine-updates"
  | "glide-record"
  | "glide-aggregate";

export interface ReleaseBasisEvidence {
  readonly url: string;
  readonly claim: string;
}

export type RuleReleaseReview =
  | {
      readonly status: "reviewed";
      readonly basis: readonly ReleaseReviewBasis[];
    }
  | {
      readonly status: "invariant";
      readonly rationale: string;
    }
  | {
      readonly status: "not-applicable";
      readonly axis: "fluent-sdk";
    };

interface ReviewedCatalogRelease {
  readonly kind: "per-rule";
  readonly reviewedAt: string;
  readonly rules: Readonly<Record<string, RuleReleaseReview>>;
  readonly evidence: Readonly<Record<ReleaseReviewBasis, readonly ReleaseBasisEvidence[]>>;
}

type CatalogReleaseReviewRegistry = {
  readonly zurich: { readonly kind: "legacy-baseline" };
} & Readonly<Record<Exclude<ServiceNowRelease, "zurich">, ReviewedCatalogRelease>>;

export const AUSTRALIA_RULE_REVIEWS = Object.freeze({
  "no-hardcoded-sysid": {
    status: "invariant",
    rationale: "The diagnostic concerns portable instance identity, not a release-specific API.",
  },
  "no-hardcoded-table-names": {
    status: "invariant",
    rationale: "The diagnostic is an organizational portability policy, not a release capability.",
  },
  "no-promise": { status: "reviewed", basis: ["engine-matrix"] },
  "no-async-await": { status: "reviewed", basis: ["engine-matrix"] },
  "no-bigint": { status: "reviewed", basis: ["engine-matrix"] },
  "no-at-method": { status: "reviewed", basis: ["engine-matrix"] },
  "no-weak-references": { status: "reviewed", basis: ["engine-matrix"] },
  "no-weak-collections": { status: "reviewed", basis: ["engine-matrix"] },
  "no-object-hasown": { status: "reviewed", basis: ["engine-matrix"] },
  "no-unsupported-static-methods": { status: "reviewed", basis: ["engine-updates"] },
  "no-typed-arrays": { status: "reviewed", basis: ["engine-matrix"] },
  "no-proxy": { status: "reviewed", basis: ["engine-matrix"] },
  "no-unsupported-syntax": { status: "reviewed", basis: ["engine-matrix"] },
  "no-async-iterators": { status: "reviewed", basis: ["engine-matrix"] },
  "no-gs-now": { status: "reviewed", basis: ["direct"] },
  "no-br-current-update": { status: "reviewed", basis: ["direct"] },
  "no-packages-calls": { status: "reviewed", basis: ["direct"] },
  "no-client-gliderecord": { status: "reviewed", basis: ["direct"] },
  "require-callback-for-getreference": { status: "reviewed", basis: ["direct"] },
  "require-glideajax-sysparm-name": { status: "reviewed", basis: ["direct"] },
  "no-glideajax-getanswer": { status: "reviewed", basis: ["direct"] },
  "require-business-rule-wrapper": { status: "reviewed", basis: ["direct"] },
  "no-display-value-date-comparison": { status: "reviewed", basis: ["direct"] },
  "no-sync-glideajax": { status: "reviewed", basis: ["direct"] },
  "require-query-before-next": { status: "reviewed", basis: ["glide-record"] },
  "validate-gliderecord-calls": { status: "reviewed", basis: ["glide-record"] },
  "no-delete-multiple-with-windowing": { status: "reviewed", basis: ["glide-record"] },
  "no-glideelement-in-collection": { status: "reviewed", basis: ["glide-record"] },
  "no-gliderecord-query-modifier-after-query": {
    status: "reviewed",
    basis: ["glide-record"],
  },
  "no-unfiltered-gliderecord-bulk-operation": {
    status: "reviewed",
    basis: ["glide-record"],
  },
  "prefer-setnocount-with-choosewindow": {
    status: "reviewed",
    basis: ["glide-record"],
  },
  "no-system-query-bypass": { status: "reviewed", basis: ["glide-record"] },
  "prefer-glideaggregate": { status: "reviewed", basis: ["glide-aggregate"] },
  "validate-glideaggregate-calls": { status: "reviewed", basis: ["glide-aggregate"] },
  "no-gliderecord-query-in-loop": {
    status: "reviewed",
    basis: ["glide-record", "glide-aggregate"],
  },
  "no-gliderecord-query-in-acl": {
    status: "reviewed",
    basis: ["direct", "glide-record", "glide-aggregate"],
  },
  "fluent-proper-imports": { status: "not-applicable", axis: "fluent-sdk" },
  "fluent-directives": { status: "not-applicable", axis: "fluent-sdk" },
  "prefer-now-include": { status: "not-applicable", axis: "fluent-sdk" },
  "require-fluent-id": { status: "not-applicable", axis: "fluent-sdk" },
  "fluent-naming-convention": { status: "not-applicable", axis: "fluent-sdk" },
  "no-complex-fluent-logic": { status: "not-applicable", axis: "fluent-sdk" },
  "no-now-id-as-reference": { status: "not-applicable", axis: "fluent-sdk" },
  "no-duplicate-fluent-id": { status: "not-applicable", axis: "fluent-sdk" },
} as const satisfies Readonly<Record<string, RuleReleaseReview>>);

export const CATALOG_RELEASE_REVIEWS = Object.freeze({
  zurich: Object.freeze({ kind: "legacy-baseline" }),
  australia: Object.freeze({
    kind: "per-rule",
    reviewedAt: "2026-08-22",
    rules: AUSTRALIA_RULE_REVIEWS,
    evidence: Object.freeze({
      direct: Object.freeze([]),
      "engine-matrix": Object.freeze([
        Object.freeze({
          url: SN_JS_FEATURES_AUSTRALIA,
          claim:
            "The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.",
        }),
      ]),
      "engine-updates": Object.freeze([
        Object.freeze({
          url: SN_JS_ENGINE_UPDATES_AUSTRALIA,
          claim:
            "The Australia JavaScript engine update ledger was reviewed for release-added built-ins and their applicable JavaScript modes.",
        }),
      ]),
      "glide-record": Object.freeze([
        Object.freeze({
          url: SN_GR_AUSTRALIA,
          claim:
            "The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.",
        }),
        Object.freeze({
          url: SN_GR_GLOBAL_AUSTRALIA,
          claim:
            "The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.",
        }),
      ]),
      "glide-aggregate": Object.freeze([
        Object.freeze({
          url: SN_GA_AUSTRALIA,
          claim:
            "The Australia-scoped GlideAggregate API was reviewed for the methods and lifecycle facts used by this rule.",
        }),
        Object.freeze({
          url: SN_GA_GLOBAL_AUSTRALIA,
          claim:
            "The Australia-global GlideAggregate API was reviewed for the methods and lifecycle facts used by this rule.",
        }),
      ]),
    }),
  }),
} as const satisfies CatalogReleaseReviewRegistry);

export function serviceNowReleasesForRule(
  ruleName: string,
  authoring: StructuredApplicability["authoring"],
): readonly ServiceNowRelease[] {
  if (authoring === "fluent") return [];
  return SUPPORTED_SERVICENOW_RELEASES.filter((release) => {
    const review = CATALOG_RELEASE_REVIEWS[release];
    if (review.kind === "legacy-baseline") return true;
    const reviews: Readonly<Record<string, RuleReleaseReview>> = review.rules;
    const ruleReview = reviews[ruleName];
    return ruleReview?.status === "reviewed" || ruleReview?.status === "invariant";
  });
}

export function releaseEvidenceForRule(
  ruleName: string,
  evidence: readonly RuleEvidenceRecord[],
): readonly RuleEvidenceRecord[] {
  const additions: RuleEvidenceRecord[] = [];
  const urls = new Set(evidence.map((item) => item.url));
  for (const release of SUPPORTED_SERVICENOW_RELEASES) {
    const releaseReview = CATALOG_RELEASE_REVIEWS[release];
    if (releaseReview.kind === "legacy-baseline") continue;
    const reviews: Readonly<Record<string, RuleReleaseReview>> = releaseReview.rules;
    const ruleReview = reviews[ruleName];
    if (ruleReview?.status !== "reviewed") continue;
    for (const basis of ruleReview.basis) {
      for (const item of releaseReview.evidence[basis]) {
        if (urls.has(item.url)) continue;
        additions.push(evidenceRecord(item.url, item.claim, "manual", releaseReview.reviewedAt));
        urls.add(item.url);
      }
    }
  }
  return additions.length === 0 ? evidence : [...evidence, ...additions];
}

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
