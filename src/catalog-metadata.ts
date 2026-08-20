import type { ApplicationScope, JavaScriptMode } from "./types.js";

export type EvidenceVerifiedBy = "fixture" | "declaration-snapshot" | "integration-test" | "manual";

export interface RuleEvidenceRecord {
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
  falsePositives: readonly string[];
  falseNegatives: readonly string[];
  overlaps: readonly string[];
  lifecycleAssumptions?: string;
  lastVerified: string;
}

const ALL_SCOPES = ["global", "scoped", "unknown"] as const;
const CLASSIC_SURFACES = [
  "client",
  "server",
  "business-rule",
  "script-include",
  "ui-action",
  "scheduled-script",
  "fix-script",
] as const;
const SERVER_SURFACES = [
  "server",
  "business-rule",
  "script-include",
  "ui-action",
  "scheduled-script",
  "fix-script",
] as const;
const CLIENT_SURFACES = ["client", "ui-action"] as const;
const ZURICH = ["zurich"] as const;
const JS_DOCS = ["xanadu", "yokohama", "zurich"] as const;
const ES5_MODES = ["compatibility", "es5"] as const;
const ALL_MODES = ["compatibility", "es5", "es2021"] as const;

const SN_GR =
  "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html";
const SN_GR_GLOBAL =
  "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html";
const SN_JS_MODES = "https://www.servicenow.com/docs/r/xanadu/api-reference/scripts/c_JS_modes.html";
const SN_JS_FEATURES =
  "https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html";
const SN_FLUENT = "https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html";
const SN_FLUENT_CONSTRUCTS =
  "https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html";
const SN_AJAX = "https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html";
const SN_GLIDEAJAX = "https://www.servicenow.com/docs/r/api-reference/c_GlideAjaxAPI.html";
const SN_FORM = "https://www.servicenow.com/docs/r/api-reference/c_GlideFormAPI.html";
const SN_BR =
  "https://www.servicenow.com/docs/r/application-development/business-rules-classic/c_BusinessRules.html";
const SN_GDT =
  "https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideDateTimeAPI.html";

function ev(
  url: string,
  claim: string,
  verifiedBy: EvidenceVerifiedBy,
  verifiedAt: string,
): RuleEvidenceRecord {
  return { url, claim, verifiedBy, verifiedAt };
}

function latest(evidence: readonly RuleEvidenceRecord[]): string {
  return evidence.reduce((max, item) => (item.verifiedAt > max ? item.verifiedAt : max), "");
}

function meta(
  applicability: StructuredApplicability,
  evidence: readonly RuleEvidenceRecord[],
  extra: Omit<RuleDocMetadata, "applicability" | "evidence" | "lastVerified"> & {
    lastVerified?: string;
  },
): RuleDocMetadata {
  return {
    applicability,
    evidence,
    lastVerified: extra.lastVerified ?? latest(evidence),
    falsePositives: extra.falsePositives,
    falseNegatives: extra.falseNegatives,
    overlaps: extra.overlaps,
    lifecycleAssumptions: extra.lifecycleAssumptions,
  };
}

function classic(surfaces: readonly string[], modes: StructuredApplicability["javascriptModes"] = "n/a"): StructuredApplicability {
  return {
    authoring: "classic",
    surfaces,
    minimumSurfaceConfidence: "filename-inferred",
    javascriptModes: modes,
    scopes: ALL_SCOPES,
    serviceNowReleases: [...ZURICH],
  };
}

function engine(modes: readonly JavaScriptMode[]): StructuredApplicability {
  return {
    authoring: "classic",
    surfaces: CLASSIC_SURFACES,
    minimumSurfaceConfidence: "filename-inferred",
    javascriptModes: modes,
    scopes: ALL_SCOPES,
    serviceNowReleases: [...JS_DOCS],
  };
}

function fluent(): StructuredApplicability {
  return {
    authoring: "fluent",
    surfaces: ["fluent"],
    minimumSurfaceConfidence: "filename-inferred",
    javascriptModes: "n/a",
    scopes: ALL_SCOPES,
    serviceNowReleases: [...ZURICH],
    fluentSdkRange: "3.0.0 || 4.1.0 || 4.8.0 || 4.10.0 || 4.11.0",
  };
}

const UNKNOWN_SILENT =
  "Unknown, escaped, or ambiguous bindings stay silent instead of guessing.";

export const ruleDocMetadata: Record<string, RuleDocMetadata> = {
  "no-hardcoded-sysid": meta(classic(CLASSIC_SURFACES), [
    ev(SN_FLUENT_CONSTRUCTS, "Named Fluent Now.ID keys are the supported portable identity, not raw sys_id literals.", "declaration-snapshot", "2026-08-20"),
    ev("tests/rules/no-hardcoded-sysid.test.ts", "Literal 32-hex strings report; settings and option allow-lists suppress.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["MD5-like binding names when ignoreHashNames is true."],
    falseNegatives: ["Uppercase 32-hex strings are intentionally excluded by the lowercase-only matcher.", "sys_ids built by concatenation or runtime encoding."],
    overlaps: ["servicenow/no-now-id-as-reference", "core no-restricted-syntax"],
  }),
  "no-promise": meta(engine(ES5_MODES), [
    ev(SN_JS_FEATURES, "Promises are unsupported in Compatibility and ES5 Standards modes.", "declaration-snapshot", "2026-08-20"),
    ev("tests/rules/no-promise.test.ts", "Platform Promise identifiers report; local bindings stay silent.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Local bindings named Promise."],
    falseNegatives: ["Dynamic construction that does not resolve to the platform Promise identifier."],
    overlaps: ["servicenow/no-async-await", "eslint no-restricted-globals"],
  }),
  "no-async-await": meta(engine(ES5_MODES), [
    ev(SN_JS_FEATURES, "async/await is unsupported in Compatibility and ES5 Standards modes.", "declaration-snapshot", "2026-08-20"),
    ev("tests/rules/no-async-await.test.ts", "async functions and await expressions report in ES5 mode.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Files whose javascriptMode is unknown or es2021."],
    falseNegatives: ["Transpiled async helpers that no longer use await syntax."],
    overlaps: ["servicenow/no-promise", "servicenow/no-async-iterators"],
  }),
  "no-bigint": meta(engine(ES5_MODES), [
    ev(SN_JS_FEATURES, "BigInt is unsupported in Compatibility and ES5 Standards modes.", "declaration-snapshot", "2026-08-20"),
    ev("tests/rules/no-bigint.test.ts", "BigInt literals and the platform BigInt identifier report.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Local bindings named BigInt."],
    falseNegatives: ["Runtime evaluation of the BigInt constructor through an unknown member."],
    overlaps: ["servicenow/no-unsupported-syntax"],
  }),
  "prefer-glideaggregate": meta(classic(SERVER_SURFACES), [
    ev(SN_GR, "GlideAggregate is the documented API for count and group queries.", "declaration-snapshot", "2026-08-20"),
    ev("tests/rules/prefer-glideaggregate.test.ts", "Iterate-to-count loops report; if (gr.next()) stays silent.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Loops that read more than a count from each row."],
    falseNegatives: ["Count accumulation through helpers or aliased counters."],
    overlaps: ["servicenow/validate-glideaggregate-calls"],
  }),
  "no-client-gliderecord": meta(classic(CLIENT_SURFACES), [
    ev(SN_GR, "GlideRecord is a server API and is not a client-side record cursor.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/client-gliderecord.client.js", "Recommended Oxlint and ESLint flag GlideRecord in client files.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: ["Server UI Actions that only share a client-looking filename when surfaces are explicit."],
    falseNegatives: ["Client scripts whose surface stays unknown."],
    overlaps: ["servicenow/require-query-before-next"],
  }),
  "no-gs-now": meta(classic(CLASSIC_SURFACES), [
    ev(SN_GDT, "gs.now() and gs.nowDateTime() return display strings, not GlideDateTime objects.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/fixtures/bad-business-rule.br.js", "Host fixtures report gs.now on Business Rule files.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: ["Local objects with a now method that is not the platform gs binding."],
    falseNegatives: ["gs aliases that escape before the call."],
    overlaps: ["servicenow/no-display-value-date-comparison"],
  }),
  "require-query-before-next": meta(classic(SERVER_SURFACES), [
    ev(SN_GR, "next() reads the current cursor row after query() or get() executes the query.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/missing-query.br.js", "Oxlint and ESLint report next() without a preceding query on every path.", "integration-test", "2026-08-20"),
    ev("tests/rules/stateful-lifecycle.test.ts", "Aliases, sibling reassignment, and completion-aware paths are unit-tested.", "fixture", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["Dynamic method names and escaped records stay silent."],
    overlaps: ["servicenow/validate-gliderecord-calls", "servicenow/validate-glideaggregate-calls"],
    lifecycleAssumptions:
      "chooseWindow does not execute a query. Aliases share object identity. Abrupt paths do not join into later statements.",
  }),
  "validate-gliderecord-calls": meta(classic(SERVER_SURFACES), [
    ev(SN_GR_GLOBAL, "Deprecated compatibility rule. Prefer require-query-before-next for query lifecycle.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "The rule remains exported and off by default.", "declaration-snapshot", "2026-08-20"),
  ], {
    falsePositives: ["Presets no longer enable this rule."],
    falseNegatives: ["Same unknown-binding silence as require-query-before-next."],
    overlaps: ["servicenow/require-query-before-next"],
  }),
  "no-br-current-update": meta(classic(["business-rule"]), [
    ev(SN_BR, "Business Rules should not call current.update() because the engine already writes the row.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/fixtures/bad-business-rule.br.js", "Host fixtures report current.update on Business Rule files.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: ["Server Script Includes that are not Business Rules."],
    falseNegatives: ["current aliases that escape before update."],
    overlaps: [],
  }),
  "no-hardcoded-table-names": meta(classic(SERVER_SURFACES), [
    ev(SN_GR, "Table names passed to GlideRecord constructors are string identities that do not rename safely.", "declaration-snapshot", "2026-08-20"),
    ev("tests/rules/glide-and-engine.test.ts", "Literal tables report; named constants and allow-lists stay silent.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Intentional literals for well-known platform tables when allowBuiltins is false."],
    falseNegatives: ["Table names stored in variables or computed members."],
    overlaps: ["servicenow/fluent-naming-convention"],
  }),
  "fluent-proper-imports": meta(fluent(), [
    ev(SN_FLUENT, "Fluent factories are imported from the documented @servicenow/sdk modules.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/fixtures/bad-fluent.now.ts", "Host fixtures report factories imported from the wrong module.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: ["Local functions that share a factory name and are not imported."],
    falseNegatives: ["Dynamic import specifiers."],
    overlaps: ["servicenow/require-fluent-id"],
  }),
  "fluent-directives": meta(fluent(), [
    ev(SN_FLUENT, "Fluent ignore directives are line- and file-scoped comments recognized by the SDK toolchain.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/dangling-fluent-ignore.now.ts", "A trailing @fluent-ignore without a following statement reports.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["Directives inside block comments that are not previous-line attachments."],
    overlaps: [],
  }),
  "prefer-now-include": meta(fluent(), [
    ev(SN_FLUENT_CONSTRUCTS, "Now.include() loads script and markup files so Fluent metadata stays declarative.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "Catalog examples cover large inline script versus Now.include.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Short template literals that still exceed a low custom maxLines."],
    falseNegatives: ["Large payloads built from concatenated expressions."],
    overlaps: ["servicenow/no-complex-fluent-logic"],
  }),
  "require-fluent-id": meta(fluent(), [
    ev(SN_FLUENT_CONSTRUCTS, "Factories whose manifest marks $id as required must declare Now.ID or an equivalent id.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/fluent-alias-missing-id.now.ts", "Aliased factory imports still require $id under recommended.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: ["APIs whose selected SDK manifest marks $id as optional."],
    falseNegatives: ["Ids assigned after the factory call."],
    overlaps: ["servicenow/no-duplicate-fluent-id", "servicenow/no-now-id-as-reference"],
  }),
  "fluent-naming-convention": meta(fluent(), [
    ev(SN_FLUENT, "Fluent file stems and Now.ID keys should stay stable kebab-case or snake_case identifiers.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "Catalog examples cover PascalCase files and kebab-case corrections.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Generated file names that include a required scope prefix."],
    falseNegatives: ["Ids constructed at runtime."],
    overlaps: ["servicenow/require-fluent-id"],
  }),
  "no-complex-fluent-logic": meta(fluent(), [
    ev(SN_FLUENT, "Fluent .now.ts files declare metadata; runtime loops belong in src/server.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "Catalog examples cover a runtime loop versus declarative metadata.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Small helper functions that remain declarative."],
    falseNegatives: ["Logic hidden behind imported helpers."],
    overlaps: ["servicenow/prefer-now-include"],
  }),
  "no-at-method": meta(engine(ES5_MODES), [
    ev(SN_JS_FEATURES, "Array.prototype.at is unsupported in Compatibility and ES5 Standards modes.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "Catalog examples cover array.at versus bracket access.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["User objects that define an at method and are not proven platform arrays."],
    falseNegatives: ["Computed member names."],
    overlaps: ["servicenow/no-unsupported-syntax"],
  }),
  "no-packages-calls": meta(classic(CLASSIC_SURFACES, ALL_MODES), [
    ev(SN_JS_FEATURES, "Packages.* Java interop is not a supported ServiceNow JavaScript API.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "Catalog examples cover Packages.java versus local bindings named Packages.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Object keys named Packages."],
    falseNegatives: ["Indirect Packages access through computed members."],
    overlaps: [],
  }),
  "no-weak-references": meta(classic(CLASSIC_SURFACES, ALL_MODES), [
    ev(SN_JS_FEATURES, "WeakRef and FinalizationRegistry are unsupported in instance JavaScript modes.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "Catalog examples cover WeakRef construction.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Local bindings that reuse those names."],
    falseNegatives: ["Dynamic construction through unknown identifiers."],
    overlaps: ["servicenow/no-weak-collections"],
  }),
  "no-weak-collections": meta(engine(ES5_MODES), [
    ev(SN_JS_FEATURES, "WeakMap and WeakSet are unsupported in Compatibility and ES5 Standards modes.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "Catalog examples cover WeakMap construction in ES5 mode.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Local bindings that reuse those names."],
    falseNegatives: ["Dynamic construction through unknown identifiers."],
    overlaps: ["servicenow/no-weak-references"],
  }),
  "no-typed-arrays": meta(engine(ES5_MODES), [
    ev(SN_JS_FEATURES, "Typed arrays are unsupported in Compatibility and ES5 Standards modes.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "Catalog examples cover Uint8Array construction.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Local bindings that reuse typed-array names."],
    falseNegatives: ["Dynamic construction through unknown identifiers."],
    overlaps: ["servicenow/no-unsupported-syntax"],
  }),
  "no-proxy": meta(engine(ES5_MODES), [
    ev(SN_JS_FEATURES, "Proxy is unsupported in Compatibility and ES5 Standards modes.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "Catalog examples cover new Proxy versus a local binding.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Local bindings named Proxy."],
    falseNegatives: ["Dynamic construction through unknown identifiers."],
    overlaps: ["servicenow/no-unsupported-syntax"],
  }),
  "no-unsupported-syntax": meta(engine(ES5_MODES), [
    ev(SN_JS_FEATURES, "Several ES2015+ syntactic forms are unsupported in Compatibility and ES5 Standards modes.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/es5-promise.server.js", "classic-es5 Oxlint flags unsupported syntax on the ES2021 fixture.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: ["Files whose javascriptMode is unknown or es2021."],
    falseNegatives: ["Syntax that oxc-parser does not represent as the documented node types."],
    overlaps: ["servicenow/no-async-await", "servicenow/no-bigint"],
  }),
  "no-delete-multiple-with-windowing": meta(classic(SERVER_SURFACES), [
    ev(SN_GR, "setLimit and chooseWindow do not limit deleteMultiple(); the call deletes every matching row.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/windowed-delete.br.js", "Recommended hosts report windowed deleteMultiple.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["Windowing applied through an escaped helper."],
    overlaps: ["servicenow/no-unfiltered-gliderecord-bulk-operation"],
    lifecycleAssumptions: "Window methods must resolve to the same GlideRecord object identity as deleteMultiple.",
  }),
  "require-callback-for-getreference": meta(classic(CLIENT_SURFACES), [
    ev(SN_FORM, "g_form.getReference without a callback is a synchronous server request.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/sync-getreference.client.js", "Recommended hosts report the one-argument form.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: ["Local objects named g_form that are not the platform global."],
    falseNegatives: ["Computed member names."],
    overlaps: [],
  }),
  "require-glideajax-sysparm-name": meta(classic(CLIENT_SURFACES), [
    ev(SN_AJAX, "GlideAjax requires a non-empty sysparm_name before getXML, getXMLAnswer, or getXMLWait.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/glideajax-empty-sysparm.client.js", "Empty or missing sysparm_name values report on the client host fixtures.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["Dynamic sysparm_name values stay silent."],
    overlaps: ["servicenow/no-glideajax-getanswer", "servicenow/no-sync-glideajax"],
    lifecycleAssumptions: "A later request on the same object requires a new usable sysparm_name.",
  }),
  "validate-glideaggregate-calls": meta(classic(SERVER_SURFACES), [
    ev(SN_GR, "getAggregate reads a tuple that addAggregate registered before the open query.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/aggregate-type-only-field.br.js", "Type-only COUNT does not satisfy a field-specific getAggregate.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["Dynamic aggregate types or fields stay silent."],
    overlaps: ["servicenow/require-query-before-next"],
    lifecycleAssumptions:
      "Must-tuples intersect on join. addAggregate after query() does not validate the already-open result.",
  }),
  "no-now-id-as-reference": meta(fluent(), [
    ev(SN_FLUENT_CONSTRUCTS, "Now.ID is a metadata identity, not an in-app record reference.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/now-id-ref.now.ts", "Recommended hosts report Now.ID used as a reference field.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: ["Local objects named Now that are not the platform global."],
    falseNegatives: ["Ids copied through unknown helpers."],
    overlaps: ["servicenow/require-fluent-id"],
  }),
  "no-glideajax-getanswer": meta(classic(CLIENT_SURFACES), [
    ev(SN_GLIDEAJAX, "getAnswer belongs to the synchronous getXMLWait pattern.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/glideajax-getanswer.client.js", "Recommended hosts report getAnswer on proven GlideAjax objects.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["getAnswer through an escaped or unknown receiver."],
    overlaps: ["servicenow/no-sync-glideajax"],
  }),
  "no-duplicate-fluent-id": meta(fluent(), [
    ev(SN_FLUENT_CONSTRUCTS, "Now.ID keys must be unique in a file so keys.ts can track records.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/duplicate-id.now.ts", "Recommended hosts report duplicate Now.ID keys.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["Keys built from runtime expressions."],
    overlaps: ["servicenow/require-fluent-id"],
  }),
  "no-glideelement-in-collection": meta(classic(SERVER_SURFACES), [
    ev(SN_GR, "A GlideElement from a cursor follows the cursor; collections must store extracted values.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/glideelement-push.br.js", "Recommended hosts report pushing a cursor field into an array.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["Stores through unknown helpers or computed members."],
    overlaps: [],
  }),
  "no-gliderecord-query-modifier-after-query": meta(classic(SERVER_SURFACES), [
    ev(SN_GR_GLOBAL, "Query modifiers after query() or get() do not change the open cursor.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/late-modifier.br.js", "Recommended hosts report addQuery after query before next.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["A second query() before next() is allowed and stays silent."],
    overlaps: ["servicenow/require-query-before-next"],
    lifecycleAssumptions: "Modifiers after query are findings only when a consumer uses the still-open cursor.",
  }),
  "require-business-rule-wrapper": meta(
    {
      authoring: "classic",
      surfaces: ["business-rule"],
      minimumSurfaceConfidence: "explicit-only",
      javascriptModes: "n/a",
      scopes: ALL_SCOPES,
      serviceNowReleases: [...ZURICH],
    },
    [
      ev(SN_BR, "Full-script Business Rules use the executeRule(current, previous) IIFE so top-level bindings do not leak.", "declaration-snapshot", "2026-08-20"),
      ev("tests/integration/profiles/invalid/unwrapped.br.js", "The wrapper rule reports only when businessRuleSourceFormat is full-script.", "integration-test", "2026-08-20"),
    ],
    {
      falsePositives: ["Body-only Business Rule source, which is the default unknown format."],
      falseNegatives: ["Wrappers that do not use the documented executeRule name."],
      overlaps: [],
    },
  ),
  "no-display-value-date-comparison": meta(classic(SERVER_SURFACES), [
    ev(SN_GDT, "GlideDateTime.getDisplayValue() follows the session format and is not a chronological sort key.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "Catalog examples cover display-value comparison versus getNumericValue.", "fixture", "2026-08-20"),
  ], {
    falsePositives: ["Equality checks that only display the string."],
    falseNegatives: ["Display values copied into locals before comparison."],
    overlaps: ["servicenow/no-gs-now"],
  }),
  "no-unfiltered-gliderecord-bulk-operation": meta(classic(SERVER_SURFACES), [
    ev(SN_GR, "updateMultiple and deleteMultiple apply to every row that matches the query filters.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/empty-addquery-bulk.br.js", "Empty or missing addQuery arguments do not count as filters.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["Dynamic encoded queries stay silent."],
    overlaps: ["servicenow/no-delete-multiple-with-windowing"],
    lifecycleAssumptions: "query, orderBy, setLimit, and chooseWindow are not restricting filters.",
  }),
  "no-gliderecord-query-in-loop": meta(classic(SERVER_SURFACES), [
    ev(SN_GR, "query or get inside a next() loop is an N+1 pattern on the GlideRecord cursor.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/nested-cursor-query.br.js", "Strict hosts report a nested query inside a proven cursor loop.", "integration-test", "2026-08-20"),
    ev("tests/integration/profiles/valid/custom-iterator-loop.br.js", "Custom iterators with next() do not establish cursor depth.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["Unknown or escaped loop receivers stay silent."],
    overlaps: ["servicenow/require-query-before-next"],
    lifecycleAssumptions: "Only a proven unescaped GlideRecord or GlideAggregate next() receiver establishes cursor depth.",
  }),
  "prefer-setnocount-with-choosewindow": meta(classic(SERVER_SURFACES), [
    ev(SN_GR, "query() after chooseWindow() runs COUNT(*) unless setNoCount() or setLimit() skips it.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/setnocount-second-query.br.js", "A later query epoch is not justified by an earlier getRowCount().", "integration-test", "2026-08-20"),
  ], {
    falsePositives: ["chooseWindow that forces a count with a boolean literal third argument."],
    falseNegatives: ["Unknown third arguments stay silent."],
    overlaps: ["servicenow/require-query-before-next"],
    lifecycleAssumptions: "Window and setNoCount state are scoped to one query epoch and one object identity.",
  }),
  "no-system-query-bypass": meta(classic(SERVER_SURFACES), [
    ev(SN_GR, "addSystemQuery and related methods bypass query ACLs and need review.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/system-query.br.js", "The security profile reports documented ACL-bypass methods.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: ["Intentional admin maintenance scripts."],
    falseNegatives: ["Bypass methods reached through computed names."],
    overlaps: [],
  }),
  "no-sync-glideajax": meta(classic(CLIENT_SURFACES), [
    ev(SN_GLIDEAJAX, "getXMLWait is a synchronous browser request.", "declaration-snapshot", "2026-08-20"),
    ev("src/catalog.ts", "Catalog examples cover getXMLWait versus getXMLAnswer.", "fixture", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["Unknown GlideAjax receivers stay silent."],
    overlaps: ["servicenow/no-glideajax-getanswer"],
  }),
  "no-async-iterators": meta(engine(ALL_MODES), [
    ev(SN_JS_FEATURES, "for await...of and async generators are disallowed in every instance JavaScript mode.", "declaration-snapshot", "2026-08-20"),
    ev("tests/integration/profiles/invalid/es2021-async-iter.server.js", "es2021 Oxlint still flags async iteration.", "integration-test", "2026-08-20"),
  ], {
    falsePositives: [],
    falseNegatives: ["Async iteration compiled away before lint."],
    overlaps: ["servicenow/no-async-await"],
  }),
};

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

export function formatLimitations(metadata: RuleDocMetadata): string {
  const parts = [
    ...metadata.falsePositives.map((item) => `False positive: ${item}`),
    ...metadata.falseNegatives.map((item) => `False negative: ${item}`),
  ];
  if (metadata.lifecycleAssumptions) {
    parts.push(`Lifecycle: ${metadata.lifecycleAssumptions}`);
  }
  if (parts.length === 0) {
    return UNKNOWN_SILENT;
  }
  return `${UNKNOWN_SILENT} ${parts.join(" ")}`;
}
