import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function bulkFindings(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Known parameter replay retains evaluated arguments without selectors]]
describe("parameter argument evaluation without logical assignments", () => {
  const setup =
    'var records = new GlideRecord("task"); var cb = function () { records.deleteMultiple(); };';
  for (const [name, invocation, expected] of [
    [
      "supplied second argument skips its default",
      "function use(fn, unused = fn()) {} use(cb, cb = function () {});",
      0,
    ],
    [
      "ordinary missing third default",
      "function use(fn, replaced, unused = fn()) {} use(cb, cb = function () {});",
      1,
    ],
    [
      "ordinary explicit undefined default",
      "function use(fn, unused = fn(), replaced) {} use(cb, void 0, cb = function () {});",
      1,
    ],
    [
      "ordinary explicit null skips default",
      "function use(fn, unused = fn(), replaced) {} use(cb, null, cb = function () {});",
      0,
    ],
    [
      "known body invokes earlier callback",
      "function use(fn, replaced) { fn(); } use(cb, cb = function () {});",
      1,
    ],
    [
      "parenthesized callback",
      "function use(fn, replaced, unused = fn()) {} use((cb), cb = function () {});",
      1,
    ],
    [
      "selected sequence callback",
      "function use(fn, replaced, unused = fn()) {} use((0, cb), cb = function () {});",
      1,
    ],
    [
      "selected conditional callback",
      "function use(fn, replaced, unused = fn()) {} use(true ? cb : function () {}, cb = function () {});",
      1,
    ],
    [
      "selected logical callback",
      "function use(fn, replaced, unused = fn()) {} use(false || cb, cb = function () {});",
      1,
    ],
    [
      "generator missing third default",
      "function* use(fn, replaced, unused = fn()) {} use(cb, cb = function () {});",
      1,
    ],
    [
      "async generator missing third default",
      "async function* use(fn, replaced, unused = fn()) {} use(cb, cb = function () {});",
      1,
    ],
    [
      "generator tag missing default",
      "function* use(strings, fn, replaced, unused = fn()) {} use`${cb}${cb = function () {}}`;",
      1,
    ],
    [
      "generator body remains deferred",
      "function* use(fn, replaced) { fn(); } use(cb, cb = function () {});",
      0,
    ],
    [
      "unknown earlier callback",
      "cb = externalValue; function use(fn, replaced, unused = fn()) {} use(cb, cb = function () {});",
      0,
    ],
    [
      "replaced earlier empty callback",
      "cb = function () {}; function use(fn, replaced, unused = fn()) {} use(cb, cb = function () { records.deleteMultiple(); });",
      0,
    ],
  ] as const) {
    it(name, () => assert.equal(bulkFindings(`${setup} ${invocation}`), expected));
  }
  it("keeps repeated saved argument defaults within the existing budget", () => {
    const calls = "use(cb, cb = function () {});".repeat(500);
    assert.equal(
      bulkFindings(
        `var cb = function () {}; function use(fn, replaced, unused = fn()) {} ${calls} var records = new GlideRecord("task"); records.deleteMultiple();`,
      ),
      1,
    );
  });
  it("retains ordinary structural argument escape effects", () => {
    const { messages, analysis } = lintWithAnalysis(
      'var records = new GlideRecord("task"); external({ nested: [records] }); records.next();',
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.deepEqual(messages, []);
  });
});
