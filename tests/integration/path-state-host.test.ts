import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import plugin from "../../src/index.js";
import { createTemporaryProject, eslintRuleIds, runOxlintProcess } from "./helpers.js";

const cases = [
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
    expected: ["servicenow/require-query-before-next"],
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
