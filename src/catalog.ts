import type { Rule } from "@oxlint/plugins";
import { fluentDirectives } from "./rules/fluent-directives.js";
import { fluentNamingConvention } from "./rules/fluent-naming-convention.js";
import { fluentProperImports } from "./rules/fluent-proper-imports.js";
import { noAsyncAwait } from "./rules/no-async-await.js";
import { noAsyncIterators } from "./rules/no-async-iterators.js";
import { noAtMethod } from "./rules/no-at-method.js";
import { noBigint } from "./rules/no-bigint.js";
import { noBrCurrentUpdate } from "./rules/no-br-current-update.js";
import { noClientGliderecord } from "./rules/no-client-gliderecord.js";
import { noComplexFluentLogic } from "./rules/no-complex-fluent-logic.js";
import { noDeleteMultipleWithWindowing } from "./rules/no-delete-multiple-with-windowing.js";
import { noDisplayValueDateComparison } from "./rules/no-display-value-date-comparison.js";
import { noDuplicateFluentId } from "./rules/no-duplicate-fluent-id.js";
import { noGlideajaxGetanswer } from "./rules/no-glideajax-getanswer.js";
import { noGlideelementInCollection } from "./rules/no-glideelement-in-collection.js";
import { noGliderecordQueryInAcl } from "./rules/no-gliderecord-query-in-acl.js";
import { noGliderecordQueryInLoop } from "./rules/no-gliderecord-query-in-loop.js";
import { noGliderecordQueryModifierAfterQuery } from "./rules/no-gliderecord-query-modifier-after-query.js";
import { noGsNow } from "./rules/no-gs-now.js";
import { noHardcodedSysid } from "./rules/no-hardcoded-sysid.js";
import { noHardcodedTableNames } from "./rules/no-hardcoded-table-names.js";
import { noNowIdAsReference } from "./rules/no-now-id-as-reference.js";
import { noObjectHasown } from "./rules/no-object-hasown.js";
import { noPackagesCalls } from "./rules/no-packages-calls.js";
import { noPromise } from "./rules/no-promise.js";
import { noProxy } from "./rules/no-proxy.js";
import { noSyncGlideajax } from "./rules/no-sync-glideajax.js";
import { noSystemQueryBypass } from "./rules/no-system-query-bypass.js";
import { noTypedArrays } from "./rules/no-typed-arrays.js";
import { noUnfilteredGliderecordBulkOperation } from "./rules/no-unfiltered-gliderecord-bulk-operation.js";
import { noUnsupportedSyntax } from "./rules/no-unsupported-syntax.js";
import { noWeakCollections } from "./rules/no-weak-collections.js";
import { noWeakReferences } from "./rules/no-weak-references.js";
import { preferGlideaggregate } from "./rules/prefer-glideaggregate.js";
import { preferNowInclude } from "./rules/prefer-now-include.js";
import { preferSetnocountWithChoosewindow } from "./rules/prefer-setnocount-with-choosewindow.js";
import { requireBusinessRuleWrapper } from "./rules/require-business-rule-wrapper.js";
import { requireCallbackForGetreference } from "./rules/require-callback-for-getreference.js";
import { requireFluentId } from "./rules/require-fluent-id.js";
import { requireGlideajaxSysparmName } from "./rules/require-glideajax-sysparm-name.js";
import { requireQueryBeforeNext } from "./rules/require-query-before-next.js";
import { validateGlideaggregateCalls } from "./rules/validate-glideaggregate-calls.js";
import { validateGliderecordCalls } from "./rules/validate-gliderecord-calls.js";
import { PLUGIN_NAME, ruleDocsUrl } from "./constants.js";
import type {
  ApplicationScope,
  JavaScriptMode,
  ServiceNowRelease,
  ServiceNowSettings,
} from "./types.js";
import {
  fluentNamingConventionOptions,
  noHardcodedSysidOptions,
  noHardcodedTableNamesOptions,
  optionDocsFromDescriptor,
  preferNowIncludeOptions,
  requireFluentIdOptions,
} from "./options/index.js";
import * as metadata from "./catalog-metadata.js";
import type { RuleOptionDoc, RuleOptionsDescriptor } from "./options/descriptor.js";

export type RuleFamily = "classic" | "fluent" | "engine";
export type RulePreset = "recommended" | "strict" | "classic-es5" | "es2021" | false;
export type RuleProfile =
  | "recommended"
  | "strict"
  | "classic-es5"
  | "es2021"
  | "client"
  | "acl"
  | "business-rule"
  | "fluent"
  | "policy"
  | "security";

export interface RulePlacement {
  profile: RuleProfile;
  severity: "warn" | "error";
}

export interface RuleApplicability {
  authoring: "classic" | "fluent" | "both";
  surfaces: string;
  javascriptMode: string;
  minimumSurfaceConfidence: metadata.SurfaceConfidence;
  javascriptModes: readonly JavaScriptMode[] | "n/a";
  scopes: readonly ApplicationScope[];
  serviceNowReleases: readonly ServiceNowRelease[];
  fluentSdkRange?: string;
}

const ES5: ServiceNowSettings = { javascriptMode: "es5" };
const PLATFORM_METHOD_AUTHORITY_FIXTURE = "tests/rules/platform-method-authority.test.ts";

function platformMethodAuthorityEvidence() {
  return metadata.evidenceRecord(
    PLATFORM_METHOD_AUTHORITY_FIXTURE,
    "Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.",
    "fixture",
    "2026-08-24",
  );
}

function platformMethodMutationLimitation(
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

export interface RuleExample {
  name: string;
  filename?: string;
  code: string;
  settings?: ServiceNowSettings;
}

export interface RuleLimitationCase extends RuleExample {
  caseId: string;
  kind: "false-positive" | "false-negative" | "scope-boundary";
  description: string;
}

export type { RuleOptionDoc };

export interface RuleCatalogEntry {
  name: string;
  implementation: Rule;
  ruleId: string;
  title: string;
  family: RuleFamily;
  preset: RulePreset;
  severity: "error" | "warn";
  fixable: boolean;
  hasSuggestions: boolean;
  description: string;
  docsUrl: string;
  bad: RuleExample[];
  good: RuleExample[];
  placements: readonly RulePlacement[];
  applicability: RuleApplicability;
  evidence: readonly metadata.RuleEvidenceRecord[];
  limitations: string;
  limitationCases: readonly RuleLimitationCase[];
  falsePositives: readonly string[];
  falseNegatives: readonly string[];
  scopeBoundaries: readonly string[];
  overlaps: readonly string[];
  lifecycleAssumptions?: string;
  limitationPreamble?: string;
  fixKind: "none" | "safe-fix" | "suggestion";
  optionDescriptor: RuleOptionsDescriptor<object> | undefined;
  options: readonly RuleOptionDoc[];
  lastVerified: string;
}

type RuleCatalogInput = Omit<
  RuleCatalogEntry,
  | "name"
  | "implementation"
  | "ruleId"
  | "docsUrl"
  | "applicability"
  | "limitations"
  | "falsePositives"
  | "falseNegatives"
  | "scopeBoundaries"
  | "fixKind"
  | "options"
  | "lastVerified"
  | "optionDescriptor"
> &
  metadata.RuleDocMetadata & {
    optionDescriptor: RuleOptionsDescriptor<object> | undefined;
    limitationCases: readonly RuleLimitationCase[];
  };

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
  } as Rule;
}

function entry<N extends string>(
  name: N,
  implementation: Rule,
  rest: RuleCatalogInput,
): RuleCatalogEntry & { name: N } {
  // Verification IDs identify a rule-to-evidence assertion, not only the
  // underlying URL and claim. Shared release evidence must therefore remain
  // independently auditable when several rules cite the same source cell.
  const evidence = metadata
    .releaseEvidenceForRule(name, rest.evidence)
    .map((item) =>
      metadata.evidenceRecord(
        item.url,
        item.claim,
        item.verifiedBy,
        item.verifiedAt,
        `rule:${name}`,
      ),
    );
  const applicability: RuleApplicability = {
    authoring: rest.applicability.authoring,
    surfaces: metadata.formatSurfaces(rest.applicability),
    javascriptMode: metadata.formatJavascriptModes(rest.applicability.javascriptModes),
    minimumSurfaceConfidence: rest.applicability.minimumSurfaceConfidence,
    javascriptModes: rest.applicability.javascriptModes,
    scopes: rest.applicability.scopes,
    serviceNowReleases: metadata.serviceNowReleasesForRule(name, rest.applicability.authoring),
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
    limitations: formatLimitations(
      rest.limitationCases,
      rest.lifecycleAssumptions,
      rest.limitationPreamble,
    ),
    falsePositives: rest.limitationCases
      .filter((item) => item.kind === "false-positive")
      .map((item) => item.description),
    falseNegatives: rest.limitationCases
      .filter((item) => item.kind === "false-negative")
      .map((item) => item.description),
    scopeBoundaries: rest.limitationCases
      .filter((item) => item.kind === "scope-boundary")
      .map((item) => item.description),
    fixKind: rest.fixable ? "safe-fix" : rest.hasSuggestions ? "suggestion" : "none",
    options: rest.optionDescriptor ? optionDocsFromDescriptor(rest.optionDescriptor) : [],
    lastVerified: metadata.latestEvidenceDate(evidence),
  };
}

export const ruleCatalog = [
  entry("no-hardcoded-sysid", noHardcodedSysid, {
    ...metadata.meta(
      metadata.classic(metadata.CLASSIC_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_FLUENT_CONSTRUCTS,
          "Named Fluent Now.ID keys are the supported portable identity, not raw sys_id literals.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-hardcoded-sysid.test.ts",
          "Literal, uppercase, concatenated, and static-template sys_ids report; exact allow-lists and structurally owned algorithm-specific hash contexts suppress.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/valid/hash-context.br.js",
          "Real Oxlint and ESLint valid-profile contracts preserve an outer MD5 owner across nested sibling expressions.",
          "integration-test",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-now-id-as-reference", "core no-restricted-syntax"],
      },
    ),
    placements: [{ profile: "recommended", severity: "error" }] as const,
    optionDescriptor: noHardcodedSysidOptions,
    limitationCases: [
      {
        caseId: "no-hardcoded-sysid-md5-owner",
        kind: "false-negative",
        description:
          "Default MD5-owner suppression can hide a real sys_id stored under an MD5-like name; set `ignoreHashNames: false` when that false-negative tradeoff is unacceptable.",
        name: "MD5-like owner",
        filename: "incident.br.js",
        code: `var expectedMd5 = "97c04b3b1b12100043ab85e5bd0713e2";`,
      },
    ],
    title: "No hardcoded sys_id",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Hardcoded 32-character sys_ids break when an app is installed on another instance. Store them in a system property, a named constant, or Fluent `Now.ID`.",
    bad: [
      {
        name: "literal sys_id",
        filename: "incident.br.js",
        code: `var assignmentGroup = "97c04b3b1b12100043ab85e5bd0713e2";\ncurrent.assignment_group = assignmentGroup;`,
      },
    ],
    good: [
      {
        name: "system property",
        filename: "incident.br.js",
        code: `var assignmentGroup = gs.getProperty("x_acme.default_assignment_group");\ncurrent.assignment_group = assignmentGroup;`,
      },
    ],
  }),
  entry("no-promise", noPromise, {
    ...metadata.meta(
      metadata.engine(metadata.ES5_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "Promises are unsupported in Compatibility and ES5 Standards modes.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-promise.test.ts",
          "Fixtures cover stable Promise constructor and static-method owner aliases, guarded alias capture, owner-and-method availability checks, modeled built-in invalidation, visible polyfills, mutation, and dynamic scope.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles.test.ts",
          "Real Oxlint and ESLint classic-es5 profiles report a stable Promise alias and accept an explicit callable polyfill.",
          "integration-test",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-async-await", "eslint no-restricted-globals"],
      },
    ),
    placements: [{ profile: "classic-es5", severity: "error" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-promise-local-binding",
        kind: "scope-boundary",
        description: "Local bindings named Promise are not platform Promises.",
        name: "local Promise binding",
        filename: "local-promise.server.js",
        settings: ES5,
        code: `function Promise() {}
Promise.resolve = function (value) { return value; };
Promise.resolve(1);`,
      },
      {
        caseId: "no-promise-visible-polyfill",
        kind: "scope-boundary",
        description:
          "A possible callable replacement for Promise or a used static method suppresses matching diagnostics throughout the file, regardless of source order.",
        name: "visible Promise polyfill",
        filename: "polyfill.server.js",
        settings: ES5,
        code: `Promise = LocalPromise;
var ready = Promise.resolve(1);`,
      },
      {
        caseId: "no-promise-availability-guard",
        kind: "scope-boundary",
        description:
          "A constructor call protected by a structurally dominating owner guard stays silent; static calls require both the Promise owner and selected method to be guarded.",
        name: "availability guard",
        filename: "portable.server.js",
        settings: ES5,
        code: `if (typeof Promise === "function") {
  new Promise(function () {});
}`,
      },
      {
        caseId: "no-promise-cross-execution-alias",
        kind: "false-negative",
        description:
          "A Promise alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
        name: "cross-execution alias",
        filename: "deferred.server.js",
        settings: ES5,
        code: `const P = Promise;
function create() { return new P(function () {}); }
create();`,
      },
      {
        caseId: "no-promise-static-method-alias",
        kind: "false-negative",
        description:
          "Direct aliases of individual Promise static methods stay silent; the shared resolver proves stable aliases of the Promise owner instead.",
        name: "static method alias",
        filename: "method-alias.server.js",
        settings: ES5,
        code: `const resolve = Promise.resolve;
resolve(1);`,
      },
    ],
    title: "No Promise",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Compatibility and ES5 Standards modes do not implement Promises. Direct calls plus stable same-execution constructor and static-method owner aliases report; bare aliases must be captured under an owner guard, while fully guarded, visibly polyfilled, unknown-mode, and local `Promise` uses stay silent.",
    bad: [
      {
        name: "constructor",
        filename: "script-include.js",
        settings: ES5,
        code: `var p = new Promise(function (resolve) { resolve(1); });`,
      },
    ],
    good: [
      {
        name: "synchronous Glide",
        filename: "script-include.js",
        code: `var gr = new GlideRecord("incident");\nif (gr.get(sysId)) {\n  gs.info(gr.number);\n}`,
      },
    ],
  }),
  entry("no-async-await", noAsyncAwait, {
    ...metadata.meta(
      metadata.engine(metadata.ES5_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "async/await is unsupported in Compatibility and ES5 Standards modes.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-async-await.test.ts",
          "async functions and await expressions report in ES5 mode.",
          "fixture",
          "2026-08-20",
        ),
      ],
      {
        overlaps: ["servicenow/no-promise", "servicenow/no-async-iterators"],
      },
    ),
    placements: [{ profile: "classic-es5", severity: "error" }] as const,
    optionDescriptor: undefined,
    limitationCases: [],
    title: "No async/await",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "async/await is not implemented in Compatibility or ES5 Standards mode.",
    bad: [
      {
        name: "async function",
        filename: "script-include.js",
        settings: ES5,
        code: `async function loadIncident(id) {\n  return await fetchIncident(id);\n}`,
      },
    ],
    good: [
      {
        name: "sync function",
        filename: "script-include.js",
        code: `function loadIncident(id) {\n  var gr = new GlideRecord("incident");\n  return gr.get(id) ? gr : null;\n}`,
      },
    ],
  }),
  entry("no-bigint", noBigint, {
    ...metadata.meta(
      metadata.engine(metadata.ES5_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "BigInt is unsupported in Compatibility and ES5 Standards modes.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-bigint.test.ts",
          "BigInt literals, stable call aliases, guarded capture, modeled invalidation, visible polyfills, shadowing, and dynamic scope are covered.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles.test.ts",
          "Real Oxlint and ESLint classic-es5 profiles report a stable BigInt alias and accept an explicit callable polyfill.",
          "integration-test",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-unsupported-syntax"],
      },
    ),
    placements: [{ profile: "classic-es5", severity: "error" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-bigint-visible-polyfill",
        kind: "scope-boundary",
        description:
          "A possible callable BigInt replacement suppresses call diagnostics throughout the file, regardless of source order; BigInt literal diagnostics are unaffected.",
        name: "visible BigInt polyfill",
        filename: "polyfill.server.js",
        settings: ES5,
        code: `BigInt = LocalBigInt;
var value = BigInt(10);`,
      },
      {
        caseId: "no-bigint-availability-guard",
        kind: "scope-boundary",
        description:
          "A call protected by a structurally dominating BigInt availability guard stays silent for code shared with another runtime.",
        name: "availability guard",
        filename: "portable.server.js",
        settings: ES5,
        code: `if (typeof BigInt === "function") {
  BigInt(10);
}`,
      },
      {
        caseId: "no-bigint-cross-execution-alias",
        kind: "false-negative",
        description:
          "A BigInt alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
        name: "cross-execution alias",
        filename: "deferred.server.js",
        settings: ES5,
        code: `const ToBigInt = BigInt;
function convert() { return ToBigInt(10); }
convert();`,
      },
    ],
    title: "No BigInt",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "BigInt literals and `BigInt()` are unsupported in Compatibility or ES5 Standards mode. Direct calls and stable same-execution aliases report; bare aliases must be captured under an availability guard, while visibly polyfilled, guarded, unknown-mode, and local `BigInt` calls stay silent.",
    bad: [
      {
        name: "literal",
        filename: "script-include.js",
        settings: ES5,
        code: `var n = 9007199254740993n;`,
      },
    ],
    good: [{ name: "number", filename: "script-include.js", code: `var n = 9007199254740991;` }],
  }),
  entry("prefer-glideaggregate", preferGlideaggregate, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GA_AUSTRALIA,
          "The Australia GlideAggregate API documents database-side COUNT and other aggregate queries.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_GA_GLOBAL_AUSTRALIA,
          "The Australia global GlideAggregate API provides the same database aggregation surface.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_GR_AUSTRALIA,
          "The Australia GlideRecord API recommends GlideAggregate when only a record count is needed because it does not retrieve matching records.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/rules/prefer-glideaggregate.test.ts",
          "Iterate-to-count loops using next() or _next() report; if (gr.next()) stays silent.",
          "fixture",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/validate-glideaggregate-calls"],
      },
    ),
    placements: [{ profile: "strict", severity: "warn" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "prefer-glideaggregate-file-wide-mutation",
        `var gr = new GlideRecord("incident");
gr.getRowCount();
gr.getRowCount = localCount;`,
      ),
    ],
    title: "Prefer GlideAggregate",
    family: "classic",
    preset: "strict",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "`GlideRecord.getRowCount()` (and iterate-to-count loops) load every matching row. `GlideAggregate` counts in the database.",
    bad: [
      {
        name: "getRowCount",
        filename: "incident.br.js",
        code: `var gr = new GlideRecord("incident");\ngr.addActiveQuery();\ngr.query();\nvar count = gr.getRowCount();`,
      },
    ],
    good: [
      {
        name: "GlideAggregate COUNT",
        filename: "incident.br.js",
        code: `var ga = new GlideAggregate("incident");\nga.addActiveQuery();\nga.addAggregate("COUNT");\nga.query();\nvar count = ga.next() ? parseInt(ga.getAggregate("COUNT"), 10) : 0;`,
      },
    ],
  }),
  entry("no-client-gliderecord", noClientGliderecord, {
    ...metadata.meta(
      metadata.classic(metadata.CLIENT_SURFACES, "n/a", ["scoped"]),
      [
        metadata.evidenceRecord(
          metadata.SN_CLIENT_GR,
          "The Australia client GlideRecord API is unsupported in scoped applications.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_CLIENT_BEST_PRACTICES,
          "ServiceNow no longer recommends client GlideRecord or getReference for performance because they retrieve all fields.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/client-gliderecord.client.js",
          "Recommended Oxlint and ESLint flag GlideRecord in client files.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/context-contracts.test.ts",
          "Oxlint and ESLint flag direct, global namespace, computed, stable aliased, and destructured constructors without leaking mutually exclusive alias assignments.",
          "integration-test",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-client-gliderecord.test.ts",
          "Adversarial fixtures cover branch order, alias writes and dominance, shadowing, dynamic scope, namespace escape, and visible platform replacement.",
          "fixture",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/require-query-before-next"],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "client", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-client-gliderecord-mixed-ui-action",
        kind: "scope-boundary",
        description:
          "Mixed client/server UI Actions stay silent because the rule cannot classify execution regions.",
        name: "mixed UI Action",
        filename: "mixed.ui-action.js",
        settings: { authoring: "classic", surfaces: ["ui-action", "client", "server"] },
        code: `var record = new GlideRecord("incident");`,
      },
      {
        caseId: "no-client-gliderecord-global-scope",
        kind: "scope-boundary",
        description:
          "Global and unknown application scope stay silent because ServiceNow documents the client API in global applications and only marks scoped applications unsupported.",
        name: "global client script",
        filename: "global.client.js",
        settings: { authoring: "classic", surfaces: ["client"], scope: "global" },
        code: `var record = new GlideRecord("incident");`,
      },
      {
        caseId: "no-client-gliderecord-mutable-alias",
        kind: "false-negative",
        description:
          "Aliases assigned outside their declaration stay silent even when every visible branch selects a platform constructor; proving that identity requires path-sensitive constructor-value analysis.",
        name: "mutable constructor alias",
        filename: "conditional.client.js",
        settings: { authoring: "classic", surfaces: ["client"], scope: "scoped" },
        code: `var GR;
if (condition) {
  GR = GlideRecord;
} else {
  GR = GlideRecordSecure;
}
new GR("incident");`,
      },
      {
        caseId: "no-client-gliderecord-cross-execution-alias",
        kind: "false-negative",
        description:
          "Aliases used from another function body stay silent because source order alone cannot prove that the initializer ran before the function was called.",
        name: "cross-execution constructor alias",
        filename: "deferred.client.js",
        settings: { authoring: "classic", surfaces: ["client"], scope: "scoped" },
        code: `var GR = GlideRecord;
function run() {
  new GR("incident");
}`,
      },
      {
        caseId: "no-client-gliderecord-file-wide-replacement",
        kind: "false-negative",
        description:
          "A possible platform-constructor or namespace replacement suppresses matching calls throughout the file, including calls that appear before the replacement; source order alone does not establish runtime order across function bodies.",
        name: "later constructor replacement",
        filename: "replaced.client.js",
        settings: { authoring: "classic", surfaces: ["client"], scope: "scoped" },
        code: `new GlideRecord("incident");
GlideRecord = LocalRecord;`,
      },
    ],
    title: "No client GlideRecord",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Proven platform GlideRecord calls are unsupported in scoped client applications. Query on the server with GlideAjax or Scripted REST.",
    bad: [
      {
        name: "client script",
        filename: "incident.client.js",
        settings: { scope: "scoped" },
        code: `function onChange() {\n  var gr = new GlideRecord("sys_user");\n  gr.addQuery("user_name", g_user.userName);\n  gr.query();\n}`,
      },
    ],
    good: [
      {
        name: "GlideAjax",
        filename: "incident.client.js",
        code: `function onChange() {\n  var ga = new GlideAjax("x_acme.UserUtils");\n  ga.addParam("sysparm_name", "getUser");\n  ga.getXMLAnswer(function (answer) {\n    g_form.setValue("caller_id", answer);\n  });\n}`,
      },
    ],
  }),
  entry("no-gs-now", noGsNow, {
    ...metadata.meta(
      metadata.classic(metadata.CLASSIC_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GDT,
          "gs.now() and gs.nowDateTime() return display strings, not GlideDateTime objects.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/fixtures/bad-business-rule.br.js",
          "Host fixtures report gs.now on Business Rule files.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/context-contracts.test.ts",
          "Oxlint and ESLint stay silent when visible writes make the gs global or target method identity unknown.",
          "integration-test",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-display-value-date-comparison"],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "client", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-gs-now-local-object",
        kind: "scope-boundary",
        description: "Local objects named gs are not the platform global.",
        name: "local gs object",
        filename: "local-gs.server.js",
        code: `var gs = { now: function () { return "local"; } };
gs.now();`,
      },
      {
        caseId: "no-gs-now-file-wide-mutation",
        kind: "false-negative",
        description:
          "A possible gs or target-method mutation suppresses every matching call in the file, including calls that appear before the mutation.",
        name: "later gs method mutation",
        filename: "mutated-gs.server.js",
        code: `gs.now();
gs.now = localNow;`,
      },
    ],
    title: "No gs.now()",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`gs.now()` and `gs.nowDateTime()` return timezone-sensitive display strings. `gs.now()` is also gone from client scripts since London. Prefer `new GlideDateTime()`.",
    bad: [
      { name: "gs.now", filename: "incident.br.js", code: `current.u_opened = gs.now();` },
      {
        name: "gs.nowDateTime",
        filename: "incident.br.js",
        code: `current.u_opened = gs.nowDateTime();`,
      },
    ],
    good: [
      {
        name: "GlideDateTime",
        filename: "incident.br.js",
        code: `current.u_opened = new GlideDateTime();`,
      },
    ],
  }),
  entry("require-query-before-next", requireQueryBeforeNext, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "query(), _query(), and get() execute a query before next() or _next() advances the cursor.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_GR_GLOBAL,
          "queryNoDomain() is documented on the global API and executes a query while ignoring domains.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/binding-host-contracts.test.ts",
          "Oxlint and ESLint enforce _query(), _next(), and scope-sensitive queryNoDomain() lifecycle contracts.",
          "integration-test",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/rules/stateful-lifecycle.test.ts",
          "Aliases, sibling reassignment, and completion-aware paths are unit-tested.",
          "fixture",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: [
          "servicenow/validate-gliderecord-calls",
          "servicenow/validate-glideaggregate-calls",
        ],
        lifecycleAssumptions:
          "Executors are selected by release and scope. A possible scope-specific executor suppresses a missing-query finding without becoming a definite fact for positive rules. chooseWindow does not execute a query.",
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "require-query-before-next-queried-alias",
        kind: "scope-boundary",
        description: "A query through a proven alias opens the same record cursor.",
        name: "queried alias",
        filename: "queried-alias.server.js",
        code: `var record = new GlideRecord("incident");
var alias = record;
alias.query();
record.next();`,
      },
      platformMethodMutationLimitation(
        "require-query-before-next-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.next();
record.next = localNext;`,
      ),
    ],
    title: "Require query before next",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Require a documented, scope-supported GlideRecord query executor before `.next()` or `._next()`. A cursor advance reports when a reachable path lacks even a possible executor for the configured scope; unproven receivers stay silent.",
    bad: [
      {
        name: "next without query",
        filename: "incident.br.js",
        code: `var gr = new GlideRecord("incident");\ngr.addActiveQuery();\ngr.next();`,
      },
    ],
    good: [
      {
        name: "query + checked next",
        filename: "incident.br.js",
        code: `var gr = new GlideRecord("incident");\ngr.addActiveQuery();\ngr.query();\nwhile (gr.next()) {\n  gs.info(gr.number);\n}`,
      },
    ],
  }),
  entry("validate-gliderecord-calls", validateGliderecordCalls, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR_GLOBAL,
          "Deprecated compatibility rule. Prefer require-query-before-next for query lifecycle.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/catalog.test.ts",
          "The rule remains exported and off by default.",
          "fixture",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/require-query-before-next"],
      },
    ),
    placements: [] as const,
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "validate-gliderecord-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.update();
record.update = localUpdate;`,
      ),
    ],
    title: "Validate GlideRecord calls",
    family: "classic",
    preset: false,
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Deprecated alias. Prefer `require-query-before-next`. Still reports missing query-before-cursor-advance and unused insert/update/deleteRecord/get/next/_next returns. `chooseWindow()` does not open a cursor.",
    bad: [
      {
        name: "next without query",
        filename: "incident.br.js",
        code: `var gr = new GlideRecord("incident");\ngr.addActiveQuery();\ngr.next();\ngr.insert();`,
      },
    ],
    good: [
      {
        name: "query + checked next",
        filename: "incident.br.js",
        code: `var gr = new GlideRecord("incident");\ngr.addActiveQuery();\ngr.query();\nwhile (gr.next()) {\n  gs.info(gr.number);\n}`,
      },
    ],
  }),
  entry("no-br-current-update", noBrCurrentUpdate, {
    ...metadata.meta(
      metadata.classic(["business-rule"]),
      [
        metadata.evidenceRecord(
          metadata.SN_BR,
          "Business Rules should not call current.update() because the engine already writes the row.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/fixtures/bad-business-rule.br.js",
          "Host fixtures report current.update on Business Rule files.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/context-contracts.test.ts",
          "Oxlint and ESLint stay silent when visible current binding replacement makes identity uncertain while canonical wrapper calls still report.",
          "integration-test",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/rules/layer3-consumers.test.ts",
          "Canonical wrapper fixtures distinguish the required synchronous current argument from pre-call escape, receiver replacement, and GlideRecord prototype mutation.",
          "fixture",
          "2026-08-24",
        ),
      ],
      {
        overlaps: [],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-br-current-update-file-wide-reassignment",
        kind: "false-negative",
        description:
          "A possible current reassignment suppresses direct current.update calls throughout the file, including calls that appear before the reassignment.",
        name: "later current reassignment",
        filename: "reassigned.br.js",
        code: `current.update();
current = getOtherRecord();`,
      },
      {
        caseId: "no-br-current-update-method-mutation",
        kind: "false-negative",
        description:
          "A possible current.update or GlideRecord.prototype.update mutation suppresses matching calls throughout the file.",
        name: "visible update replacement",
        filename: "mutated-method.br.js",
        code: `current.update = localUpdate;
current.update();`,
      },
    ],
    title: "No current.update() in Business Rules",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`current.update()` retriggers other Business Rules and can recurse. Set fields on `current` and let the platform save. Reports only when the file is a Business Rule. Shadowed `current` bindings are ignored.",
    bad: [
      {
        name: "current.update",
        filename: "incident.br.js",
        code: `current.state = 2;\ncurrent.update();`,
      },
    ],
    good: [
      {
        name: "assign and return",
        filename: "incident.br.js",
        code: `current.state = 2;\ncurrent.work_notes = "Moved to In Progress";`,
      },
    ],
  }),
  entry("no-hardcoded-table-names", noHardcodedTableNames, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "Table names passed to GlideRecord constructors are string identities that do not rename safely.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/glide-and-engine.test.ts",
          "Literal tables report; named constants and allow-lists stay silent.",
          "fixture",
          "2026-08-20",
        ),
      ],
      {
        overlaps: ["servicenow/fluent-naming-convention"],
      },
    ),
    placements: [{ profile: "policy", severity: "warn" }] as const,
    optionDescriptor: noHardcodedTableNamesOptions,
    limitationCases: [],
    title: "No hardcoded table names",
    family: "classic",
    preset: false,
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Optional organizational policy. String-literal table names in `GlideRecord` / `GlideRecordSecure` / `GlideAggregate` are hard to rename. Prefer named constants or Fluent table exports.",
    bad: [
      {
        name: "literal table",
        filename: "incident.br.js",
        code: `var gr = new GlideRecord("x_acme_widget");`,
      },
    ],
    good: [
      {
        name: "named constant",
        filename: "incident.br.js",
        code: `var TABLE = { WIDGET: "x_acme_widget" };\nvar gr = new GlideRecord(TABLE.WIDGET);`,
      },
    ],
  }),
  entry("fluent-proper-imports", fluentProperImports, {
    ...metadata.meta(
      metadata.fluent(),
      [
        metadata.evidenceRecord(
          metadata.SN_FLUENT,
          "Fluent factories are imported from the documented @servicenow/sdk modules.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/fixtures/bad-fluent.now.ts",
          "Host fixtures report factories imported from the wrong module.",
          "integration-test",
          "2026-08-20",
        ),
      ],
      {
        overlaps: ["servicenow/require-fluent-id"],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "fluent", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "fluent-proper-imports-local-factory",
        kind: "scope-boundary",
        description: "Local functions that share a Fluent factory name are not SDK factories.",
        name: "local factory function",
        filename: "local-factory.now.ts",
        code: `function BusinessRule(value) { return value; }
BusinessRule({ table: "incident" });`,
      },
    ],
    title: "Fluent imports from @servicenow/sdk/core",
    family: "fluent",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Fluent entity and column APIs must be imported from the module recorded in the selected SDK manifest. Aliases and namespace imports resolve by lexical binding identity.",
    bad: [
      {
        name: "wrong module",
        filename: "incident.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk";\n\nBusinessRule({\n  $id: Now.ID["log-change"],\n  table: "incident",\n  name: "Log change",\n  when: "after",\n  action: ["update"],\n});`,
      },
    ],
    good: [
      {
        name: "core import",
        filename: "incident.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-change"],\n  table: "incident",\n  name: "Log change",\n  when: "after",\n  action: ["update"],\n});`,
      },
    ],
  }),
  entry("fluent-directives", fluentDirectives, {
    ...metadata.meta(
      metadata.fluent(),
      [
        metadata.evidenceRecord(
          metadata.SN_FLUENT,
          "The documented Fluent directives are line- or file-scoped comments consumed by the SDK toolchain.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/dangling-fluent-ignore.now.ts",
          "A trailing @fluent-ignore without a following statement reports.",
          "integration-test",
          "2026-08-20",
        ),
      ],
      {
        overlaps: [],
      },
    ),
    placements: [
      { profile: "recommended", severity: "warn" },
      { profile: "fluent", severity: "warn" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "fluent-directives-no-lint-suppression",
        kind: "scope-boundary",
        description:
          "ServiceNow Fluent directives are SDK controls; they are not Oxlint or ESLint disable comments and do not suppress this plugin's diagnostics.",
        name: "lint suppression boundary",
        filename: "incident.now.ts",
        code: `import { Record } from "@servicenow/sdk/core";

// @fluent-ignore
Record({ table: "incident", data: {} });`,
      },
    ],
    title: "Fluent directives",
    family: "fluent",
    preset: "recommended",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Validate documented ServiceNow Fluent SDK directive names and placement. SDK directives are not Oxlint or ESLint disable comments.",
    bad: [
      {
        name: "typo + ts-ignore",
        filename: "incident.now.ts",
        code: `// @ts-ignore\n// @fluent-ignre\nexport const demo = 1;`,
      },
    ],
    good: [
      {
        name: "documented directive",
        filename: "incident.now.ts",
        code: `// @fluent-disable-sync\nimport { Record } from "@servicenow/sdk/core";\n\nRecord({\n  $id: Now.ID["seed-incident"],\n  table: "incident",\n  data: { short_description: "Seed" },\n});`,
      },
    ],
  }),
  entry("prefer-now-include", preferNowInclude, {
    ...metadata.meta(
      metadata.fluent(),
      [
        metadata.evidenceRecord(
          metadata.SN_FLUENT_CONSTRUCTS,
          "Now.include() loads script and markup files so Fluent metadata stays declarative.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "src/catalog.ts",
          "Catalog examples cover large inline script versus Now.include.",
          "fixture",
          "2026-08-20",
        ),
      ],
      {
        overlaps: ["servicenow/no-complex-fluent-logic"],
      },
    ),
    placements: [{ profile: "strict", severity: "warn" }] as const,
    optionDescriptor: preferNowIncludeOptions,
    limitationCases: [],
    title: "Prefer Now.include()",
    family: "fluent",
    preset: "strict",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Large inline `script` / HTML / CSS payloads belong in their own file and should be loaded with `Now.include()`.",
    bad: [
      {
        name: "inline novel",
        filename: "log-state.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-state"],\n  table: "incident",\n  name: "Log state",\n  when: "after",\n  action: ["update"],\n  script: \`\n    (function executeRule(current, previous) {\n      var gr = new GlideRecord("sys_journal_field");\n      gr.initialize();\n      gr.element_id = current.sys_id;\n      gr.value = "state changed";\n      gr.insert();\n      gs.info(current.number);\n      gs.info(previous.state);\n      gs.info(current.state);\n    })(current, previous);\n  \`,\n});`,
      },
    ],
    good: [
      {
        name: "Now.include",
        filename: "log-state.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-state"],\n  table: "incident",\n  name: "Log state",\n  when: "after",\n  action: ["update"],\n  script: Now.include("../server/log-state.server.js"),\n});`,
      },
    ],
  }),
  entry("require-fluent-id", requireFluentId, {
    ...metadata.meta(
      metadata.fluent(),
      [
        metadata.evidenceRecord(
          metadata.SN_FLUENT_CONSTRUCTS,
          "Factories whose manifest marks $id as required must declare Now.ID or an equivalent id.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/fluent-alias-missing-id.now.ts",
          "Aliased factory imports still require $id under recommended.",
          "integration-test",
          "2026-08-20",
        ),
      ],
      {
        overlaps: ["servicenow/no-duplicate-fluent-id", "servicenow/no-now-id-as-reference"],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "fluent", severity: "error" },
    ] as const,
    optionDescriptor: requireFluentIdOptions,
    limitationCases: [],
    title: "Require Fluent $id",
    family: "fluent",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Fluent entities must declare `$id` when the selected SDK manifest marks the imported factory as requiring an id. Prefer canonical `Now.ID['descriptive-key']`.",
    bad: [
      {
        name: "missing $id",
        filename: "log-state.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  table: "incident",\n  name: "Log state",\n  when: "after",\n  action: ["update"],\n});`,
      },
    ],
    good: [
      {
        name: "Now.ID",
        filename: "log-state.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-state"],\n  table: "incident",\n  name: "Log state",\n  when: "after",\n  action: ["update"],\n});`,
      },
    ],
  }),
  entry("fluent-naming-convention", fluentNamingConvention, {
    ...metadata.meta(
      metadata.fluent(),
      [
        metadata.evidenceRecord(
          metadata.SN_FLUENT,
          "Fluent file stems and Now.ID keys should stay stable kebab-case or snake_case identifiers.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "src/catalog.ts",
          "Catalog examples cover PascalCase files and kebab-case corrections.",
          "fixture",
          "2026-08-20",
        ),
      ],
      {
        overlaps: ["servicenow/require-fluent-id"],
      },
    ),
    placements: [{ profile: "strict", severity: "warn" }] as const,
    optionDescriptor: fluentNamingConventionOptions,
    limitationCases: [],
    title: "Fluent naming convention",
    family: "fluent",
    preset: "strict",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "`.now.ts` files and `Now.ID` keys should be kebab-case. Exported `Table` bindings should match the table `name`.",
    bad: [
      {
        name: "PascalCase file + id",
        filename: "LogState.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["LogState"],\n  table: "incident",\n  name: "Log state",\n});`,
      },
    ],
    good: [
      {
        name: "kebab-case",
        filename: "log-state.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-state"],\n  table: "incident",\n  name: "Log state",\n});`,
      },
    ],
  }),
  entry("no-complex-fluent-logic", noComplexFluentLogic, {
    ...metadata.meta(
      metadata.fluent(),
      [
        metadata.evidenceRecord(
          metadata.SN_FLUENT,
          "Fluent .now.ts files declare metadata; runtime loops belong in src/server.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/fluent.test.ts",
          "Fixtures cover loops, async functions, function expressions, and arrow-function complexity thresholds.",
          "fixture",
          "2026-08-22",
        ),
      ],
      {
        overlaps: ["servicenow/prefer-now-include"],
      },
    ),
    placements: [{ profile: "policy", severity: "warn" }] as const,
    optionDescriptor: undefined,
    limitationCases: [],
    title: "No complex Fluent logic",
    family: "fluent",
    preset: false,
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Optional architectural policy. `.now.ts` files should declare metadata. Loops, classes, try/catch, and multi-statement functions belong in `src/server/`. Not enabled in recommended or strict.",
    bad: [
      {
        name: "runtime loop",
        filename: "seed.now.ts",
        code: `import { Record } from "@servicenow/sdk/core";\n\nfor (var i = 0; i < 10; i++) {\n  Record({\n    $id: Now.ID["seed-" + i],\n    table: "incident",\n    data: { short_description: "n" },\n  });\n}`,
      },
    ],
    good: [
      {
        name: "declarative records",
        filename: "seed.now.ts",
        code: `import { Record } from "@servicenow/sdk/core";\n\nRecord({\n  $id: Now.ID["seed-incident"],\n  table: "incident",\n  data: { short_description: "Seed" },\n});`,
      },
    ],
  }),
  entry("no-at-method", noAtMethod, {
    ...metadata.meta(
      metadata.engine(metadata.ES5_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "Array.prototype.at is unsupported in Compatibility and ES5 Standards modes.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "String.prototype.at is unsupported in Compatibility and ES5 Standards modes.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-at-method.test.ts",
          "Fixtures cover Array/String prototype authority, modeled built-in replacement, dynamic scope, dominating feature guards, optional invocation, and shadowed near misses.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles.test.ts",
          "Real Oxlint and ESLint classic-ES5 profiles accept an explicit Array.prototype.at polyfill.",
          "integration-test",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-unsupported-syntax"],
      },
    ),
    placements: [{ profile: "classic-es5", severity: "error" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-at-method-unknown-receiver",
        kind: "scope-boundary",
        description: "Unknown receivers with a method named at stay silent.",
        name: "unknown receiver",
        filename: "unknown-at.server.js",
        settings: ES5,
        code: `customCollection.at(0);`,
      },
      {
        caseId: "no-at-method-visible-polyfill",
        kind: "scope-boundary",
        description:
          "A possible Array or String constructor, prototype, or at-method replacement suppresses matching diagnostics throughout the file, regardless of source order.",
        name: "visible Array.at polyfill",
        filename: "polyfill.server.js",
        settings: ES5,
        code: `Array.prototype.at = localAt;
var last = [1, 2].at(-1);`,
      },
    ],
    title: "No .at()",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`.at()` is not implemented in Compatibility or ES5 Standards mode. Proven array/string literal receivers report unless the matching built-in authority is visibly replaced or a structural prototype-availability guard protects the call.",
    bad: [
      {
        name: "at",
        filename: "script-include.js",
        settings: ES5,
        code: `var last = [1, 2].at(-1);`,
      },
    ],
    good: [
      { name: "index", filename: "script-include.js", code: `var last = list[list.length - 1];` },
      {
        name: "guarded polyfill use",
        filename: "portable.server.js",
        settings: ES5,
        code: `if (typeof Array.prototype.at === "function") {
  var last = [1, 2].at(-1);
}`,
      },
    ],
  }),
  entry("no-packages-calls", noPackagesCalls, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_PACKAGES_REMOVAL,
          "The Australia Packages Call Removal Tool says Packages calls to ServiceNow Java classes will be prevented in a future release.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/rules/glide-and-engine.test.ts",
          "Fixtures cover static and dynamic Packages access versus local bindings named Packages.",
          "fixture",
          "2026-08-21",
        ),
      ],
      {
        overlaps: [],
      },
    ),
    placements: [{ profile: "policy", severity: "warn" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "packages-non-servicenow-java-class",
        kind: "false-positive",
        description:
          "The syntax-only review also flags Java classes outside the scope of the ServiceNow class-removal tool.",
        name: "non-ServiceNow Java class",
        filename: "src/server/java-bridge.js",
        code: `var value = new Packages.java.lang.String("value");`,
      },
      {
        caseId: "packages-mid-server-execution",
        kind: "false-positive",
        description:
          "Static source alone cannot prove that a record executes on a MID Server, which Australia documents as a separate review outcome.",
        name: "MID Server execution boundary",
        filename: "src/server/mid-probe.js",
        code: `var probe = Packages.com.glide.util.NetProbe;`,
      },
    ],
    title: "Review Packages.*",
    family: "classic",
    preset: false,
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Optional migration policy. Review Rhino `Packages.*` bridge calls; Australia's removal tool specifically targets ServiceNow Java classes and distinguishes MID Server execution.",
    bad: [
      {
        name: "Packages call",
        filename: "script-include.js",
        code: `var result = Packages.com.glide.sys.GlideSystem.now();`,
      },
    ],
    good: [
      {
        name: "Glide API",
        filename: "script-include.js",
        code: `var result = new GlideDateTime();`,
      },
    ],
  }),
  entry("no-weak-references", noWeakReferences, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES, metadata.ALL_INSTANCE_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "WeakRef and FinalizationRegistry are unsupported in instance JavaScript modes.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/unsupported-constructors.test.ts",
          "Fixtures cover stable aliases, guarded alias capture, built-in guard invalidation, callable polyfills, non-callable replacements, lexical shadows, and dynamic scope.",
          "fixture",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-weak-collections"],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "classic-es5", severity: "error" },
      { profile: "es2021", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "weak-reference-visible-polyfill",
        kind: "scope-boundary",
        description:
          "A possible callable replacement for WeakRef or FinalizationRegistry suppresses matching diagnostics throughout the file, regardless of source order.",
        name: "visible WeakRef polyfill",
        filename: "polyfill.server.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `WeakRef = LocalWeakRef;
var reference = new WeakRef(value);`,
      },
      {
        caseId: "weak-reference-availability-guard",
        kind: "scope-boundary",
        description:
          "A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.",
        name: "availability guard",
        filename: "portable.server.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `if (typeof WeakRef === "function") {
  new WeakRef(value);
}`,
      },
      {
        caseId: "weak-reference-cross-execution-alias",
        kind: "false-negative",
        description:
          "A constructor alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
        name: "cross-execution alias",
        filename: "deferred.server.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `const Ref = WeakRef;
function create(value) { return new Ref(value); }
create(value);`,
      },
    ],
    title: "No WeakRef / FinalizationRegistry",
    family: "engine",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "WeakRef and FinalizationRegistry are disallowed in every instance JavaScript mode, including ES2021. Direct calls and stable same-execution aliases report; a bare alias must be captured inside its availability guard, while visibly polyfilled calls stay silent.",
    bad: [{ name: "WeakRef", filename: "script-include.js", code: `var ref = new WeakRef(obj);` }],
    good: [{ name: "Map", filename: "script-include.js", code: `var cache = new Map();` }],
  }),
  entry("no-weak-collections", noWeakCollections, {
    ...metadata.meta(
      metadata.engine(metadata.ES5_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "WeakMap and WeakSet are unsupported in Compatibility and ES5 Standards modes.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/unsupported-constructors.test.ts",
          "Fixtures cover WeakMap aliases, guarded alias capture, availability invalidation, and shared constructor-provenance behavior.",
          "fixture",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-weak-references"],
      },
    ),
    placements: [{ profile: "classic-es5", severity: "error" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "weak-collection-visible-polyfill",
        kind: "scope-boundary",
        description:
          "A possible callable replacement for WeakMap or WeakSet suppresses matching diagnostics throughout the file, regardless of source order.",
        name: "visible WeakMap polyfill",
        filename: "polyfill.server.js",
        settings: ES5,
        code: `WeakMap = LocalWeakMap;
var cache = new WeakMap();`,
      },
      {
        caseId: "weak-collection-availability-guard",
        kind: "scope-boundary",
        description:
          "A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.",
        name: "availability guard",
        filename: "portable.server.js",
        settings: ES5,
        code: `if (typeof WeakMap === "function") {
  new WeakMap();
}`,
      },
    ],
    title: "No WeakMap / WeakSet",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "WeakMap and WeakSet are disallowed in Compatibility and ES5 Standards mode. ES2021 supports them. Direct calls and stable same-execution aliases report; bare aliases captured before a later guard still report, while visibly polyfilled calls stay silent.",
    bad: [
      {
        name: "WeakMap",
        filename: "script-include.js",
        settings: ES5,
        code: `var cache = new WeakMap();`,
      },
    ],
    good: [
      { name: "Map", filename: "script-include.js", settings: ES5, code: `var cache = new Map();` },
    ],
  }),
  entry("no-object-hasown", noObjectHasown, {
    ...metadata.meta(
      metadata.engine(metadata.ALL_INSTANCE_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "The Zurich table marks Object.hasOwn Not Supported in ES2021 and ES5 Standards.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES_AUSTRALIA,
          "The Australia table marks Object.hasOwn Supported in ES2021 and Not Supported in ES5 Standards.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_JS_MODES,
          "ServiceNow documents Compatibility as a third mode; the plugin explicitly applies ES5 feature cells to it as package policy.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/rules/glide-and-engine.test.ts",
          "Fixtures cover release deltas, immutable aliases, reassignment, computed access, shadowing, mutation, and namespace escape.",
          "fixture",
          "2026-08-22",
        ),
      ],
      {
        overlaps: [],
      },
    ),
    placements: [
      { profile: "classic-es5", severity: "error" },
      { profile: "es2021", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "object-hasown-dynamic-property",
        kind: "scope-boundary",
        description: "Dynamic property names stay silent because they do not prove a hasOwn call.",
        name: "dynamic property",
        filename: "dynamic-object.server.js",
        settings: { javascriptMode: "es5", release: "australia" },
        code: `Object[method](record, "number");`,
      },
      {
        caseId: "object-hasown-visible-replacement",
        kind: "scope-boundary",
        description:
          "Any possible direct write to Object or Object.hasOwn in the file conservatively suppresses diagnostics for that file, regardless of source order.",
        name: "visible Object.hasOwn replacement",
        filename: "polyfill.server.js",
        settings: { javascriptMode: "es5", release: "australia" },
        code: `Object.hasOwn = polyfill;
Object.hasOwn(record, "number");`,
      },
      {
        caseId: "object-hasown-escaped-namespace",
        kind: "scope-boundary",
        description:
          "Passing Object to an unknown call or constructor suppresses diagnostics because that code can install replacement methods on the namespace object.",
        name: "escaped Object namespace",
        filename: "polyfill.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `installPolyfills(Object);
Object.hasOwn(record, "number");`,
      },
      {
        caseId: "object-hasown-availability-guard",
        kind: "scope-boundary",
        description:
          "Calls protected by a proven Object.hasOwn availability guard or optional call stay silent for release-portable code.",
        name: "availability guard",
        filename: "portable.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `Object.hasOwn && Object.hasOwn(record, "number");`,
      },
      {
        caseId: "object-hasown-mutator-authority",
        kind: "false-negative",
        description:
          "Calls through a reassigned Object mutation helper are treated as unknown; the rule does not try to prove that a custom helper installed the feature.",
        name: "reassigned mutation helper",
        filename: "custom-runtime.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `Object.defineProperty = undefined;
Object.defineProperty(Object, "hasOwn", { value: polyfill });
Object.hasOwn(record, "number");`,
      },
    ],
    title: "No unsupported Object.hasOwn",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`Object.hasOwn()` is Not Supported in Zurich ES2021 and Australia ES5; Australia ES2021 Supports it. Compatibility follows the ES5 cell by package policy.",
    bad: [
      {
        name: "Object.hasOwn in Zurich ES2021",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `var ownsNumber = Object.hasOwn(record, "number");`,
      },
    ],
    good: [
      {
        name: "portable hasOwnProperty call",
        filename: "script-include.js",
        settings: { javascriptMode: "es5" },
        code: `var ownsNumber = Object.prototype.hasOwnProperty.call(record, "number");`,
      },
    ],
  }),
  entry("no-typed-arrays", noTypedArrays, {
    ...metadata.meta(
      metadata.engine(metadata.ALL_INSTANCE_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "The Zurich table marks general typed-array/DataView constructors Disallowed in ES5 Standards, while BigInt64 arrays and DataView BigInt getters are Not Supported.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES_AUSTRALIA,
          "The Australia table marks BigInt64 array constructors Supported in ES2021 and Not Supported in ES5; DataView BigInt getters remain Not Supported.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_JS_MODES,
          "ServiceNow documents Compatibility as a third mode; the plugin explicitly applies ES5 feature cells to it as package policy.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/rules/glide-and-engine.test.ts",
          "Fixtures cover constructors, static from/of factories, aliases, feature guards, DataView BigInt getters, mutation, and namespace escape.",
          "fixture",
          "2026-08-22",
        ),
      ],
      {
        overlaps: ["servicenow/no-unsupported-syntax"],
      },
    ),
    placements: [
      { profile: "classic-es5", severity: "error" },
      { profile: "es2021", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "typed-array-dataview-setters-unreviewed",
        kind: "scope-boundary",
        description:
          "DataView BigInt setters stay silent because the reviewed ServiceNow tables establish only the getter methods.",
        name: "DataView BigInt setter",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `var view = new DataView(buffer);\nview.setBigInt64(0, value);`,
      },
      {
        caseId: "typed-array-visible-dataview-replacement",
        kind: "scope-boundary",
        description:
          "Any possible direct constructor, prototype, or instance-method write in the file conservatively suppresses affected diagnostics, regardless of source order.",
        name: "visible DataView method replacement",
        filename: "polyfill.script-include.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `var view = new DataView(buffer);
view.getBigInt64 = custom;
view.getBigInt64(0);`,
      },
      {
        caseId: "typed-array-escaped-namespace",
        kind: "scope-boundary",
        description:
          "Passing a typed-array constructor or DataView.prototype to unknown code suppresses affected method diagnostics because that code can install replacements.",
        name: "escaped DataView prototype",
        filename: "polyfill.script-include.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `installPolyfills(DataView.prototype);
new DataView(buffer).getBigInt64(0);`,
      },
      {
        caseId: "typed-array-mutator-authority",
        kind: "false-negative",
        description:
          "Calls through a reassigned property-mutation helper are treated as unknown; the rule does not assume the custom helper failed to install a DataView method.",
        name: "reassigned DataView mutation helper",
        filename: "custom-runtime.server.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `Object.defineProperty = undefined;
Object.defineProperty(DataView.prototype, "getBigInt64", { value: custom });
new DataView(buffer).getBigInt64(0);`,
      },
    ],
    title: "No TypedArray / DataView",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "General TypedArray constructors and their static from/of factories, plus DataView construction, are Disallowed by the ES5 cell, while BigInt64Array and BigUint64Array are Not Supported there. Zurich ES2021 also marks the BigInt arrays Not Supported; Australia ES2021 Supports them. DataView BigInt getters remain Not Supported. Compatibility follows ES5 by package policy.",
    bad: [
      {
        name: "Int8Array",
        filename: "script-include.js",
        settings: ES5,
        code: `var bytes = new Int8Array(16);`,
      },
      {
        name: "DataView BigInt getter",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `var view = new DataView(buffer);\nvar value = view.getBigInt64(0);`,
      },
      {
        name: "BigInt64Array static factory in Zurich",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `var values = BigInt64Array.from(source);`,
      },
    ],
    good: [{ name: "plain array", filename: "script-include.js", code: `var bytes = [0, 1, 2];` }],
  }),
  entry("no-proxy", noProxy, {
    ...metadata.meta(
      metadata.engine(metadata.ES5_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "Proxy is unsupported in Compatibility and ES5 Standards modes.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-proxy.test.ts",
          "Fixtures cover stable Proxy constructor and revocable-owner aliases, guarded alias capture, owner-and-method availability checks, modeled built-in invalidation, visible polyfills, mutation, and dynamic scope.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles.test.ts",
          "Real Oxlint and ESLint classic-es5 profiles report a stable Proxy alias and accept an explicit callable polyfill.",
          "integration-test",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-unsupported-syntax"],
      },
    ),
    placements: [{ profile: "classic-es5", severity: "error" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-proxy-visible-polyfill",
        kind: "scope-boundary",
        description:
          "A possible callable replacement for Proxy or Proxy.revocable suppresses matching diagnostics throughout the file, regardless of source order.",
        name: "visible Proxy polyfill",
        filename: "polyfill.server.js",
        settings: ES5,
        code: `Proxy = LocalProxy;
var wrapped = new Proxy(target, handler);`,
      },
      {
        caseId: "no-proxy-availability-guard",
        kind: "scope-boundary",
        description:
          "A constructor call protected by a structurally dominating owner guard stays silent; revocable calls require both the Proxy owner and method to be guarded.",
        name: "availability guard",
        filename: "portable.server.js",
        settings: ES5,
        code: `if (typeof Proxy === "function") {
  new Proxy(target, handler);
}`,
      },
      {
        caseId: "no-proxy-cross-execution-alias",
        kind: "false-negative",
        description:
          "A Proxy alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
        name: "cross-execution alias",
        filename: "deferred.server.js",
        settings: ES5,
        code: `const P = Proxy;
function wrap() { return new P(target, handler); }
wrap();`,
      },
      {
        caseId: "no-proxy-static-method-alias",
        kind: "false-negative",
        description:
          "Direct aliases of Proxy.revocable stay silent; the shared resolver proves stable aliases of the Proxy owner instead.",
        name: "revocable method alias",
        filename: "method-alias.server.js",
        settings: ES5,
        code: `const revocable = Proxy.revocable;
revocable(target, handler);`,
      },
    ],
    title: "No Proxy",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`Proxy` is unsupported in Compatibility and ES5 Standards mode. Direct calls plus stable same-execution constructor and `revocable` owner aliases report; bare aliases must be captured under an owner guard, while fully guarded or visibly polyfilled calls stay silent.",
    bad: [
      {
        name: "new Proxy",
        filename: "script-include.js",
        settings: ES5,
        code: `var p = new Proxy(target, handler);`,
      },
    ],
    good: [
      { name: "plain object", filename: "script-include.js", code: `var p = { prop: value };` },
    ],
  }),
  entry("no-unsupported-syntax", noUnsupportedSyntax, {
    ...metadata.meta(
      metadata.engine(metadata.ALL_INSTANCE_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "Several ES2015+ syntactic forms are unsupported in Compatibility and ES5 Standards modes.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES_AUSTRALIA,
          "The Australia table marks private instance fields, methods, and accessors Not Supported in ES2021.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_JS_MODES,
          "ServiceNow documents Compatibility as a third mode; the plugin explicitly applies ES5 feature cells to it as package policy.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/es5-promise.server.js",
          "classic-es5 Oxlint flags unsupported syntax on the ES2021 fixture.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-unsupported-syntax.test.ts",
          "Fixtures cover direct, namespace-qualified, and stable same-execution RegExp aliases plus shadows, mutation, dynamic scope, and constructor-versus-literal authority boundaries.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles.test.ts",
          "Real Oxlint and ESLint classic-ES5 profiles resolve stable RegExp aliases and accept explicit constructor replacements.",
          "integration-test",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-async-await", "servicenow/no-bigint"],
      },
    ),
    placements: [
      { profile: "classic-es5", severity: "error" },
      { profile: "es2021", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "unsupported-syntax-regexp-authority-loss",
        kind: "scope-boundary",
        description:
          "Any visible RegExp replacement suppresses constructor-string diagnostics throughout the file because the replacement may implement different pattern syntax. RegExp literal diagnostics remain active.",
        name: "visible RegExp replacement",
        filename: "polyfill.server.js",
        settings: ES5,
        code: `RegExp = LocalRegExp;
RegExp("(?<=a)b");`,
      },
      {
        caseId: "unsupported-syntax-regexp-cross-execution-alias",
        kind: "false-negative",
        description:
          "A RegExp alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
        name: "cross-execution RegExp alias",
        filename: "deferred.server.js",
        settings: ES5,
        code: `const Regex = RegExp;
function compile() { return Regex("(?<=a)b"); }
compile();`,
      },
    ],
    title: "No unsupported ES-latest syntax",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "The ES5 table marks optional chaining, nullish coalescing, logical assignment, private members, and RegExp lookbehind Not Supported. Constructor-string lookbehind detection follows direct and stable same-execution built-in RegExp identity. Private instance members remain Not Supported in ES2021; Compatibility follows ES5 by package policy.",
    bad: [
      {
        name: "optional chaining and ??",
        filename: "script-include.js",
        settings: ES5,
        code: `var name = current.caller_id?.name ?? "unknown";`,
      },
      {
        name: "private instance member in Australia ES2021",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `class State { #value = 1; }`,
      },
      {
        name: "RegExp alias with lookbehind",
        filename: "script-include.js",
        settings: ES5,
        code: `const Regex = RegExp;
var matcher = Regex("(?<=a)b");`,
      },
    ],
    good: [
      {
        name: "explicit check",
        filename: "script-include.js",
        code: `var name = current.caller_id ? current.caller_id.name : "unknown";`,
      },
      {
        name: "private static member in Australia ES2021",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `class State { static #value = 1; }`,
      },
      {
        name: "explicit RegExp replacement",
        filename: "script-include.js",
        settings: ES5,
        code: `RegExp = LocalRegExp;
var matcher = RegExp("(?<=a)b");`,
      },
    ],
  }),
  entry("no-delete-multiple-with-windowing", noDeleteMultipleWithWindowing, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "setLimit and chooseWindow do not limit deleteMultiple(); the call deletes every matching row.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/windowed-delete.br.js",
          "Recommended hosts report windowed deleteMultiple.",
          "integration-test",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/no-unfiltered-gliderecord-bulk-operation"],
        lifecycleAssumptions:
          "Window methods must resolve to the same GlideRecord object identity as deleteMultiple.",
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "windowed-delete-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.setLimit(10);
record.deleteMultiple();
record.deleteMultiple = localDelete;`,
      ),
    ],
    title: "No deleteMultiple with windowing",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`setLimit()` and `chooseWindow()` do not limit `deleteMultiple()`. The call deletes every row that matches the query. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html",
    bad: [
      {
        name: "setLimit then deleteMultiple",
        filename: "incident.br.js",
        code: `var stale = new GlideRecord("x_acme_staging");\nstale.addQuery("state", "expired");\nstale.setLimit(100);\nstale.deleteMultiple();`,
      },
    ],
    good: [
      {
        name: "intentional bulk delete",
        filename: "incident.br.js",
        code: `var stale = new GlideRecord("x_acme_staging");\nstale.addQuery("state", "expired");\nstale.deleteMultiple();`,
      },
    ],
  }),
  entry("require-callback-for-getreference", requireCallbackForGetreference, {
    ...metadata.meta(
      metadata.classic(metadata.CLIENT_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_FORM,
          "g_form.getReference without a callback is a synchronous server request.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/sync-getreference.client.js",
          "Recommended hosts report the one-argument form.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/require-callback-for-getreference.test.ts",
          "Immutable callback aliases and visible method mutations are covered adversarially.",
          "fixture",
          "2026-08-24",
        ),
      ],
      {
        overlaps: [],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "client", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "require-callback-local-g-form",
        kind: "scope-boundary",
        description: "Local objects named g_form are not the platform global.",
        name: "local g_form object",
        filename: "local-gform.client.js",
        code: `var g_form = { getReference: function () {} };
g_form.getReference("caller_id");`,
      },
      {
        caseId: "require-callback-file-wide-mutation",
        kind: "false-negative",
        description:
          "A possible g_form, GlideForm prototype, or getReference mutation suppresses matching calls throughout the file because deferred runtime order cannot be inferred from source order.",
        name: "later getReference mutation",
        filename: "mutated-gform.client.js",
        code: `g_form.getReference("caller_id");
g_form.getReference = localReference;`,
      },
    ],
    title: "Require callback for getReference",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`g_form.getReference(field)` without a callback is a synchronous server request. Pass a callback. Evidence: https://www.servicenow.com/docs/r/api-reference/c_GlideFormAPI.html",
    bad: [
      {
        name: "sync getReference",
        filename: "incident.client.js",
        code: `function onChange() {\n  var caller = g_form.getReference("caller_id");\n  g_form.setValue("u_manager", caller.manager);\n}`,
      },
    ],
    good: [
      {
        name: "async getReference",
        filename: "incident.client.js",
        code: `function onChange() {\n  g_form.getReference("caller_id", function (caller) {\n    g_form.setValue("u_manager", caller.manager);\n  });\n}`,
      },
    ],
  }),
  entry("require-glideajax-sysparm-name", requireGlideajaxSysparmName, {
    ...metadata.meta(
      metadata.classic(metadata.CLIENT_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_AJAX,
          "GlideAjax requires a non-empty sysparm_name before getXML, getXMLAnswer, or getXMLWait.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/glideajax-empty-sysparm.client.js",
          "Empty or missing sysparm_name values report on the client host fixtures.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/require-glideajax-sysparm-name.test.ts",
          "Constructor, prototype, instance-method, and dynamic-scope mutations remain silent.",
          "fixture",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-glideajax-getanswer", "servicenow/no-sync-glideajax"],
        lifecycleAssumptions:
          "A later request on the same object requires a new usable sysparm_name.",
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "client", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "require-glideajax-file-wide-mutation",
        kind: "false-negative",
        description:
          "A possible GlideAjax constructor, prototype, addParam, or request-method mutation suppresses affected lifecycle findings throughout the file.",
        name: "later request-method mutation",
        filename: "mutated-glideajax.client.js",
        code: `var ajax = new GlideAjax("Lookup");
ajax.getXMLAnswer(handleAnswer);
ajax.getXMLAnswer = localRequest;`,
      },
    ],
    title: "Require GlideAjax sysparm_name",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      'GlideAjax requires a non-empty `addParam("sysparm_name", method)` before `getXML` / `getXMLAnswer` / `getXMLWait`. Extra static keys must start with `sysparm_`. Evidence: https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html',
    bad: [
      {
        name: "missing sysparm_name",
        filename: "incident.client.js",
        code: `var ajax = new GlideAjax("x_acme.UserLookup");\najax.addParam("sysparm_user_id", g_form.getValue("caller_id"));\najax.getXMLAnswer(handleAnswer);`,
      },
    ],
    good: [
      {
        name: "named method",
        filename: "incident.client.js",
        code: `var ajax = new GlideAjax("x_acme.UserLookup");\najax.addParam("sysparm_name", "getManager");\najax.addParam("sysparm_user_id", g_form.getValue("caller_id"));\najax.getXMLAnswer(handleAnswer);`,
      },
    ],
  }),
  entry("validate-glideaggregate-calls", validateGlideaggregateCalls, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GA_AUSTRALIA,
          "The Australia GlideAggregate API documents addAggregate before query and getAggregate on the returned aggregate result.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_GA_GLOBAL_AUSTRALIA,
          "The Australia global GlideAggregate API documents the corresponding aggregate lifecycle methods.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/aggregate-type-only-field.br.js",
          "Type-only COUNT does not satisfy a field-specific getAggregate.",
          "integration-test",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/require-query-before-next"],
        lifecycleAssumptions:
          "Must-tuples intersect on join. addAggregate after query() does not validate the already-open result.",
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "validate-glideaggregate-file-wide-mutation",
        `var aggregate = new GlideAggregate("incident");
aggregate.next();
aggregate.next = localNext;`,
      ),
    ],
    title: "Validate GlideAggregate calls",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "A proven GlideAggregate must call `query()` before `next()` or `getAggregate()`. Static `getAggregate(type, field?)` must match an exact `addAggregate` tuple that was registered before that `query()`.",
    bad: [
      {
        name: "next before query",
        filename: "incident.br.js",
        code: `var count = new GlideAggregate("incident");\ncount.addAggregate("COUNT");\nif (count.next()) {\n  gs.info(count.getAggregate("COUNT"));\n}`,
      },
    ],
    good: [
      {
        name: "query then next",
        filename: "incident.br.js",
        code: `var count = new GlideAggregate("incident");\ncount.addAggregate("COUNT");\ncount.query();\nif (count.next()) {\n  gs.info(count.getAggregate("COUNT"));\n}`,
      },
    ],
  }),
  entry("no-now-id-as-reference", noNowIdAsReference, {
    ...metadata.meta(
      metadata.fluent(),
      [
        metadata.evidenceRecord(
          metadata.SN_FLUENT_CONSTRUCTS,
          "Now.ID is a metadata identity, not an in-app record reference.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/now-id-ref.now.ts",
          "Recommended hosts report Now.ID used as a reference field.",
          "integration-test",
          "2026-08-20",
        ),
      ],
      {
        overlaps: ["servicenow/require-fluent-id"],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "fluent", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-now-id-local-now",
        kind: "scope-boundary",
        description: "Local objects named Now are not the SDK namespace.",
        name: "local Now object",
        filename: "local-now.now.ts",
        code: `const Now = { ID: { task: "local" } };
const value = Now.ID.task;`,
      },
    ],
    title: "No Now.ID as a reference",
    family: "fluent",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`Now.ID[...]` is a metadata identity, not a reference. Alias meaning is read at the use site from lexical binding identity. Use the factory object in-app or `Now.ref()` for external records. Evidence: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html",
    bad: [
      {
        name: "Now.ID in another property",
        filename: "catalog.now.ts",
        code: `import { CatalogItem, VariableSet } from "@servicenow/sdk/core";\n\nconst userInformation = VariableSet({\n  $id: Now.ID["user-information"],\n  title: "User information",\n});\n\nCatalogItem({\n  $id: Now.ID["software-request"],\n  variableSets: [{ variableSet: Now.ID["user-information"], order: 100 }],\n});`,
      },
    ],
    good: [
      {
        name: "factory object reference",
        filename: "catalog.now.ts",
        code: `import { CatalogItem, VariableSet } from "@servicenow/sdk/core";\n\nconst userInformation = VariableSet({\n  $id: Now.ID["user-information"],\n  title: "User information",\n});\n\nCatalogItem({\n  $id: Now.ID["software-request"],\n  flow: Now.ref("sys_hub_flow", "existing-flow-id"),\n  variableSets: [{ variableSet: userInformation, order: 100 }],\n});`,
      },
    ],
  }),
  entry("no-glideajax-getanswer", noGlideajaxGetanswer, {
    ...metadata.meta(
      metadata.classic(metadata.CLIENT_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GLIDEAJAX,
          "getAnswer belongs to the synchronous getXMLWait pattern.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/glideajax-getanswer.client.js",
          "Recommended hosts report getAnswer on proven GlideAjax objects.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-glideajax-getanswer.test.ts",
          "Constructor, prototype, instance-method, and dynamic-scope mutations remain silent.",
          "fixture",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-sync-glideajax"],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "client", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-glideajax-getanswer-file-wide-mutation",
        kind: "false-negative",
        description:
          "A possible GlideAjax constructor, prototype, or getAnswer mutation suppresses matching calls throughout the file.",
        name: "later getAnswer mutation",
        filename: "mutated-glideajax.client.js",
        code: `var ajax = new GlideAjax("Lookup");
ajax.getAnswer();
ajax.getAnswer = localAnswer;`,
      },
    ],
    title: "No GlideAjax getAnswer",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`getAnswer()` belongs to synchronous GlideAjax. Use `getXMLAnswer(callback)` instead. Evidence: https://www.servicenow.com/docs/r/api-reference/c_GlideAjaxAPI.html",
    bad: [
      {
        name: "getAnswer after getXML",
        filename: "incident.client.js",
        code: `var ajax = new GlideAjax("x_acme.UserLookup");\najax.addParam("sysparm_name", "getManager");\najax.getXML(handleResponse);\nvar answer = ajax.getAnswer();`,
      },
    ],
    good: [
      {
        name: "getXMLAnswer callback",
        filename: "incident.client.js",
        code: `var ajax = new GlideAjax("x_acme.UserLookup");\najax.addParam("sysparm_name", "getManager");\najax.getXMLAnswer(function (answer) {\n  g_form.setValue("u_manager", answer);\n});`,
      },
    ],
  }),
  entry("no-duplicate-fluent-id", noDuplicateFluentId, {
    ...metadata.meta(
      metadata.fluent(),
      [
        metadata.evidenceRecord(
          metadata.SN_FLUENT_CONSTRUCTS,
          "Now.ID keys must be unique in a file so keys.ts can track records.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/duplicate-id.now.ts",
          "Recommended hosts report duplicate Now.ID keys.",
          "integration-test",
          "2026-08-20",
        ),
      ],
      {
        overlaps: ["servicenow/require-fluent-id"],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "fluent", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [],
    title: "No duplicate Fluent $id",
    family: "fluent",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Two Fluent definitions that share the same static `Now.ID` key as `$id` collide. Cross-file uniqueness is out of scope.",
    bad: [
      {
        name: "duplicate top-level ids",
        filename: "rules.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["update-assignment"],\n  name: "Update assignment",\n  table: "incident",\n  when: "before",\n});\n\nBusinessRule({\n  $id: Now.ID["update-assignment"],\n  name: "Notify assignment",\n  table: "incident",\n  when: "after",\n});`,
      },
    ],
    good: [
      {
        name: "unique ids",
        filename: "rules.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["update-assignment"],\n  name: "Update assignment",\n  table: "incident",\n  when: "before",\n});\n\nBusinessRule({\n  $id: Now.ID["notify-assignment"],\n  name: "Notify assignment",\n  table: "incident",\n  when: "after",\n});`,
      },
    ],
  }),
  entry("no-glideelement-in-collection", noGlideelementInCollection, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "A GlideElement follows a cursor advanced by next() or _next(); collections must store extracted values.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/glideelement-push.br.js",
          "Recommended hosts report pushing a cursor field into an array.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/layer3-consumers.test.ts",
          "Path-sensitive fixtures cover local aliases, reassignment, shadowing, all-path joins, and IIFE parameters.",
          "fixture",
          "2026-08-22",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: [],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-glideelement-deferred-helper",
        kind: "scope-boundary",
        description:
          "Separately declared helpers and deferred callbacks stay silent because their invocation timing and value flow are not proven by the cursor traversal.",
        name: "separate helper",
        filename: "incident.br.js",
        code: `function retain(field) { values.push(field); }
var rec = new GlideRecord("incident");
rec.query();
while (rec.next()) retain(rec.number);`,
      },
      platformMethodMutationLimitation(
        "no-glideelement-file-wide-mutation",
        `var rec = new GlideRecord("incident");
var values = [];
while (rec.next()) values.push(rec.number);
rec.next = localNext;`,
      ),
    ],
    title: "No GlideElement in a collection",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Direct GlideRecord field access and path-proven local aliases are GlideElements tied to the cursor. Do not `push` / `unshift` them inside a `.next()` or `._next()` loop.",
    bad: [
      {
        name: "push field",
        filename: "incident.br.js",
        code: `var numbers = [];\nvar incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  numbers.push(incident.number);\n}`,
      },
      {
        name: "push field alias",
        filename: "incident.br.js",
        code: `var numbers = [];\nvar incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  var number = incident.number;\n  numbers.push(number);\n}`,
      },
    ],
    good: [
      {
        name: "getValue",
        filename: "incident.br.js",
        code: `var numbers = [];\nvar incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  numbers.push(incident.getValue("number"));\n}`,
      },
    ],
  }),
  entry("no-gliderecord-query-modifier-after-query", noGliderecordQueryModifierAfterQuery, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR_GLOBAL,
          "Query modifiers after a documented query executor do not change the open cursor.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/late-modifier.br.js",
          "Recommended hosts report addQuery after query before next.",
          "integration-test",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/require-query-before-next"],
        lifecycleAssumptions:
          "Modifiers after a definite executor are findings only when a consumer uses the still-open cursor. A possible-only executor clears positive lifecycle facts.",
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "query-modifier-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.query();
record.addQuery("active", true);
record.next();
record.next = localNext;`,
      ),
    ],
    title: "No query modifier after query",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Filters and result-shaping calls after a documented query executor do not change the open cursor. Report when a consumer uses that cursor before another execution.",
    bad: [
      {
        name: "addQuery after query",
        filename: "incident.br.js",
        code: `var incident = new GlideRecord("incident");\nincident.query();\nincident.addQuery("active", true);\nwhile (incident.next()) {\n  gs.info(incident.number);\n}`,
      },
    ],
    good: [
      {
        name: "filter then query",
        filename: "incident.br.js",
        code: `var incident = new GlideRecord("incident");\nincident.addQuery("active", true);\nincident.query();\nwhile (incident.next()) {\n  gs.info(incident.number);\n}`,
      },
    ],
  }),
  entry("require-business-rule-wrapper", requireBusinessRuleWrapper, {
    ...metadata.meta(
      {
        authoring: "classic",
        surfaces: ["business-rule"],
        minimumSurfaceConfidence: "explicit-only",
        javascriptModes: "n/a",
        scopes: metadata.ALL_SCOPES,
      },
      [
        metadata.evidenceRecord(
          metadata.SN_BR,
          "Full-script Business Rules use the executeRule(current, previous) IIFE so top-level bindings do not leak.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/unwrapped.br.js",
          "The wrapper rule reports only when businessRuleSourceFormat is full-script.",
          "integration-test",
          "2026-08-20",
        ),
      ],
      {
        overlaps: [],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "require-wrapper-body-only",
        kind: "scope-boundary",
        description: "Body-only Business Rule source does not contain the platform wrapper.",
        name: "body-only source",
        filename: "body-only.br.js",
        settings: {
          authoring: "classic",
          surfaces: ["business-rule"],
          businessRuleSourceFormat: "body-only",
        },
        code: `current.short_description = "Updated";`,
      },
    ],
    title: "Require Business Rule wrapper",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Full-script Business Rules must wrap logic in the standard IIFE so top-level variables do not leak. The rule is silent unless `businessRuleSourceFormat` is `full-script`.",
    bad: [
      {
        name: "unwrapped",
        filename: "incident.br.js",
        settings: { businessRuleSourceFormat: "full-script" },
        code: `var targetGroup = gs.getProperty("x_acme.target_group");\nif (current.assignment_group.nil()) {\n  current.assignment_group = targetGroup;\n}`,
      },
    ],
    good: [
      {
        name: "IIFE wrapper",
        filename: "incident.br.js",
        settings: { businessRuleSourceFormat: "full-script" },
        code: `(function executeRule(current, previous) {\n  var targetGroup = gs.getProperty("x_acme.target_group");\n  if (current.assignment_group.nil()) {\n    current.assignment_group = targetGroup;\n  }\n})(current, previous);`,
      },
    ],
  }),
  entry("no-display-value-date-comparison", noDisplayValueDateComparison, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GDT,
          "GlideDateTime.getDisplayValue() follows the session format and is not a chronological sort key.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "src/catalog.ts",
          "Catalog examples cover display-value comparison versus getNumericValue.",
          "fixture",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/no-gs-now"],
      },
    ),
    placements: [{ profile: "strict", severity: "warn" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "display-date-local-copy",
        kind: "false-negative",
        description: "Display values copied into locals are not tracked before comparison.",
        name: "copied display value",
        filename: "copied-display.server.js",
        code: `var date = new GlideDateTime();
var display = date.getDisplayValue();
if (display < "2026-01-01") gs.info(display);`,
      },
      platformMethodMutationLimitation(
        "display-date-file-wide-mutation",
        `var date = new GlideDateTime();
if (date.getDisplayValue() < "2026-01-01") gs.info(date);
date.getDisplayValue = localDisplay;`,
      ),
    ],
    title: "No display-value date comparison",
    family: "classic",
    preset: "strict",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Do not relationally compare `GlideDateTime.getDisplayValue()` strings. Use `getNumericValue()` or a date-aware API.",
    bad: [
      {
        name: "display string compare",
        filename: "incident.br.js",
        code: `var start = new GlideDateTime(current.start_date);\nvar end = new GlideDateTime(current.end_date);\nif (start.getDisplayValue() > end.getDisplayValue()) {\n  gs.addErrorMessage("Start must be before end");\n}`,
      },
    ],
    good: [
      {
        name: "numeric compare",
        filename: "incident.br.js",
        code: `var start = new GlideDateTime(current.start_date);\nvar end = new GlideDateTime(current.end_date);\nif (start.getNumericValue() > end.getNumericValue()) {\n  gs.addErrorMessage("Start must be before end");\n}`,
      },
    ],
  }),
  entry("no-unfiltered-gliderecord-bulk-operation", noUnfilteredGliderecordBulkOperation, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "updateMultiple and deleteMultiple apply to every row that matches the query filters.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/empty-addquery-bulk.br.js",
          "Empty or missing addQuery arguments do not count as filters.",
          "integration-test",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/no-delete-multiple-with-windowing"],
        lifecycleAssumptions:
          "query, orderBy, setLimit, and chooseWindow are not restricting filters.",
      },
    ),
    placements: [{ profile: "recommended", severity: "warn" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "unfiltered-bulk-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.deleteMultiple();
record.deleteMultiple = localDelete;`,
      ),
    ],
    title: "No unfiltered GlideRecord bulk operation",
    family: "classic",
    preset: "recommended",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      '`updateMultiple()` / `deleteMultiple()` without a proven restricting filter can touch every row. `query`, `orderBy`, `setLimit`, and `chooseWindow` are not filters. Empty `addQuery()` / `addEncodedQuery("")` do not count.',
    bad: [
      {
        name: "deleteMultiple with no filter",
        filename: "incident.br.js",
        code: `var staging = new GlideRecord("x_acme_staging");\nstaging.deleteMultiple();`,
      },
    ],
    good: [
      {
        name: "filtered updateMultiple",
        filename: "incident.br.js",
        code: `var task = new GlideRecord("task");\ntask.addQuery("active", false);\ntask.setValue("u_migrated", true);\ntask.updateMultiple();`,
      },
    ],
  }),
  entry("no-gliderecord-query-in-acl", noGliderecordQueryInAcl, {
    ...metadata.meta(
      metadata.classic(["acl"]),
      [
        metadata.evidenceRecord(
          metadata.SN_SECURE_DATA,
          "ServiceNow's Zurich secure-data guidance advises limiting GlideRecord queries in access control scripts because they can affect performance.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          metadata.SN_SECURE_DATA_AUSTRALIA,
          "ServiceNow's Australia secure-data guidance retains the same advice to limit GlideRecord queries in access control scripts.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          metadata.SN_GA_AUSTRALIA,
          "The Australia GlideAggregate reference documents it as a GlideRecord extension that executes database aggregation queries.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          metadata.SN_ACL_AUSTRALIA,
          "The Australia ACL guidance documents current as the record available to a custom ACL script.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-gliderecord-query-in-acl.test.ts",
          "Path-sensitive fixtures cover query executors, current, aliases, joins, reassignment, shadowing, direct and async helper calls, escape, deferred code, scope-specific APIs, and platform-method mutation.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/acl-query.acl.js",
          "Real Oxlint and ESLint ACL profiles report a proven query while recommended remains unchanged.",
          "integration-test",
          "2026-08-24",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/no-gliderecord-query-in-loop"],
        lifecycleAssumptions:
          "Only query executions before the first asynchronous suspension on the immediate ACL evaluation path are reviewed. Directly invoked local helpers inherit call-time object identity; uncalled functions, generators, deferred callbacks, post-await continuations, escaped objects, unsupported scope-specific methods, and uncertain platform-method authority stay silent.",
      },
    ),
    placements: [
      { profile: "strict", severity: "warn" },
      { profile: "acl", severity: "warn" },
      { profile: "security", severity: "warn" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "acl-query-deferred-callback",
        kind: "scope-boundary",
        description:
          "Uncalled helpers and deferred callbacks stay silent because their execution during this ACL evaluation is not proven.",
        name: "deferred callback",
        filename: "incident.acl.js",
        code: `function loadUser() {
  var user = new GlideRecord("sys_user");
  user.query();
}
scheduleLater(loadUser);`,
      },
      {
        caseId: "acl-query-post-await",
        kind: "scope-boundary",
        description:
          "A query after the first await stays silent because that continuation does not run during the helper's immediate invocation.",
        name: "post-await continuation",
        filename: "incident.acl.js",
        code: `async function loadUser() {
  await later();
  var user = new GlideRecord("sys_user");
  user.query();
}
loadUser();`,
      },
      {
        caseId: "acl-query-escaped-record",
        kind: "false-negative",
        description:
          "A GlideRecord passed to an unresolved helper stays silent after escape because the helper may replace or otherwise invalidate its method identity.",
        name: "escaped record",
        filename: "incident.acl.js",
        code: `var user = new GlideRecord("sys_user");
prepare(user);
user.query();`,
      },
      {
        caseId: "acl-query-unknown-global-method-scope",
        kind: "scope-boundary",
        description: "Global-only query executors stay silent when application scope is unknown.",
        name: "unknown queryNoDomain scope",
        filename: "incident.acl.js",
        settings: { scope: "unknown", release: "australia" },
        code: `var user = new GlideRecord("sys_user");
user.queryNoDomain();`,
      },
      {
        caseId: "acl-query-file-wide-mutation",
        kind: "false-negative",
        description:
          "A visible GlideRecord prototype or relevant instance-method mutation suppresses matching ACL diagnostics throughout the file.",
        name: "visible query-method mutation",
        filename: "incident.acl.js",
        code: `var user = new GlideRecord("sys_user");
user.query();
user.query = localQuery;`,
      },
    ],
    title: "Review GlideRecord queries in ACLs",
    family: "classic",
    preset: "strict",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Review proven GlideRecord, GlideRecordSecure, and GlideAggregate query executions on an ACL's immediate evaluation path. ServiceNow advises limiting GlideRecord queries in access control scripts because they can affect performance. This advisory rule is opt-in through strict, ACL, or security profiles and does not claim that every query is incorrect.",
    bad: [
      {
        name: "query during ACL evaluation",
        filename: "incident.acl.js",
        code: `var membership = new GlideRecord("sys_user_grmember");
membership.addQuery("user", gs.getUserID());
membership.addQuery("group", current.assignment_group);
membership.query();
answer = membership.hasNext();`,
      },
    ],
    good: [
      {
        name: "role and loaded-record fields",
        filename: "incident.acl.js",
        code: `answer = gs.hasRole("x_acme.agent") && current.active && current.assigned_to == gs.getUserID();`,
      },
    ],
  }),
  entry("no-gliderecord-query-in-loop", noGliderecordQueryInLoop, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "A documented GlideRecord query executor inside a next() or _next() loop is an N+1 pattern.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_GA,
          "GlideAggregate documents query() and next() for aggregate cursor iteration.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/nested-cursor-query.br.js",
          "Strict hosts report a nested query inside a proven cursor loop.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/valid/custom-iterator-loop.br.js",
          "Custom iterators with next() do not establish cursor depth.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/phase3.test.ts",
          "Stable one-call-site local helpers inherit cursor depth; mutable, multiply called, generator, shadowed, and indirect helpers stay silent.",
          "fixture",
          "2026-08-22",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/require-query-before-next"],
        lifecycleAssumptions:
          "A proven GlideRecord next() / _next() or GlideAggregate next() receiver establishes cursor depth. Direct IIFEs and direct calls to an unmodified local function with one statically visible call site inherit that depth. GlideRecord executors must be definite for the configured scope. GlideAggregate analysis follows its directly documented query() / next() lifecycle; inherited or undocumented executors and cursor aliases stay silent.",
      },
    ),
    placements: [{ profile: "strict", severity: "warn" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "query-in-loop-multiple-helper-call-sites",
        kind: "false-negative",
        description:
          "Mutable helpers and helpers with multiple direct call sites stay silent because shared provenance is not call-context-sensitive.",
        name: "multiply called helper",
        filename: "multiply-called.server.js",
        code: `function loadCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
loadCaller();
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) loadCaller();`,
      },
      {
        caseId: "query-in-loop-indirect-helper-invocation",
        kind: "false-negative",
        description:
          "Indirect `.call()`, `.apply()`, `.bind()`, constructor, and deferred callback invocations do not inherit cursor depth.",
        name: "indirect helper invocation",
        filename: "indirect-helper.server.js",
        code: `function loadCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) loadCaller.call(null);`,
      },
      platformMethodMutationLimitation(
        "query-in-loop-file-wide-mutation",
        `var outer = new GlideRecord("incident");
var inner = new GlideRecord("sys_user");
while (outer.next()) inner.query();
inner.query = localQuery;`,
      ),
    ],
    title: "No GlideRecord query in a cursor loop",
    family: "classic",
    preset: "strict",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "A query inside a proven record cursor loop is an N+1 pattern. Direct IIFEs and stable one-call-site local helpers inherit cursor depth. GlideRecord uses release-keyed executors and `.next()` / `._next()`; GlideAggregate uses its directly documented `query()` / `.next()` lifecycle. Unrelated iterators stay silent.",
    bad: [
      {
        name: "nested get",
        filename: "incident.br.js",
        code: `var incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  var caller = new GlideRecord("sys_user");\n  caller.get(incident.getValue("caller_id"));\n  gs.info(caller.getDisplayValue());\n}`,
      },
      {
        name: "query in a stable helper",
        filename: "incident.br.js",
        code: `function loadCaller(id) {
  var caller = new GlideRecord("sys_user");
  caller.get(id);
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) loadCaller(incident.getValue("caller_id"));`,
      },
    ],
    good: [
      {
        name: "display value",
        filename: "incident.br.js",
        code: `var incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  gs.info(incident.getDisplayValue("caller_id"));\n}`,
      },
    ],
  }),
  entry("prefer-setnocount-with-choosewindow", preferSetnocountWithChoosewindow, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "query() after chooseWindow() runs COUNT(*) unless setNoCount() or setLimit() skips it.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          metadata.SN_GR_AUSTRALIA,
          "Australia retains the documented chooseWindow query count and setNoCount/setLimit behavior.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/setnocount-second-query.br.js",
          "A later query epoch is not justified by an earlier getRowCount().",
          "integration-test",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/require-query-before-next"],
        lifecycleAssumptions:
          "Window and setNoCount state are scoped to one query epoch and one object identity.",
      },
    ),
    placements: [{ profile: "strict", severity: "warn" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "setnocount-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.chooseWindow(0, 20);
record.query();
record.query = localQuery;`,
      ),
    ],
    title: "Prefer setNoCount with chooseWindow",
    family: "classic",
    preset: "strict",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "The reviewed Zurich and Australia-scoped GlideRecord references document that `query()` after `chooseWindow()` runs `COUNT(*)` unless `setNoCount()` or `setLimit()` skips it. The rule is silent when `getRowCount()` is used, when `chooseWindow` forces a count, or when the binding escapes.",
    bad: [
      {
        name: "window without setNoCount",
        filename: "page.br.js",
        code: `var rec = new GlideRecord("incident");\nrec.chooseWindow(0, 20);\nrec.query();\nwhile (rec.next()) {\n  gs.info(rec.getValue("number"));\n}`,
      },
    ],
    good: [
      {
        name: "setNoCount",
        filename: "page.br.js",
        code: `var rec = new GlideRecord("incident");\nrec.chooseWindow(0, 20);\nrec.setNoCount();\nrec.query();\nwhile (rec.next()) {\n  gs.info(rec.getValue("number"));\n}`,
      },
    ],
  }),
  entry("no-system-query-bypass", noSystemQueryBypass, {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "addSystemQuery and related methods bypass query ACLs and need review.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/system-query.br.js",
          "The security profile reports documented ACL-bypass methods.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/context-contracts.test.ts",
          "Oxlint and ESLint report folded, dynamic, extracted, and escaped GlideRecord bypass access.",
          "integration-test",
          "2026-08-21",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: [],
        limitationPreamble:
          "Unproven, invalid, or ambiguous GlideRecord bindings stay silent. Proven escaped GlideRecord identities remain reviewable because this opt-in security rule favors surfacing potential ACL bypasses.",
      },
    ),
    placements: [{ profile: "security", severity: "warn" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "system-query-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.addSystemQuery("active", true);
record.addSystemQuery = localQuery;`,
      ),
    ],
    title: "Review system query ACL bypass",
    family: "classic",
    preset: false,
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Opt-in security review for documented ACL-bypass query APIs. Unknown computed GlideRecord access also reports for review.",
    bad: [
      {
        name: "addSystemQuery",
        filename: "incident.br.js",
        code: `var user = new GlideRecord("sys_user");\nuser.addSystemQuery("active", true);\nuser.query();`,
      },
    ],
    good: [
      {
        name: "addQuery",
        filename: "incident.br.js",
        code: `var user = new GlideRecord("sys_user");\nuser.addQuery("active", true);\nuser.query();`,
      },
    ],
  }),
  entry("no-sync-glideajax", noSyncGlideajax, {
    ...metadata.meta(
      metadata.classic(metadata.CLIENT_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GLIDEAJAX,
          "getXMLWait is a synchronous browser request.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "src/catalog.ts",
          "Catalog examples cover getXMLWait versus getXMLAnswer.",
          "fixture",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/glide-and-engine.test.ts",
          "Constructor, prototype, instance-method, and dynamic-scope mutations remain silent.",
          "fixture",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-glideajax-getanswer"],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "client", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-sync-glideajax-file-wide-mutation",
        kind: "false-negative",
        description:
          "A possible GlideAjax constructor, prototype, or getXMLWait mutation suppresses matching calls throughout the file.",
        name: "later getXMLWait mutation",
        filename: "mutated-glideajax.client.js",
        code: `var ajax = new GlideAjax("Lookup");
ajax.getXMLWait();
ajax.getXMLWait = localWait;`,
      },
    ],
    title: "No synchronous GlideAjax",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`getXMLWait()` blocks the browser and does not work in Service Portal. Use `getXML()` / `getXMLAnswer()`.",
    bad: [
      {
        name: "getXMLWait",
        filename: "incident.client.js",
        code: `var ga = new GlideAjax("x_acme.UserUtils");\nga.addParam("sysparm_name", "getUser");\nvar xml = ga.getXMLWait();\nvar answer = xml.documentElement.getAttribute("answer");`,
      },
    ],
    good: [
      {
        name: "getXMLAnswer",
        filename: "incident.client.js",
        code: `var ga = new GlideAjax("x_acme.UserUtils");\nga.addParam("sysparm_name", "getUser");\nga.getXMLAnswer(function (answer) {\n  g_form.setValue("caller_id", answer);\n});`,
      },
    ],
  }),
  entry("no-async-iterators", noAsyncIterators, {
    ...metadata.meta(
      metadata.engine(metadata.ALL_INSTANCE_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_FEATURES,
          "for await...of and async generators are disallowed in every instance JavaScript mode.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/es2021-async-iter.server.js",
          "es2021 Oxlint still flags async iteration.",
          "integration-test",
          "2026-08-20",
        ),
      ],
      {
        overlaps: ["servicenow/no-async-await"],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "classic-es5", severity: "error" },
      { profile: "es2021", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [],
    title: "No async iterators",
    family: "engine",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`for await…of` and async generators are disallowed in every instance JavaScript mode, including ES2021.",
    bad: [
      {
        name: "for await",
        filename: "script-include.js",
        code: `async function drain(items) {\n  for await (var item of items) {\n    gs.info(item);\n  }\n}`,
      },
    ],
    good: [
      {
        name: "for of",
        filename: "script-include.js",
        code: `function drain(items) {\n  for (var i = 0; i < items.length; i++) {\n    gs.info(items[i]);\n  }\n}`,
      },
    ],
  }),
];

const catalogNames = new Set<string>();
const catalogRuleIds = new Set<string>();
const catalogImplementations = new Set<Rule>();
for (const item of ruleCatalog) {
  if (catalogNames.has(item.name)) throw new Error(`Duplicate catalog rule name: ${item.name}`);
  if (catalogRuleIds.has(item.ruleId)) throw new Error(`Duplicate catalog rule ID: ${item.ruleId}`);
  if (catalogImplementations.has(item.implementation)) {
    throw new Error(`Duplicate catalog implementation: ${item.name}`);
  }
  if (item.optionDescriptor && item.optionDescriptor.ruleName !== item.name) {
    throw new Error(
      `Catalog option descriptor ${item.optionDescriptor.ruleName} does not match ${item.name}`,
    );
  }
  const profiles = new Set<RuleProfile>();
  for (const placement of item.placements) {
    if (profiles.has(placement.profile)) {
      throw new Error(`Duplicate ${placement.profile} placement for ${item.name}`);
    }
    profiles.add(placement.profile);
  }
  catalogNames.add(item.name);
  catalogRuleIds.add(item.ruleId);
  catalogImplementations.add(item.implementation);
}

export function getRuleCatalogEntry(name: string): RuleCatalogEntry | undefined {
  return ruleCatalog.find((rule) => rule.name === name || rule.ruleId === name);
}

export type RuleName = (typeof ruleCatalog)[number]["name"];
