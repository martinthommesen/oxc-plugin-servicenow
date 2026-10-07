import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { configs } from "../../src/index.js";
import type { RuleName } from "../../src/rules/index.js";
import type { ServiceNowSettings } from "../../src/types.js";
import { createTemporaryProject, eslintRuleIds, pluginRulesFor, runOxlint } from "./helpers.js";

interface HostFindingCase {
  readonly rule: RuleName;
  readonly code: string;
  readonly count: number;
}

function assertHostFindings(
  fixture: HostFindingCase,
  options: { filename: string; prefix: string; settings: ServiceNowSettings },
): void {
  const rule = `servicenow/${fixture.rule}`;
  const config = {
    ...configs.flat.recommended,
    settings: { servicenow: options.settings },
    rules: { [rule]: "error" },
  };
  assert.deepEqual(
    eslintRuleIds(config, fixture.code, options.filename),
    Array(fixture.count).fill(rule),
  );
  const project = createTemporaryProject({
    prefix: options.prefix,
    filename: options.filename,
    code: fixture.code,
    settings: options.settings,
    rules: { [rule]: "error" },
  });
  try {
    assert.deepEqual(
      pluginRulesFor(runOxlint(project.config, [project.source])),
      Array(fixture.count).fill(rule),
    );
  } finally {
    project.cleanup();
  }
}

const cases = [
  {
    name: "static template tail after a dynamic prefix",
    rule: "no-hardcoded-sysid",
    code: "var url = `${prefix}/97c04b3b1b12100043ab85e5bd0713e2`;",
    settings: { surfaces: ["server"] },
    count: 1,
  },
  {
    name: "dynamic template edge cannot prove a token boundary",
    rule: "no-hardcoded-sysid",
    code: "var url = `97c04b3b1b12100043ab85e5bd0713e2${suffix}`;",
    settings: { surfaces: ["server"] },
    count: 0,
  },
  {
    name: "character class lookbehind marker is ordinary text",
    rule: "no-unsupported-syntax",
    code: 'var re = /[(?<=)]/; new RegExp("[(?<!)]");',
    settings: { javascriptMode: "es5", surfaces: ["server"] },
    count: 0,
  },
  {
    name: "real lookbehind after a class remains unsupported",
    rule: "no-unsupported-syntax",
    code: "var re = /[(?<=)](?<=a)b/;",
    settings: { javascriptMode: "es5", surfaces: ["server"] },
    count: 1,
  },
  {
    name: "later compound-condition mutation invalidates availability",
    rule: "no-weak-references",
    code: 'if (typeof WeakRef === "function" && (Object.defineProperty(globalThis, "WeakRef", { value: null }), true)) { new WeakRef(value); }',
    settings: { javascriptMode: "es2021", release: "australia", surfaces: ["server"] },
    count: 1,
  },
  {
    name: "a trailing check restores availability proof",
    rule: "no-weak-references",
    code: 'if ((WeakRef = null, true) && typeof WeakRef === "function") { new WeakRef(value); }',
    settings: { javascriptMode: "es2021", release: "australia", surfaces: ["server"] },
    count: 0,
  },
  {
    name: "unreachable logical suffix writes preserve availability",
    rule: "no-weak-references",
    code: 'if (typeof WeakRef === "function" && (false && (WeakRef = undefined), true)) { new WeakRef(value); }',
    settings: { javascriptMode: "es2021", release: "australia", surfaces: ["server"] },
    count: 0,
  },
  {
    name: "unreachable for-loop update preserves availability",
    rule: "no-weak-references",
    code: 'if (typeof WeakRef === "function" && ((function () { for (; false; WeakRef = undefined) {} })(), true)) { new WeakRef(value); }',
    settings: { javascriptMode: "es2021", release: "australia", surfaces: ["server"] },
    count: 0,
  },
  {
    name: "unreachable conditional suffix writes preserve method availability",
    rule: "no-unsupported-static-methods",
    code: 'if (typeof Error.isError === "function" && (true ? true : (Error.isError = undefined))) { Error.isError(value); }',
    settings: { javascriptMode: "es2021", release: "zurich", surfaces: ["server"] },
    count: 0,
  },
] satisfies (HostFindingCase & { name: string; settings: ServiceNowSettings })[];

// @lat: [[tests#Integration#Correctness proofs agree across lint hosts]]
describe("finding correctness across lint hosts", () => {
  for (const fixture of cases) {
    it(fixture.name, () => {
      assertHostFindings(fixture, {
        prefix: "findings-rule-",
        filename: "fixture.server.js",
        settings: fixture.settings,
      });
    });
  }
});

// @lat: [[tests#Integration#Mixed UI Action gates remain rule-specific]]
describe("mixed UI Action applicability", () => {
  const settings = {
    surfaces: ["ui-action", "client", "server"],
    javascriptMode: "es5",
    release: "australia",
  } satisfies ServiceNowSettings;
  for (const fixture of [
    {
      rule: "require-query-before-next",
      code: 'var gr = new GlideRecord("incident"); gr.next();',
      count: 1,
    },
    {
      rule: "validate-glideaggregate-calls",
      code: 'var ga = new GlideAggregate("incident"); ga.next();',
      count: 1,
    },
    {
      rule: "require-callback-for-getreference",
      code: 'g_form.getReference("caller_id");',
      count: 1,
    },
    {
      rule: "no-sync-glideajax",
      code: 'var ga = new GlideAjax("Example"); ga.getXMLWait();',
      count: 1,
    },
    { rule: "no-promise", code: "Promise.resolve(value);", count: 0 },
  ] satisfies HostFindingCase[]) {
    it(fixture.rule, () => {
      assertHostFindings(fixture, {
        prefix: "findings-mixed-",
        filename: "fixture.ui-action.js",
        settings,
      });
    });
  }
});
