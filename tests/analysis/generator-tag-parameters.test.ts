import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function bulkCalls(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Generator tags initialize parameters before deferring the body]]
describe("generator tag parameter evaluation", () => {
  const prefix = 'var records = new GlideRecord("task"); var run = false; ';
  const suffix = "run &&= records.deleteMultiple();";

  it("skips the strings parameter default because the implicit array is supplied", () => {
    assert.equal(
      bulkCalls(prefix + "function* tag(strings = (run = true)) {} tag``; " + suffix),
      0,
    );
  });

  it("treats the implicit strings parameter as truthy in a later default", () => {
    assert.equal(
      bulkCalls(prefix + "function* tag(strings, unused = (run = strings)) {} tag``; " + suffix),
      1,
    );
  });

  for (const value of ["false", "null", "0", '""']) {
    it(`skips a default for the supplied substitution ${value}`, () => {
      assert.equal(
        bulkCalls(
          prefix +
            "function* tag(strings, value = (run = true)) {} tag`${" +
            value +
            "}`; " +
            suffix,
        ),
        0,
      );
    });
  }

  it("evaluates a default for an explicit undefined substitution", () => {
    assert.equal(
      bulkCalls(
        prefix + "function* tag(strings, value = (run = true)) {} tag`${undefined}`; " + suffix,
      ),
      1,
    );
  });

  it("evaluates a default for a missing trailing substitution", () => {
    assert.equal(
      bulkCalls(prefix + "function* tag(strings, value = (run = true)) {} tag``; " + suffix),
      1,
    );
  });

  it("retains possible default effects for an unknown substitution", () => {
    assert.equal(
      bulkCalls(
        prefix + "function* tag(strings, value = (run = true)) {} tag`${external}`; " + suffix,
      ),
      1,
    );
  });

  it("skips defaults on both selected null and false substitution paths", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "function* tag(strings, value = (run = true)) {} tag`${external ? null : false}`; " +
          suffix,
      ),
      0,
    );
  });

  it("retains the default path when selected substitutions may be null or undefined", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "function* tag(strings, value = (run = true)) {} tag`${external ? null : undefined}`; " +
          suffix,
      ),
      1,
    );
  });

  it("skips a default for an aliased null substitution", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "var value = null; function* tag(strings, value = (run = true)) {} tag`${value}`; " +
          suffix,
      ),
      0,
    );
  });

  it("skips a default for an aliased false substitution", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "var value = false; function* tag(strings, value = (run = true)) {} tag`${value}`; " +
          suffix,
      ),
      0,
    );
  });

  it("evaluates a default for an aliased undefined substitution", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "var value = undefined; function* tag(strings, value = (run = true)) {} tag`${value}`; " +
          suffix,
      ),
      1,
    );
  });

  it("saves a false substitution before a later substitution mutates its binding", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "var value = false; function* tag(strings, first, second, unused = (run = first)) {} tag`${value}${(value = true, 0)}`; " +
          suffix,
      ),
      0,
    );
  });

  it("saves a true substitution before a later substitution clears its binding", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "var value = true; function* tag(strings, first, second, unused = (run = first)) {} tag`${value}${(value = false, 0)}`; " +
          suffix,
      ),
      1,
    );
  });

  it("evaluates defaults in parameter order", () => {
    assert.equal(
      bulkCalls(
        prefix + "function* tag(strings, first = true, second = (run = first)) {} tag``; " + suffix,
      ),
      1,
    );
  });

  it("does not evaluate later defaults after an earlier default throws", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "function fail() { throw 0; } function* tag(strings, first = fail(), second = (run = true)) {} try { tag``; } catch (error) {} " +
          suffix,
      ),
      0,
    );
  });

  it("keeps an async generator parameter throw synchronous and skips later defaults", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "function fail() { throw 0; } async function* tag(strings, first = fail(), second = (run = true)) {} try { tag``; } catch (error) {} " +
          suffix,
      ),
      0,
    );
  });

  it("executes a supplied callable in a later default using its saved identity", () => {
    const { messages, analysis } = lintWithAnalysis(
      prefix +
        "run ||= false; var callback = function () { records.next(); }; function* tag(strings, callback, replacement, unused = callback()) {} tag`${callback}${(callback = function () {}, 0)}`;",
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.messageId, "missingQuery");
  });

  it("does not invoke a callback replacement installed after its substitution", () => {
    const { messages, analysis } = lintWithAnalysis(
      prefix +
        "run ||= false; var callback = function () {}; function* tag(strings, callback, replacement, unused = callback()) {} tag`${callback}${(callback = function () { records.next(); }, 0)}`;",
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(messages.length, 0);
  });

  it("binds a supplied record to a default before leaving the body deferred", () => {
    const { messages, analysis } = lintWithAnalysis(
      prefix +
        "run ||= false; function* tag(strings, record, unused = record.next()) {} tag`${records}`;",
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.messageId, "missingQuery");
  });

  it("projects a captured record operation executed by an immediate default", () => {
    const { messages, analysis } = lintWithAnalysis(
      prefix + "run ||= false; function* tag(strings, unused = records.next()) {} tag``;",
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.messageId, "missingQuery");
  });

  it("keeps a body deferred after skipping an applicable parameter default", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "function* tag(strings, value = (run = true)) { run = true; } tag`${false}`; " +
          suffix,
      ),
      0,
    );
  });

  it("keeps retained iterator captures conservative after parameter initialization", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "function* tag(strings = (run = true)) { run = true; } var iterator = tag``; " +
          suffix,
      ),
      1,
    );
  });

  it("evaluates a nested destructuring default before deferring the body", () => {
    assert.equal(
      bulkCalls(
        prefix + "function* tag(strings, { value = (run = true) } = {}) {} tag``; " + suffix,
      ),
      1,
    );
  });

  it("evaluates a computed destructuring key before deferring the body", () => {
    assert.equal(
      bulkCalls(
        prefix +
          'function* tag(strings, { [(run = true, "value")]: value }) {} tag`${{ value: 0 }}`; ' +
          suffix,
      ),
      1,
    );
  });

  it("does not execute a discarded generator body with a rest parameter", () => {
    assert.equal(
      bulkCalls(prefix + "function* tag(strings, ...values) { run = true; } tag``; " + suffix),
      0,
    );
  });

  it("retains a positive finding across repeated parameter-only tag invocation", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "function* tag(strings, unused = (run = true)) {} " +
          "tag``; ".repeat(100) +
          suffix,
      ),
      1,
    );
  });
});
