import { PLUGIN_NAME, ruleDocsUrl } from "./constants.js";
import type { RuleName } from "./rules/index.js";

export type RuleFamily = "classic" | "fluent" | "engine";
export type RulePreset = "recommended" | "strict" | false;

export interface RuleExample {
  name: string;
  filename?: string;
  code: string;
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
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "The classic ServiceNow JavaScript engine does not implement Promises. Stay synchronous, or opt the file into ES latest.",
    bad: [
      {
        name: "constructor and then",
        filename: "script-include.js",
        code: `var p = new Promise(function (resolve) { resolve(1); });\np.then(function (value) { gs.info(value); });`,
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
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "async/await is not implemented on the classic engine.",
    bad: [
      {
        name: "async function",
        filename: "script-include.js",
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
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "BigInt literals and `BigInt()` are unsupported on the classic engine.",
    bad: [{ name: "literal", filename: "script-include.js", code: `var n = 9007199254740993n;` }],
    good: [{ name: "number", filename: "script-include.js", code: `var n = 9007199254740991;` }],
  }),
  entry("prefer-glideaggregate", {
    title: "Prefer GlideAggregate",
    family: "classic",
    preset: "recommended",
    severity: "warn",
    fixable: false,
    hasSuggestions: true,
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
    hasSuggestions: true,
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
  entry("validate-gliderecord-calls", {
    title: "Validate GlideRecord calls",
    family: "classic",
    preset: "recommended",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Require `.query()` / `.get()` before `.next()`, and require the return values of `insert`, `update`, `get`, and `next` to be checked.",
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
      "`current.update()` retriggers other Business Rules and can recurse. Set fields on `current` and let the platform save. Reports on Business Rule and `src/server/**` files. UI Actions are exempt. Override with `settings.servicenow.scriptType`.",
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
    preset: "strict",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "String-literal table names in `GlideRecord` / `GlideRecordSecure` / `GlideAggregate` are hard to rename. Prefer named constants or Fluent table exports.",
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
    fixable: true,
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
      "Validate `@fluent-ignore` and `@fluent-disable-sync`, catch typos, and reject `@ts-ignore` as a Fluent suppress.",
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
    preset: "recommended",
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
    preset: "recommended",
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
    preset: "recommended",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "`.now.ts` files should declare metadata. Loops, classes, try/catch, and multi-statement functions belong in `src/server/`.",
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
    preset: "recommended",
    severity: "warn",
    fixable: false,
    hasSuggestions: true,
    description: "`.at()` is not implemented on the classic engine.",
    bad: [{ name: "at", filename: "script-include.js", code: `var last = list.at(-1);` }],
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
    title: "No weak references",
    family: "engine",
    preset: "strict",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "WeakMap / WeakSet / WeakRef / FinalizationRegistry are unsupported classically.",
    bad: [{ name: "WeakMap", filename: "script-include.js", code: `var cache = new WeakMap();` }],
    good: [{ name: "Map", filename: "script-include.js", code: `var cache = new Map();` }],
  }),
  entry("no-typed-arrays", {
    title: "No TypedArray / DataView",
    family: "engine",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "TypedArray and DataView constructors are unsupported on the classic engine.",
    bad: [
      {
        name: "Int8Array",
        filename: "script-include.js",
        code: `var bytes = new Int8Array(16);`,
      },
    ],
    good: [{ name: "plain array", filename: "script-include.js", code: `var bytes = [0, 1, 2];` }],
  }),
  entry("no-proxy", {
    title: "No Proxy",
    family: "engine",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "`Proxy` is unsupported on the classic engine.",
    bad: [{ name: "new Proxy", filename: "script-include.js", code: `var p = new Proxy(target, handler);` }],
    good: [{ name: "plain object", filename: "script-include.js", code: `var p = { prop: value };` }],
  }),
  entry("no-unsupported-syntax", {
    title: "No unsupported ES-latest syntax",
    family: "engine",
    preset: "recommended",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Optional chaining, nullish coalescing, logical assignment, private class members, and RegExp lookbehind are unsupported classically.",
    bad: [
      {
        name: "optional chaining and ??",
        filename: "script-include.js",
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
    preset: "strict",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description: "`for await…of` and async generators are unsupported classically.",
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
