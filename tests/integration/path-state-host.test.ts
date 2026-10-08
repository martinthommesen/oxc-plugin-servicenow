import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import plugin from "../../src/index.js";
import { createTemporaryProject, eslintRuleIds, runOxlintProcess } from "./helpers.js";

const cases = [
  {
    name: "logical-helper-false-argument",
    code: `var gr = new GlideRecord("task"); function use(flag) { flag &&= (gr.next(), gr); } use(false);`,
    expected: [],
  },
  {
    name: "hoisted-logical-selector",
    code: `var gr = new GlideRecord("task"); fn ||= (gr.next(), gr); function fn() {}`,
    expected: [],
  },
  {
    name: "selected-logical-if",
    code: `var gr = new GlideRecord("task"); var flag = false; if (flag &&= true) gr.next();`,
    expected: [],
  },
  {
    name: "deferred-instance-field-query",
    code: `var gr = new GlideRecord("task"); class C { value = gr.query(); } gr.next();`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "path-selected-member-receiver",
    code: `var gr = new GlideRecord("task"); var alias = external; (alias ||= gr).next(alias = {});`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "false-while",
    code: `var gr = new GlideRecord("incident"); while (false) { gr.next(); }`,
    expected: [],
  },
  {
    name: "false-for-mutation",
    code: `var gr = new GlideRecord("incident"); for (; false;) { gr = {}; } gr.next();`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "optional-helper",
    code: `var gr = new GlideRecord("incident"); var run = function () {}; if (flag) { run = function () { gr.query(); }; } run(); gr.next();`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "both-helpers-query",
    code: `var gr = new GlideRecord("incident"); var run; if (flag) { run = function () { gr.query(); }; } else { run = function () { gr.get("sys_id"); }; } run(); gr.next();`,
    expected: [],
  },
  {
    name: "uncalled-helper-write",
    code: `var gr = new GlideRecord("incident"); var run = function () {}; function deferred() { run = function () { gr.query(); }; } run(); gr.next();`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "correlated-helper",
    code: `var gr = new GlideRecord("incident"); var run; if (flag) { run = function () { gr.query(); }; } else { gr.query(); run = function () {}; } run(); gr.next();`,
    expected: [],
  },
  {
    name: "correlated-helper-swapped",
    code: `var gr = new GlideRecord("incident"); var run; if (flag) { gr.query(); run = function () {}; } else { run = function () { gr.query(); }; } run(); gr.next();`,
    expected: [],
  },
  {
    name: "conditional-helper-result",
    code: `var gr = new GlideRecord("incident"); var run; run = flag ? function () { gr.query(); } : (gr.query(), function () {}); run(); gr.next();`,
    expected: [],
  },
  {
    name: "conditional-helper-alias",
    code: `var gr = new GlideRecord("incident"); var run; var alias = flag ? (run = function () { gr.query(); }) : (gr.query(), run = function () {}); alias(); gr.next();`,
    expected: [],
  },
  {
    name: "conditional-helper-argument",
    code: `var gr = new GlideRecord("incident"); var run; function open(record) { record.query(); } open(flag ? (run = function () {}, gr) : (run = function () {}, gr)); gr.next();`,
    expected: [],
  },
  {
    name: "unknown-callee-before-argument-write",
    code: `var gr = new GlideRecord("incident"); var run = external; run(run = function () { gr.query(); }); gr.next();`,
    expected: [],
  },
  {
    name: "returned-logical-assignment-retains-object",
    code: `var gr = new GlideRecord("task"); var alias = gr; function expose() { return (alias ||= new GlideRecord("incident")); } expose(); gr.next();`,
    expected: [],
  },
  {
    name: "thrown-logical-assignment-retains-object",
    code: `var gr = new GlideRecord("task"); var alias = gr; function expose() { try { throw (alias ??= new GlideRecord("incident")); } finally { gr.next(); } } try { expose(); } catch (error) {}`,
    expected: [],
  },
  {
    name: "returned-logical-assignment-skips-object",
    code: `var gr = new GlideRecord("task"); var flag = false; function expose() { try { return (flag &&= gr); } finally { gr.next(); } } expose();`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "thrown-logical-assignment-skips-cursor-advance",
    code: `var gr = new GlideRecord("task"); var flag = true; function expose() { throw (flag ||= (gr.next(), gr)); } try { expose(); } catch (error) {}`,
    expected: [],
  },
  {
    name: "returned-logical-assignment-selects-object",
    code: `var gr = new GlideRecord("task"); var flag = true; function expose() { return (flag &&= gr); } expose(); gr.next();`,
    expected: [],
  },
  {
    name: "returned-logical-assignment-skips-capture",
    code: `var gr = new GlideRecord("task"); var fn = function () {}; function expose() { try { return (fn ||= function () { gr.query(); }); } finally { gr.next(); } } expose();`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "escaped-callback-invalidates-scalar-selector",
    code: `var gr = new GlideRecord("task"); var flag = false; function flip() { flag = true; } external(flip); flag &&= (gr.next(), gr);`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "returned-captured-allocation",
    code: `var gr; function allocate() { return (gr = new GlideRecord("task")); } allocate(); gr.next();`,
    expected: [],
  },
  {
    name: "thrown-captured-allocation",
    code: `var gr; function allocate() { throw (gr = new GlideRecord("task")); } try { allocate(); } catch (error) { gr.next(); }`,
    expected: [],
  },
  {
    name: "return-expression-cursor-advance",
    code: `var gr = new GlideRecord("task"); function expose() { return (gr.next(), gr); } expose(); gr.next();`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "throw-expression-cursor-advance",
    code: `var gr = new GlideRecord("task"); function expose() { throw (gr.next(), gr); } try { expose(); } catch (error) {}`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "returned-sequence-keeps-captured-allocation",
    code: `var gr; function allocate() { return (gr = new GlideRecord("task"), 0); } allocate(); gr.next();`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "thrown-sequence-keeps-captured-allocation",
    code: `var gr; function allocate() { throw (gr = new GlideRecord("task"), 0); } try { allocate(); } catch (error) { gr.next(); }`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "returned-selected-allocation",
    code: `var gr; function allocate() { return true ? (gr = new GlideRecord("task")) : 0; } allocate(); gr.next();`,
    expected: [],
  },
  {
    name: "thrown-logical-scalar-keeps-captured-allocation",
    code: `var gr; function allocate() { throw ((gr = new GlideRecord("task"), 0) ?? gr); } try { allocate(); } catch (error) { gr.next(); }`,
    expected: ["servicenow/require-query-before-next"],
  },
  {
    name: "returned-selected-closure-escapes-capture",
    code: `var gr = new GlideRecord("task"); var fn = function () { gr.query(); }; function expose() { return (fn, function () { gr.query(); }); } var exported = expose(); exported(); gr.next();`,
    expected: [],
  },
];

describe("path-state reachability agrees in real hosts", () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      const project = createTemporaryProject({
        prefix: "sn-path-host-",
        filename: `${testCase.name}.br.js`,
        code: testCase.code,
        rules: { "no-unused-vars": "off", "servicenow/require-query-before-next": "error" },
      });
      try {
        const report = runOxlintProcess(project.config, [project.source]);
        assert.equal(report.stderr, "");
        const diagnostics = report.report.diagnostics.filter((diagnostic) =>
          diagnostic.code.startsWith("servicenow("),
        );
        assert.equal(report.status, testCase.expected.length > 0 ? 1 : 0);
        assert.equal(diagnostics.length, testCase.expected.length);
        assert.deepEqual(
          eslintRuleIds(
            {
              plugins: { servicenow: plugin },
              rules: { "servicenow/require-query-before-next": "error" },
            },
            testCase.code,
            path.basename(project.source),
          ),
          testCase.expected,
        );
      } finally {
        project.cleanup();
      }
    });
  }
});

it("invalidates mapped script parameters in real hosts", () => {
  const code = `var gr = new GlideRecord("task"); function use(run) { run = false; arguments[0] = true; run &&= gr.next(); } use(true);`;
  const project = createTemporaryProject({
    prefix: "sn-mapped-host-",
    filename: "mapped.br.cjs",
    code,
    rules: { "servicenow/require-query-before-next": "error" },
  });
  try {
    const report = runOxlintProcess(project.config, [project.source]);
    assert.equal(report.stderr, "");
    assert.equal(
      report.report.diagnostics.filter((diagnostic) => diagnostic.code.startsWith("servicenow("))
        .length,
      1,
    );
    assert.deepEqual(
      eslintRuleIds(
        {
          languageOptions: { sourceType: "script" },
          plugins: { servicenow: plugin },
          rules: { "servicenow/require-query-before-next": "error" },
        },
        code,
        path.basename(project.source),
      ),
      ["servicenow/require-query-before-next"],
    );
  } finally {
    project.cleanup();
  }
});
