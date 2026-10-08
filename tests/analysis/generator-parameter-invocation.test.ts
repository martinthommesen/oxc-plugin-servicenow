import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function missingQueries(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "require-query-before-next");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Generator invocation evaluates parameters before deferring bodies]]
describe("generator parameter invocation", () => {
  for (const [setup, argument, expected] of [
    ["", "", 1],
    ["", "void 0", 1],
    ["", "undefined", 1],
    ["", "null", 0],
    ["", "false", 0],
    ["var input = null;", "input", 0],
    ["var input = void 0;", "input", 1],
    ["var input = external;", "input", 1],
    ["var input = external ? null : void 0;", "input", 1],
    ["", "...external", 1],
  ] as const) {
    it(`executes only applicable defaults for ${argument || "a missing argument"}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var selector = false; selector &&= 0; ${setup} function* use(value = gr.next()) {} use(${argument});`,
        ),
        expected,
      );
    });
  }

  for (const [argumentsCode, expected] of [
    ["", 0],
    ["null", 1],
    ["false", 1],
    ["input, input = void 0", 1],
  ] as const) {
    it(`projects executed query defaults for use(${argumentsCode})`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var selector = false; selector &&= 0; var input = null; function* use(value = gr.query(), unused) {} use(${argumentsCode}); gr.next();`,
        ),
        expected,
      );
    });
  }
  it("saves undefined before a later argument replaces it with null", () => {
    assert.equal(
      missingQueries(
        'var gr = new GlideRecord("task"); var selector = false; selector &&= 0; var input = void 0; function* use(value = gr.query(), unused) {} use(input, input = null); gr.next();',
      ),
      0,
    );
  });
  it("binds earlier parameters before evaluating later defaults", () => {
    assert.equal(
      missingQueries(
        'var gr = new GlideRecord("task"); var selector = false; selector &&= 0; function* use(value, next = value.next()) {} use(gr);',
      ),
      1,
    );
  });
  it("projects definite scalar effects from a default", () => {
    assert.equal(
      missingQueries(
        'var gr = new GlideRecord("task"); var run = true; function* use(value = (run = false)) {} use(); run &&= gr.next();',
      ),
      0,
    );
  });
  it("skips scalar default effects for a null argument", () => {
    assert.equal(
      missingQueries(
        'var gr = new GlideRecord("task"); var run = false; function* use(value = (run = true)) {} use(null); run &&= gr.next();',
      ),
      0,
    );
  });
  for (const parameters of ["value", "value = 0"]) {
    it(`keeps the generator body deferred with ${parameters}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var run = false; function* use(${parameters}) { run = true; gr.next(); } use(); run &&= gr.next();`,
        ),
        0,
      );
    });
  }
  for (const asyncPrefix of ["", "async "]) {
    it(`preserves synchronous default throws for ${asyncPrefix || "ordinary "}generators`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var run = false; function fail() { throw 0; } ${asyncPrefix}function* use(value = fail()) {} try { use(); run = true; } catch (error) {} run &&= gr.next();`,
        ),
        0,
      );
    });
  }
  it("retains earlier default effects when a later default throws", () => {
    assert.equal(
      missingQueries(
        'var gr = new GlideRecord("task"); var run = false; function fail() { throw 0; } function* use(first = (run = true), second = fail()) {} try { use(); } catch (error) {} run &&= gr.next();',
      ),
      1,
    );
  });
  for (const [argument, expected] of [
    ["", 1],
    ["null", 0],
    ["false", 0],
    ["void 0", 1],
  ] as const) {
    it(`evaluates generator defaults without an unrelated logical assignment for ${argument || "missing"}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); function* use(value = gr.next()) {} use(${argument});`,
        ),
        expected,
      );
    });
  }
  for (const [parameters, argument] of [
    ["{ value = gr.next() } = {}", ""],
    ["[value = gr.next()]", "[]"],
    ["{ [gr.next()]: value }", "{}"],
  ] as const) {
    it(`evaluates possible destructuring parameter effects in ${parameters}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var selector = false; selector &&= 0; function* use(${parameters}) {} use(${argument});`,
        ),
        1,
      );
    });
  }
  it("skips argument exports when a parameter default throws", () => {
    assert.equal(
      missingQueries(
        'var gr = new GlideRecord("task"); var selector = false; selector &&= 0; function fail() { throw 0; } function* use(value, unused = fail()) {} try { use(gr); } catch (error) {} gr.next();',
      ),
      1,
    );
  });
  it("skips retained-iterator capture exposure when a default throws", () => {
    assert.equal(
      missingQueries(
        'var gr = new GlideRecord("task"); var selector = false; selector &&= 0; function fail() { throw 0; } function* use(value = fail()) { gr.query(); } try { var iterator = use(); } catch (error) {} gr.next();',
      ),
      1,
    );
  });
  it("preserves the capture boundary for a retained iterator", () => {
    assert.equal(
      missingQueries(
        'var gr = new GlideRecord("task"); var selector = false; selector &&= 0; function* use(value) { gr.query(); } var iterator = use(null); gr.next();',
      ),
      0,
    );
  });
});
