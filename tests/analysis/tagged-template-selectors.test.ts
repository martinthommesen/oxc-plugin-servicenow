import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function bulkCalls(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Template tags invalidate captured selectors after substitutions]]
describe("tagged template selector effects", () => {
  const prefix = 'var records = new GlideRecord("task"); var run = false; ';
  const suffix = "run &&= records.deleteMultiple();";

  it("retains reachable bulk calls after a local tag changes the selector", () => {
    assert.equal(bulkCalls(prefix + "function tag() { run = true; } tag``; " + suffix), 1);
  });

  it("invalidates captures of a callable member-tag receiver", () => {
    assert.equal(bulkCalls(prefix + "function tag() { run = true; } tag.call``; " + suffix), 1);
  });

  it("invalidates captures of a class member-tag receiver", () => {
    assert.equal(
      bulkCalls(prefix + "class C { static tag() { run = true; } } C.tag``; " + suffix),
      1,
    );
  });

  it("saves the member-tag receiver before a computed key replaces its binding", () => {
    assert.equal(
      bulkCalls(
        prefix +
          'var tag = function () { run = true; }; tag[(tag = function () {}, "call")]``; ' +
          suffix,
      ),
      1,
    );
  });

  it("does not retain unopened record certainty across unmodeled tag effects", () => {
    const { messages, analysis } = lintWithAnalysis(
      prefix + "function tag() { run = true; records.query(); } tag``; run &&= records.next();",
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(messages.length, 0);
  });

  it("follows aliases to the selected tag", () => {
    assert.equal(
      bulkCalls(prefix + "function tag() { run = true; } var alias = tag; alias``; " + suffix),
      1,
    );
  });

  it("keeps the tag selected before a substitution replaces its binding", () => {
    assert.equal(
      bulkCalls(
        prefix + "var tag = function () { run = true; }; tag`${tag = function () {}}`; " + suffix,
      ),
      1,
    );
  });

  it("retains a parenthesized tag selected before substitution rebinding", () => {
    assert.equal(
      bulkCalls(
        prefix + "var tag = function () { run = true; }; (tag)`${tag = function () {}}`; " + suffix,
      ),
      1,
    );
  });

  it("does not invoke a replacement installed by a substitution", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "var tag = function () {}; tag`${(tag = function () { run = true; }, 0)}`; " +
          suffix,
      ),
      0,
    );
  });

  it("joins unknown tag alternatives conservatively", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "function change() { run = true; } function noop() {} var tag = external ? change : noop; tag``; " +
          suffix,
      ),
      1,
    );
  });

  it("exposes the callback passed before a later substitution replaces its binding", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "var callback = function () { run = true; }; external`${callback}${callback = function () {}}`; " +
          suffix,
      ),
      1,
    );
  });

  it("preserves an earlier parenthesized callback substitution", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "var callback = function () { run = true; }; external`${(callback)}${callback = function () {}}`; " +
          suffix,
      ),
      1,
    );
  });

  it("does not expose a replacement installed after an empty callback was passed", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "var callback = function () {}; external`${callback}${(callback = function () { run = true; }, 0)}`; " +
          suffix,
      ),
      0,
    );
  });

  it("skips tag invocation when a substitution throws", () => {
    assert.equal(
      bulkCalls(
        prefix +
          "function tag() { run = true; } function fail() { throw 0; } try { tag`${fail()}`; } catch (error) {} " +
          suffix,
      ),
      0,
    );
  });

  it("preserves selectors outside the tag captures", () => {
    assert.equal(bulkCalls(prefix + "function tag() {} tag``; " + suffix), 0);
  });

  it("retains immediate parameter-default effects of a discarded generator tag", () => {
    assert.equal(
      bulkCalls(prefix + "function* tag(strings, unused = (run = true)) {} tag``; " + suffix),
      1,
    );
  });

  it("retains diagnostics across five hundred tag invocations within the work budget", () => {
    assert.equal(
      bulkCalls(prefix + "function tag() { run = true; } " + "tag``; ".repeat(500) + suffix),
      1,
    );
  });

  it("does not retain unopened records across immediate generator default effects", () => {
    const { messages, analysis } = lintWithAnalysis(
      prefix +
        "function* tag(strings, unused = (run = true, records.query())) {} tag``; run &&= records.next();",
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(messages.length, 0);
  });

  it("does not execute a discarded generator tag", () => {
    assert.equal(bulkCalls(prefix + "function* tag() { run = true; } tag``; " + suffix), 0);
  });
});
