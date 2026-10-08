import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function findings(
  code: string,
  rule: "no-unfiltered-gliderecord-bulk-operation" | "require-query-before-next",
): number {
  const { messages, analysis } = lintWithAnalysis(code, rule);
  assert.equal(analysis.pathBudgetExhausted, false, "argument evaluation must complete");
  assert.ok(
    messages.every(
      (message) =>
        message.messageId ===
        (rule === "require-query-before-next" ? "missingQuery" : "unfiltered"),
    ),
  );
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Empty argument results do not enlarge invocation snapshots]]
describe("sparse argument snapshots", () => {
  for (const count of [500, 1500]) {
    it(`retains the later bulk finding after ${count} empty helper results in one call`, () => {
      const args = Array.from({ length: count }, () => "f()").join(",");
      assert.equal(
        findings(
          `function f() {} external(${args}); new GlideRecord("task").deleteMultiple();`,
          "no-unfiltered-gliderecord-bulk-operation",
        ),
        1,
      );
    });
  }
  for (const [name, invoke] of [
    ["construction", (args: string) => `new external(${args});`],
    ["template substitutions", (args: string) => "external`" + args + "`;"],
  ] as const) {
    it(`retains the later finding after empty results in ${name}`, () => {
      const args = Array.from({ length: 500 }, () =>
        name === "construction" ? "f()" : "${f()}",
      ).join(name === "construction" ? "," : "");
      assert.equal(
        findings(
          `function f() {} ${invoke(args)} new GlideRecord("task").deleteMultiple();`,
          "no-unfiltered-gliderecord-bulk-operation",
        ),
        1,
      );
    });
  }
  for (const expression of ["(f())", "(0, f())", "true ? f() : f()", "false || f()"]) {
    it(`does not retain domain-empty selected argument results from ${expression}`, () => {
      const args = Array.from({ length: 500 }, () => expression).join(",");
      assert.equal(
        findings(
          `function f() {} external(${args}); new GlideRecord("task").deleteMultiple();`,
          "no-unfiltered-gliderecord-bulk-operation",
        ),
        1,
      );
    });
  }
  for (const expression of ["true ? f() : f()", "false || f()"]) {
    it(`omits empty selected correlations for ${expression} when logical assignments are active`, () => {
      const args = Array.from({ length: 500 }, () => expression).join(",");
      assert.equal(
        findings(
          `var selector = false; selector &&= 0; function f() {} external(${args}); new GlideRecord("task").deleteMultiple();`,
          "no-unfiltered-gliderecord-bulk-operation",
        ),
        1,
      );
    });
  }
  it("keeps an unknown selected result separate from a known callback alternative", () => {
    assert.equal(
      findings(
        'var selector = false; selector &&= 0; var records = new GlideRecord("task"); function f() {} function use(fn) { fn(); } use(externalChoice ? f() : function() { records.query(); }); records.next();',
        "require-query-before-next",
      ),
      1,
    );
  });
  it("still executes a saved callback default after a wide empty argument list", () => {
    const args = Array.from({ length: 1500 }, () => "f()").join(",");
    assert.equal(
      findings(
        `function f() {} var records = new GlideRecord("task"); var cb = function() { records.deleteMultiple(); }; external(${args}); function use(fn, replaced, unused = fn()) {} use(cb, cb = function() {});`,
        "no-unfiltered-gliderecord-bulk-operation",
      ),
      1,
    );
  });
  for (const expression of [
    "input",
    "(input)",
    "(0, input)",
    "true ? input : 0",
    "false || input",
    "externalChoice ? input : unknownValue",
    "input || unknownValue",
  ]) {
    it(`keeps the saved unknown object from ${expression} unknown after replacement`, () => {
      assert.equal(
        findings(
          `var records = new GlideRecord("task"); var input = unknownValue; external(${expression}, (input = records, 0)); records.next();`,
          "require-query-before-next",
        ),
        1,
      );
    });
    it(`keeps the saved unknown callback from ${expression} unknown after replacement`, () => {
      assert.equal(
        findings(
          `var records = new GlideRecord("task"); var input = unknownValue; function use(fn, replaced, unused = fn()) {} use(${expression}, input = function() { records.deleteMultiple(); });`,
          "no-unfiltered-gliderecord-bulk-operation",
        ),
        0,
      );
    });
  }
  it("keeps an earlier undefined value when a later argument replaces it with null", () => {
    assert.equal(
      findings(
        'var records = new GlideRecord("task"); var input = void 0; function use(value = records.deleteMultiple(), replaced) {} use(input, input = null);',
        "no-unfiltered-gliderecord-bulk-operation",
      ),
      1,
    );
  });
});
