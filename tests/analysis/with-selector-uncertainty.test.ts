import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import { applyRules } from "../helpers/apply-rules.js";
import type { FileAnalysis } from "../../src/analysis/file-analysis.js";
import { analyzePathBindings } from "../../src/analysis/path-state.js";
import { isNode } from "../../src/utils/ast.js";

function queryExecutions(code: string): number {
  const parsed = parseSync("with.br.js", code, { sourceType: "script", lang: "js" });
  assert.deepEqual(parsed.errors, []);
  assert.ok(isNode(parsed.program));
  let analysis: FileAnalysis | undefined;
  const messages = applyRules(
    code,
    { ast: parsed.program },
    {
      filename: "with.br.js",
      ruleNames: ["no-unfiltered-gliderecord-bulk-operation"],
      onFileAnalysis: (value) => {
        analysis = value;
      },
    },
  );
  assert.ok(analysis);
  assert.equal(analysis.pathBudgetExhausted, false);
  // Public platform-method authority remains opaque for files containing with.
  assert.equal(messages.length, 0);
  let queries = 0;
  const result = analyzePathBindings({
    program: parsed.program,
    analysis: analysis.provenance,
    kinds: ["GlideRecord"],
    emptyData: () => 0,
    cloneData: (value) => value,
    mergeData: (left, right) => Math.max(left, right),
    equalsData: (left, right) => left === right,
    analyzeUncalledFunctions: false,
    onCall: ({ rec, property }) => {
      if (rec && property === "query") queries += 1;
    },
  });
  assert.equal(result.outcome, "complete");
  return queries;
}

// @lat: [[tests#Analysis behavior#With scopes retain intercepted selector uncertainty]]
describe("with selector uncertainty", () => {
  for (const object of ["{ run: 0 }", "{}", "external"]) {
    it(`retains possible outer execution after a write intercepted by ${object}`, () => {
      assert.equal(
        queryExecutions(
          `var run = true; var records = new GlideRecord("task"); with (${object}) { run = false; } run &&= records.query();`,
        ),
        1,
      );
    });
  }
  it("does not use outer false certainty for a dynamically intercepted body read", () => {
    assert.equal(
      queryExecutions(
        'var run = false; var records = new GlideRecord("task"); with ({ run: true }) { run &&= records.query(); }',
      ),
      1,
    );
  });
  it("does not restore certainty from a body write before another body read", () => {
    assert.equal(
      queryExecutions(
        'var run = true; var records = new GlideRecord("task"); with (external) { run = false; run &&= records.query(); }',
      ),
      1,
    );
  });
  it("includes initialized var writes that can target the with object", () => {
    assert.equal(
      queryExecutions(
        'var run = true; var records = new GlideRecord("task"); with ({ run: 0 }) { var run = false; } run &&= records.query();',
      ),
      1,
    );
  });
  it("keeps scalar captures uncertain when a callable lookup can be intercepted", () => {
    assert.equal(
      queryExecutions(
        'var run = true; var records = new GlideRecord("task"); function clear() { run = false; } with ({ clear: function () {} }) { clear(); } run &&= records.query();',
      ),
      1,
    );
  });
  it("keeps an unrelated false selector precise", () => {
    assert.equal(
      queryExecutions(
        'var run = true; var quiet = false; var records = new GlideRecord("task"); with ({ run: 0 }) { run = false; } quiet &&= records.query();',
      ),
      0,
    );
  });
  it("keeps a body lexical binding outside the intercepted outer scope", () => {
    assert.equal(
      queryExecutions(
        'var records = new GlideRecord("task"); with (external) { let quiet = false; quiet &&= records.query(); }',
      ),
      0,
    );
  });
  it("keeps an ordinary parameter default precise inside a with body", () => {
    assert.equal(
      queryExecutions(
        'var records = new GlideRecord("task"); function use(run = false) { run &&= records.query(); } with (external) { use(); }',
      ),
      0,
    );
  });
  it("does not treat an ordinary member property name as an intercepted selector", () => {
    assert.equal(
      queryExecutions(
        'var run = false; var records = new GlideRecord("task"); with (external) { object.run; } run &&= records.query();',
      ),
      0,
    );
  });
  it("skips a body when the with header is abrupt", () => {
    assert.equal(
      queryExecutions(
        'var run = false; var records = new GlideRecord("task"); function fail() { throw 0; } try { with (fail()) { run = true; } } catch (error) {} run &&= records.query();',
      ),
      0,
    );
  });
});
