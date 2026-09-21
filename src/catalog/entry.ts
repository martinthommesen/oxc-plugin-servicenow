import type { Rule } from "@oxlint/plugins";
import type { ServiceNowSettings } from "../types.js";
import { optionDocsFromDescriptor } from "../options/index.js";
import { PLUGIN_NAME, ruleDocsUrl } from "../constants.js";
import * as metadata from "../catalog-metadata.js";
import { releaseEvidenceForRule, serviceNowReleasesForRule } from "../release-reviews.js";
import type {
  RuleApplicability,
  RuleCatalogEntry,
  RuleCatalogInput,
  RuleLimitationCase,
  RulePlacement,
} from "./types.js";

export const ES5: ServiceNowSettings = { javascriptMode: "es5" };
const PLATFORM_METHOD_AUTHORITY_FIXTURE = "tests/rules/platform-method-authority.test.ts";

export function platformMethodAuthorityEvidence() {
  return metadata.evidenceRecord(
    PLATFORM_METHOD_AUTHORITY_FIXTURE,
    "Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.",
    "fixture",
    "2026-08-24",
  );
}

export function platformMethodMutationLimitation(
  caseId: string,
  code: string,
  description = "A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.",
): RuleLimitationCase {
  return {
    caseId,
    kind: "false-negative",
    description,
    name: "visible platform-method mutation",
    filename: "mutated-platform.server.js",
    code,
  };
}

const UNKNOWN_SILENT = "Unknown, escaped, or ambiguous bindings stay silent instead of guessing.";

function formatLimitations(
  cases: readonly RuleLimitationCase[],
  lifecycleAssumptions?: string,
  preamble = UNKNOWN_SILENT,
): string {
  const parts = cases.map((item) => `${item.kind}: ${item.description}`);
  if (lifecycleAssumptions) parts.push(`lifecycle: ${lifecycleAssumptions}`);
  return parts.length === 0 ? preamble : `${preamble} ${parts.join(" ")}`;
}

function withCatalogRecommendation(
  implementation: Rule,
  placements: readonly RulePlacement[],
): Rule {
  return {
    ...implementation,
    meta: {
      ...implementation.meta,
      docs: {
        ...implementation.meta?.docs,
        recommended: placements.some((placement) => placement.profile === "recommended"),
      },
    },
  };
}

export function entry<N extends string>(
  name: N,
  implementation: Rule,
  rest: RuleCatalogInput,
): RuleCatalogEntry & { name: N } {
  const limitationCases = rest.limitationCases ?? [];
  const evidence = releaseEvidenceForRule(name, rest.evidence).map((claim) =>
    metadata.verifiedEvidence(claim, `rule:${name}`),
  );
  const applicability: RuleApplicability = {
    authoring: rest.applicability.authoring,
    surfaces: rest.applicability.surfaces,
    surfacesText: metadata.formatSurfaces(rest.applicability),
    javascriptMode: metadata.formatJavascriptModes(rest.applicability.javascriptModes),
    minimumSurfaceConfidence: rest.applicability.minimumSurfaceConfidence,
    javascriptModes: rest.applicability.javascriptModes,
    scopes: rest.applicability.scopes,
    serviceNowReleases: serviceNowReleasesForRule(name, rest.applicability.authoring),
    fluentSdkRange: rest.applicability.fluentSdkRange,
  };
  return {
    name,
    implementation: withCatalogRecommendation(implementation, rest.placements),
    ruleId: `${PLUGIN_NAME}/${name}`,
    docsUrl: ruleDocsUrl(name),
    ...rest,
    evidence,
    applicability,
    limitationCases,
    overlaps: rest.overlaps ?? [],
    limitations: formatLimitations(
      limitationCases,
      rest.lifecycleAssumptions,
      rest.limitationPreamble,
    ),
    falsePositives: limitationCases
      .filter((item) => item.kind === "false-positive")
      .map((item) => item.description),
    falseNegatives: limitationCases
      .filter((item) => item.kind === "false-negative")
      .map((item) => item.description),
    scopeBoundaries: limitationCases
      .filter((item) => item.kind === "scope-boundary")
      .map((item) => item.description),
    fixKind: rest.fixable ? "safe-fix" : rest.hasSuggestions ? "suggestion" : "none",
    options: rest.optionDescriptor ? optionDocsFromDescriptor(rest.optionDescriptor) : [],
    lastVerified: metadata.latestEvidenceDate(evidence),
  };
}
