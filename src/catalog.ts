import { PLUGIN_NAME, ruleDocsUrl } from "./constants.js";
import type { RuleName } from "./rules/index.js";
import type { ServiceNowSettings } from "./types.js";

export type RuleFamily = "classic" | "fluent" | "engine";
export type RulePreset = "recommended" | "strict" | "classic-es5" | "es2021" | false;

const ES5: ServiceNowSettings = { javascriptMode: "es5" };

export interface RuleExample {
  name: string;
  filename?: string;
  code: string;
  settings?: ServiceNowSettings;
}

export interface RuleCatalogEntry {
  name: RuleName;
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
}

function entry(
  name: RuleName,
  rest: Omit<RuleCatalogEntry, "name" | "ruleId" | "docsUrl">,
): RuleCatalogEntry {
  return {
    name,
    ruleId: `${PLUGIN_NAME}/${name}`,
    docsUrl: ruleDocsUrl(name),
    ...rest,
  };
}

export const ruleCatalog: RuleCatalogEntry[] = [
  entry("no-hardcoded-sysid", {
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
  entry("no-promise", {
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
  entry("no-async-await", {
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
  entry("no-bigint", {
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
  entry("prefer-glideaggregate", {
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
  entry("no-client-gliderecord", {
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
  entry("no-gs-now", {
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
  entry("require-query-before-next", {
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
  entry("validate-gliderecord-calls", {
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
  entry("no-br-current-update", {
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
  entry("no-hardcoded-table-names", {
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
  entry("fluent-proper-imports", {
    title: "Fluent imports from @servicenow/sdk/core",
    family: "fluent",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "Fluent entity and column APIs must be imported from `@servicenow/sdk/core`.",
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
  entry("fluent-directives", {
    title: "Fluent directives",
    family: "fluent",
    preset: "recommended",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Validate `@fluent-ignore`, `@fluent-disable-sync`, and `@fluent-disable-sync-for-file`, catch typos, and reject `@ts-ignore` as a Fluent suppress.",
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
  entry("prefer-now-include", {
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
  entry("require-fluent-id", {
    title: "Require Fluent $id",
    family: "fluent",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Fluent entities must declare `$id`. Prefer `Now.ID['descriptive-key']` so `keys.ts` stays readable.",
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
  entry("fluent-naming-convention", {
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
  entry("no-complex-fluent-logic", {
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
  entry("no-at-method", {
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
  entry("no-packages-calls", {
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
  entry("no-weak-references", {
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
  entry("no-weak-collections", {
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
  entry("no-typed-arrays", {
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
  entry("no-proxy", {
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
  entry("no-unsupported-syntax", {
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
  entry("no-delete-multiple-with-windowing", {
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
  entry("require-callback-for-getreference", {
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
  entry("require-glideajax-sysparm-name", {
    title: "Require GlideAjax sysparm_name",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "GlideAjax requires `addParam(\"sysparm_name\", method)` before `getXML` / `getXMLAnswer` / `getXMLWait`. Extra static keys must start with `sysparm_`. Evidence: https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html",
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
  entry("validate-glideaggregate-calls", {
    title: "Validate GlideAggregate calls",
    family: "classic",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "A proven GlideAggregate must call `query()` before `next()` or `getAggregate()`. Static `getAggregate(type, field?)` must match a registered `addAggregate` tuple.",
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
  entry("no-now-id-as-reference", {
    title: "No Now.ID as a reference",
    family: "fluent",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`Now.ID[...]` is a metadata identity, not a reference. Use the factory object in-app or `Now.ref()` for external records. Evidence: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html",
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
  entry("no-glideajax-getanswer", {
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
  entry("no-duplicate-fluent-id", {
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
  entry("no-sync-glideajax", {
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
  entry("no-async-iterators", {
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
