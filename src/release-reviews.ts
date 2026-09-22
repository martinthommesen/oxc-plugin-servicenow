import type { ServiceNowRelease } from "./settings/releases.js";
import { SUPPORTED_SERVICENOW_RELEASES } from "./settings/releases.js";
import {
  SN_GA_AUSTRALIA,
  SN_GA_GLOBAL_AUSTRALIA,
  SN_GR_AUSTRALIA,
  SN_GR_GLOBAL_AUSTRALIA,
  SN_JS_ENGINE_UPDATES_AUSTRALIA,
  SN_JS_FEATURES_AUSTRALIA,
  evidenceRecord,
  type EvidenceClaim,
  type StructuredApplicability,
} from "./catalog-metadata.js";

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

export type CatalogReleaseReviewRegistry = {
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
  "no-incorrect-array-from-thisarg": { status: "reviewed", basis: ["engine-updates"] },
  "no-incorrect-bigint-asuintn": { status: "reviewed", basis: ["engine-updates"] },
  "no-unhoisted-block-function-use": { status: "reviewed", basis: ["engine-updates"] },
  "no-object-method-constructor": { status: "reviewed", basis: ["engine-updates"] },
  "no-at-method": { status: "reviewed", basis: ["engine-matrix"] },
  "no-map-set": { status: "reviewed", basis: ["engine-matrix"] },
  "no-weak-references": { status: "reviewed", basis: ["engine-matrix"] },
  "no-weak-collections": { status: "reviewed", basis: ["engine-matrix"] },
  "no-object-hasown": { status: "reviewed", basis: ["engine-matrix"] },
  "no-unsupported-date-fraction": { status: "reviewed", basis: ["engine-updates"] },
  "no-unsupported-set-methods": { status: "reviewed", basis: ["engine-updates"] },
  "no-unsupported-static-methods": { status: "reviewed", basis: ["engine-updates"] },
  "no-typed-arrays": { status: "reviewed", basis: ["engine-matrix", "engine-updates"] },
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

/** The one place the per-rule review map widens to a lookup by rule name. */
function reviewFor(
  release: ReviewedCatalogRelease,
  ruleName: string,
): RuleReleaseReview | undefined {
  return release.rules[ruleName];
}

export function serviceNowReleasesForRule(
  ruleName: string,
  authoring: StructuredApplicability["authoring"],
): readonly ServiceNowRelease[] {
  if (authoring === "fluent") return [];
  return SUPPORTED_SERVICENOW_RELEASES.filter((release) => {
    const review = CATALOG_RELEASE_REVIEWS[release];
    if (review.kind === "legacy-baseline") return true;
    const ruleReview = reviewFor(review, ruleName);
    return ruleReview?.status === "reviewed" || ruleReview?.status === "invariant";
  });
}

export function releaseEvidenceForRule(
  ruleName: string,
  evidence: readonly EvidenceClaim[],
): readonly EvidenceClaim[] {
  const additions: EvidenceClaim[] = [];
  const urls = new Set(evidence.map((item) => item.url));
  for (const release of SUPPORTED_SERVICENOW_RELEASES) {
    const releaseReview = CATALOG_RELEASE_REVIEWS[release];
    if (releaseReview.kind === "legacy-baseline") continue;
    const ruleReview = reviewFor(releaseReview, ruleName);
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
