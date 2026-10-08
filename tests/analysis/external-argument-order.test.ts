import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function missingQueryLines(code: string): number[] {
  const { messages, analysis } = lintWithAnalysis(code, "require-query-before-next");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  return messages.map((message) => message.line);
}

// @lat: [[tests#Analysis behavior#External consumers escape evaluated argument values]]
describe("external argument evaluation order", () => {
  for (const invocation of ["external", "new external"]) {
    for (const [setup, argumentsCode, expected] of [
      ["var prior = gr;", "gr, gr = new GlideRecord('incident')", []],
      ["var prior = gr;", "gr, (gr = new GlideRecord('incident'), 0)", [3]],
      ["var prior = gr; var value = externalValue;", "value, (value = gr, 0)", [2, 3]],
      ["var prior = gr; var cb = function () { gr.query(); };", "cb, (cb = function () {}, 0)", []],
      [
        "var prior = gr; var cb = function () { gr.query(); };",
        "(cb), (cb = function () {}, 0)",
        [],
      ],
      [
        "var prior = gr; var cb = function () {};",
        "cb, (cb = function () { gr.query(); }, 0)",
        [2, 3],
      ],
      [
        "var prior = gr; var cb = externalValue;",
        "cb, (cb = function () { gr.query(); }, 0)",
        [2, 3],
      ],
      [
        "var prior = gr; var cb = function () { gr.query(); };",
        "cb, (gr = new GlideRecord('incident'), 0)",
        [2],
      ],
    ] as const) {
      it(`${invocation} escapes the saved values of ${argumentsCode}`, () => {
        assert.deepEqual(
          missingQueryLines(
            `var gr = new GlideRecord("task"); var flag = false; flag &&= 0; ${setup} ${invocation}(${argumentsCode});\nprior.next();\ngr.next();`,
          ),
          expected,
        );
      });
    }
    it(`${invocation} escapes each possible selected conditional argument`, () => {
      assert.deepEqual(
        missingQueryLines(
          `var gr = new GlideRecord("task"); var other = new GlideRecord("incident"); var flag = false; flag &&= 0; ${invocation}(externalValue ? gr : other);\ngr.next();\nother.next();`,
        ),
        [],
      );
    });
    it(`${invocation} skips argument exports when a later argument throws`, () => {
      assert.deepEqual(
        missingQueryLines(
          `var gr = new GlideRecord("task"); var flag = false; flag &&= 0; function fail() { throw 0; } try { ${invocation}(gr, fail()); } catch (error) {}\ngr.next();`,
        ),
        [2],
      );
    });
  }
  it("keeps generator default effects at invocation before discarding its iterator", () => {
    const { messages, analysis } = lintWithAnalysis(
      `var records = new GlideRecord("task"); var run = false; function* use(unused = (run = true)) {} use(); run &&= records.deleteMultiple();`,
      "no-unfiltered-gliderecord-bulk-operation",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.deepEqual(
      messages.map((message) => message.messageId),
      ["unfiltered"],
    );
  });
  it("does not retain unopened records across immediate generator defaults", () => {
    assert.deepEqual(
      missingQueryLines(
        'var records = new GlideRecord("task"); var run = false; function* use(unused = (run = true, records.query())) {} use(); run &&= records.next();',
      ),
      [],
    );
  });

  it("keeps an ordinary-parameter generator body deferred when its iterator is discarded", () => {
    const { messages, analysis } = lintWithAnalysis(
      `var records = new GlideRecord("task"); var run = false; function* use(unused) { run = true; } use(); run &&= records.deleteMultiple();`,
      "no-unfiltered-gliderecord-bulk-operation",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.deepEqual(messages, []);
  });

  it("keeps discarded generator argument identities before later replacement", () => {
    assert.deepEqual(
      missingQueryLines(
        `var gr = new GlideRecord("task"); var prior = gr; var flag = false; flag &&= 0; function* consume(value, unused) {} consume(gr, gr = new GlideRecord("incident")); prior.next();`,
      ),
      [],
    );
  });
});
