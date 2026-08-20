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
import { noGliderecordQueryInLoop } from "./rules/no-gliderecord-query-in-loop.js";
import { noGliderecordQueryModifierAfterQuery } from "./rules/no-gliderecord-query-modifier-after-query.js";
import { noGsNow } from "./rules/no-gs-now.js";
import { noHardcodedSysid } from "./rules/no-hardcoded-sysid.js";
import { noHardcodedTableNames } from "./rules/no-hardcoded-table-names.js";
import { noNowIdAsReference } from "./rules/no-now-id-as-reference.js";
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
import type { ApplicationScope, JavaScriptMode, ServiceNowSettings } from "./types.js";
import {
  formatJavascriptModes,
  formatLimitations,
  formatSurfaces,
  ruleDocMetadata,
  type RuleEvidenceRecord,
  type SurfaceConfidence,
} from "./catalog-metadata.js";
import { optionDocsFromDescriptor, RULE_OPTION_DESCRIPTORS } from "./options/index.js";
import type { RuleOptionDoc } from "./options/descriptor.js";

export type RuleFamily = "classic" | "fluent" | "engine";
export type RulePreset = "recommended" | "strict" | "classic-es5" | "es2021" | false;
export type RuleProfile =
  | "recommended"
  | "strict"
  | "classic-es5"
  | "es2021"
  | "client"
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
  minimumSurfaceConfidence: SurfaceConfidence;
  javascriptModes: readonly JavaScriptMode[] | "n/a";
  scopes: readonly ApplicationScope[];
  serviceNowReleases: readonly string[];
  fluentSdkRange?: string;
}

const ES5: ServiceNowSettings = { javascriptMode: "es5" };

export interface RuleExample {
  name: string;
  filename?: string;
  code: string;
  settings?: ServiceNowSettings;
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
  evidence: readonly RuleEvidenceRecord[];
  limitations: string;
  falsePositives: readonly string[];
  falseNegatives: readonly string[];
  overlaps: readonly string[];
  lifecycleAssumptions?: string;
  fixKind: "none" | "safe-fix" | "suggestion";
  options: readonly RuleOptionDoc[];
  lastVerified: string;
}

type RuleCatalogInput = Omit<
  RuleCatalogEntry,
  | "name"
  | "implementation"
  | "ruleId"
  | "docsUrl"
  | "placements"
  | "applicability"
  | "evidence"
  | "limitations"
  | "falsePositives"
  | "falseNegatives"
  | "overlaps"
  | "lifecycleAssumptions"
  | "fixKind"
  | "options"
  | "lastVerified"
> & {
  placements?: readonly RulePlacement[];
};

const EXTRA_PLACEMENTS: Partial<Record<string, readonly RulePlacement[]>> = {
  "no-async-iterators": [
    { profile: "classic-es5", severity: "error" },
    { profile: "es2021", severity: "error" },
  ],
  "no-weak-references": [
    { profile: "classic-es5", severity: "error" },
    { profile: "es2021", severity: "error" },
  ],
  "no-typed-arrays": [{ profile: "es2021", severity: "error" }],
  "no-client-gliderecord": [{ profile: "client", severity: "error" }],
  "no-gs-now": [{ profile: "client", severity: "error" }],
  "no-sync-glideajax": [{ profile: "client", severity: "error" }],
  "require-callback-for-getreference": [{ profile: "client", severity: "error" }],
  "require-glideajax-sysparm-name": [{ profile: "client", severity: "error" }],
  "no-glideajax-getanswer": [{ profile: "client", severity: "error" }],
  "no-br-current-update": [{ profile: "business-rule", severity: "error" }],
  "require-query-before-next": [{ profile: "business-rule", severity: "error" }],
  "no-delete-multiple-with-windowing": [{ profile: "business-rule", severity: "error" }],
  "validate-glideaggregate-calls": [{ profile: "business-rule", severity: "error" }],
  "require-business-rule-wrapper": [{ profile: "business-rule", severity: "error" }],
  "no-glideelement-in-collection": [{ profile: "business-rule", severity: "error" }],
  "no-gliderecord-query-modifier-after-query": [{ profile: "business-rule", severity: "error" }],
  "fluent-proper-imports": [{ profile: "fluent", severity: "error" }],
  "fluent-directives": [{ profile: "fluent", severity: "warn" }],
  "require-fluent-id": [{ profile: "fluent", severity: "error" }],
  "no-now-id-as-reference": [{ profile: "fluent", severity: "error" }],
  "no-duplicate-fluent-id": [{ profile: "fluent", severity: "error" }],
  "no-hardcoded-table-names": [{ profile: "policy", severity: "warn" }],
  "no-complex-fluent-logic": [{ profile: "policy", severity: "warn" }],
  "no-system-query-bypass": [{ profile: "security", severity: "warn" }],
};

function entry<N extends string>(name: N, implementation: Rule, rest: RuleCatalogInput): RuleCatalogEntry & { name: N } {
  const meta = ruleDocMetadata[name];
  if (!meta) {
    throw new Error(`Missing catalog metadata for ${name}`);
  }
  const primary: RulePlacement[] =
    rest.preset === false ? [] : [{ profile: rest.preset, severity: rest.severity }];
  const extras = EXTRA_PLACEMENTS[name] ?? [];
  const descriptor = RULE_OPTION_DESCRIPTORS[name as keyof typeof RULE_OPTION_DESCRIPTORS];
  const applicability: RuleApplicability = {
    authoring: meta.applicability.authoring,
    surfaces: formatSurfaces(meta.applicability.surfaces),
    javascriptMode: formatJavascriptModes(meta.applicability.javascriptModes),
    minimumSurfaceConfidence: meta.applicability.minimumSurfaceConfidence,
    javascriptModes: meta.applicability.javascriptModes,
    scopes: meta.applicability.scopes,
    serviceNowReleases: meta.applicability.serviceNowReleases,
    fluentSdkRange: meta.applicability.fluentSdkRange,
  };
  return {
    name,
    implementation,
    ruleId: `${PLUGIN_NAME}/${name}`,
    docsUrl: ruleDocsUrl(name),
    ...rest,
    placements: rest.placements ?? [...primary, ...extras],
    applicability,
    evidence: meta.evidence,
    limitations: formatLimitations(meta),
    falsePositives: meta.falsePositives,
    falseNegatives: meta.falseNegatives,
    overlaps: meta.overlaps,
    lifecycleAssumptions: meta.lifecycleAssumptions,
    fixKind: rest.fixable ? "safe-fix" : rest.hasSuggestions ? "suggestion" : "none",
    options: descriptor ? optionDocsFromDescriptor(descriptor) : [],
    lastVerified: meta.lastVerified,
  };
}

export const ruleCatalog = [
  entry("no-hardcoded-sysid", noHardcodedSysid, {
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
    title: "No Promise",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Compatibility and ES5 Standards modes do not implement Promises. The rule is silent when JavaScript mode is unknown or ES2021. Local `Promise` bindings are ignored.",
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
    title: "No BigInt",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "BigInt literals and `BigInt()` are unsupported in Compatibility or ES5 Standards mode.",
    bad: [{ name: "literal", filename: "script-include.js", settings: ES5, code: `var n = 9007199254740993n;` }],
    good: [{ name: "number", filename: "script-include.js", code: `var n = 9007199254740991;` }],
  }),
  entry("prefer-glideaggregate", preferGlideaggregate, {
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
    title: "No client GlideRecord",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Client-side GlideRecord is slow, often blocked, and a security smell. Use GlideAjax, Scripted REST, or `g_form.getReference()`.",
    bad: [
      {
        name: "client script",
        filename: "incident.client.js",
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
      { name: "gs.nowDateTime", filename: "incident.br.js", code: `current.u_opened = gs.nowDateTime();` },
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
    title: "Require query before next",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Require a proven GlideRecord binding to call `.query()` or `.get()` before `.next()`. `chooseWindow()` does not execute a query. Ambiguous branches are silent.",
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
    title: "Validate GlideRecord calls",
    family: "classic",
    preset: false,
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Deprecated alias. Prefer `require-query-before-next`. Still reports missing query-before-next and unused insert/update/get/next returns. `chooseWindow()` does not open a cursor.",
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
    title: "Fluent directives",
    family: "fluent",
    preset: "recommended",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Validate `@fluent-ignore`, `@fluent-disable-sync`, and `@fluent-disable-sync-for-file` against the selected SDK manifest. Previous-line directives attach to the next statement. Catch typos and reject `@ts-ignore` as a Fluent suppress.",
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
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-state"],\n  table: "incident",\n  name: "Log state",\n  when: "after",\n            action: ["update"],\n});`,
      },
    ],
  }),
  entry("fluent-naming-convention", fluentNamingConvention, {
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
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-state"],\n  table: "incident",\n            name: "Log state",\n});`,
      },
    ],
  }),
  entry("no-complex-fluent-logic", noComplexFluentLogic, {
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
    title: "No .at()",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "`.at()` is not implemented in Compatibility or ES5 Standards mode.",
    bad: [{ name: "at", filename: "script-include.js", settings: ES5, code: `var last = list.at(-1);` }],
    good: [{ name: "index", filename: "script-include.js", code: `var last = list[list.length - 1];` }],
  }),
  entry("no-packages-calls", noPackagesCalls, {
    title: "No Packages.*",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "The Rhino `Packages.*` Java bridge is unavailable in scoped apps and on the modern engine.",
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
    title: "No WeakRef / FinalizationRegistry",
    family: "engine",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "WeakRef and FinalizationRegistry are disallowed in every instance JavaScript mode, including ES2021.",
    bad: [{ name: "WeakRef", filename: "script-include.js", code: `var ref = new WeakRef(obj);` }],
    good: [{ name: "Map", filename: "script-include.js", code: `var cache = new Map();` }],
  }),
  entry("no-weak-collections", noWeakCollections, {
    title: "No WeakMap / WeakSet",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "WeakMap and WeakSet are disallowed in Compatibility and ES5 Standards mode. ES2021 supports them.",
    bad: [{ name: "WeakMap", filename: "script-include.js", settings: ES5, code: `var cache = new WeakMap();` }],
    good: [{ name: "Map", filename: "script-include.js", settings: ES5, code: `var cache = new Map();` }],
  }),
  entry("no-typed-arrays", noTypedArrays, {
    title: "No TypedArray / DataView",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "TypedArray and DataView constructors are unsupported in Compatibility and ES5 Standards mode. ES2021 still rejects BigInt64Array / BigUint64Array.",
    bad: [
      {
        name: "Int8Array",
        filename: "script-include.js",
        settings: ES5,
        code: `var bytes = new Int8Array(16);`,
      },
    ],
    good: [{ name: "plain array", filename: "script-include.js", code: `var bytes = [0, 1, 2];` }],
  }),
  entry("no-proxy", noProxy, {
    title: "No Proxy",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "`Proxy` is unsupported in Compatibility and ES5 Standards mode.",
    bad: [{ name: "new Proxy", filename: "script-include.js", settings: ES5, code: `var p = new Proxy(target, handler);` }],
    good: [{ name: "plain object", filename: "script-include.js", code: `var p = { prop: value };` }],
  }),
  entry("no-unsupported-syntax", noUnsupportedSyntax, {
    title: "No unsupported ES-latest syntax",
    family: "engine",
    preset: "classic-es5",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Optional chaining, nullish coalescing, logical assignment, private instance members, and RegExp lookbehind are unsupported in Compatibility and ES5 Standards mode.",
    bad: [
      {
        name: "optional chaining and ??",
        filename: "script-include.js",
        settings: ES5,
        code: `var name = current.caller_id?.name ?? "unknown";`,
      },
    ],
    good: [
      {
        name: "explicit check",
        filename: "script-include.js",
        code: `var name = current.caller_id ? current.caller_id.name : "unknown";`,
      },
    ],
  }),
  entry("no-delete-multiple-with-windowing", noDeleteMultipleWithWindowing, {
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
    title: "Require GlideAjax sysparm_name",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "GlideAjax requires a non-empty `addParam(\"sysparm_name\", method)` before `getXML` / `getXMLAnswer` / `getXMLWait`. Extra static keys must start with `sysparm_`. Evidence: https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html",
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
    title: "No GlideElement in a collection",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Direct GlideRecord field access is a GlideElement tied to the cursor. Do not `push` / `unshift` it inside a `.next()` loop. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html",
    bad: [
      {
        name: "push field",
        filename: "incident.br.js",
        code: `var numbers = [];\nvar incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  numbers.push(incident.number);\n}`,
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
    title: "No query modifier after query",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Filters and result-shaping calls after `query()` do not change the open cursor. Report when `next()` consumes that cursor first.",
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
    title: "No unfiltered GlideRecord bulk operation",
    family: "classic",
    preset: "recommended",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "`updateMultiple()` / `deleteMultiple()` without a proven restricting filter can touch every row. `query`, `orderBy`, `setLimit`, and `chooseWindow` are not filters. Empty `addQuery()` / `addEncodedQuery(\"\")` do not count.",
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
  entry("no-gliderecord-query-in-loop", noGliderecordQueryInLoop, {
    title: "No GlideRecord query in a cursor loop",
    family: "classic",
    preset: "strict",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "A `query()`, `get()`, or `getAsync()` inside a proven GlideRecord / GlideAggregate `.next()` loop is an N+1 pattern. Unrelated iterators with `.next()` do not establish cursor depth.",
    bad: [
      {
        name: "nested get",
        filename: "incident.br.js",
        code: `var incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  var caller = new GlideRecord("sys_user");\n  caller.get(incident.getValue("caller_id"));\n  gs.info(caller.getDisplayValue());\n}`,
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
    title: "Prefer setNoCount with chooseWindow",
    family: "classic",
    preset: "strict",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Zurich scoped GlideRecord documents that `query()` after `chooseWindow()` runs `COUNT(*)` unless `setNoCount()` or `setLimit()` skips it. The rule is silent when `getRowCount()` is used, when `chooseWindow` forces a count, or when the binding escapes. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html",
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
    title: "Review system query ACL bypass",
    family: "classic",
    preset: false,
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Opt-in security review for documented ACL-bypass query APIs: `addSystemQuery`, `addSystemEncodedQuery`, `addSystemOrderBy`, `addSystemOrderByDesc`.",
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
    title: "No async iterators",
    family: "engine",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "`for await…of` and async generators are disallowed in every instance JavaScript mode, including ES2021.",
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

export function getRuleCatalogEntry(name: string): RuleCatalogEntry | undefined {
  return ruleCatalog.find((rule) => rule.name === name || rule.ruleId === name);
}

export type RuleName = (typeof ruleCatalog)[number]["name"];
