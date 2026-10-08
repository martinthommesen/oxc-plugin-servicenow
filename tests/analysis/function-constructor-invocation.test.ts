import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function bulkFindings(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Known ordinary constructors replay selected invocation effects]]
describe("ordinary function constructor invocation", () => {
  for (const [name, setup, argument, expected] of [
    ["truthy literal", "", "true", 1],
    ["false literal", "", "false", 0],
    ["false alias", "var input = false;", "input", 0],
    ["truthy alias", "var input = true;", "input", 1],
    ["saved truthy alias", "var input = true;", "input, input = false", 1],
    ["saved false alias", "var input = false;", "input, input = true", 0],
    ["unknown argument", "", "external", 1],
  ] as const) {
    it(`uses ${name} after prior direct invocation`, () => {
      assert.equal(
        bulkFindings(
          `function C(run, unused) { run &&= new GlideRecord("task").deleteMultiple(); } C(false); ${setup} new C(${argument});`,
        ),
        expected,
      );
    });
  }

  for (const [argument, expected] of [
    ["", 1],
    ["void 0", 1],
    ["null", 0],
    ["false", 0],
  ] as const) {
    it(`evaluates the selected constructor default for ${argument || "a missing argument"}`, () => {
      assert.equal(
        bulkFindings(
          `function C(run = true) { run &&= new GlideRecord("task").deleteMultiple(); } C(false); new C(${argument});`,
        ),
        expected,
      );
    });
  }

  it("uses the saved constructor before an argument replaces its binding", () => {
    assert.equal(
      bulkFindings(
        'var C = function (run, unused) { run &&= new GlideRecord("task").deleteMultiple(); }; C(false); new C(true, C = function () {});',
      ),
      1,
    );
  });
  for (const [initial, later, expected] of [
    ["null", "void 0", 0],
    ["void 0", "null", 1],
  ] as const) {
    it(`saves ${initial} for a default before a later argument writes ${later}`, () => {
      assert.equal(
        bulkFindings(
          `var input = ${initial}; function C(run = true, unused) { run &&= new GlideRecord("task").deleteMultiple(); } C(false); new C(input, input = ${later});`,
        ),
        expected,
      );
    });
  }
  it("retains correlation between the selected callable and scalar argument", () => {
    assert.equal(
      bulkFindings(
        'var run = false; var C; if (external) { run = true; C = function () {}; } else { C = function (value) { value &&= new GlideRecord("task").deleteMultiple(); }; } C(false); new C(run);',
      ),
      0,
    );
  });
  it("keeps a reachable operation on one selected constructor path", () => {
    assert.equal(
      bulkFindings(
        'var run = false; var C; if (external) { run = true; C = function (value) { value &&= new GlideRecord("task").deleteMultiple(); }; } else { C = function () {}; } C(false); new C(run);',
      ),
      1,
    );
  });

  it("keeps an originally unknown constructor unknown after an argument replacement", () => {
    assert.equal(
      bulkFindings(
        'var run = false; var C = external; new C((C = function () { run = true; }, 0)); run &&= new GlideRecord("task").deleteMultiple();',
      ),
      0,
    );
  });

  it("skips constructor effects after an abrupt argument", () => {
    assert.equal(
      bulkFindings(
        'function C(run) { run &&= new GlideRecord("task").deleteMultiple(); } function fail() { throw 0; } C(false); new C(fail());',
      ),
      0,
    );
  });

  it("projects a known constructor query before an outer advance", () => {
    const { messages, analysis } = lintWithAnalysis(
      'var records = new GlideRecord("task"); function C(run) { run &&= records.query(); } C(false); new C(true); records.next();',
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(messages.length, 0);
  });

  it("projects constructor scalar effects instead of forgetting the executed value", () => {
    assert.equal(
      bulkFindings(
        'var run = true; function C() { run = false; } C(); run = true; new C(); run &&= new GlideRecord("task").deleteMultiple();',
      ),
      0,
    );
  });

  for (const constructor of [
    "function* C(run)",
    "async function C(run)",
    "async function* C(run)",
  ]) {
    it(`keeps the nonconstructible ${constructor} body deferred`, () => {
      assert.equal(
        bulkFindings(
          `${constructor} { run &&= new GlideRecord("task").deleteMultiple(); } C(false); new C(true);`,
        ),
        0,
      );
    });
  }
});
