import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function unfilteredOperations(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Nullish helper arguments select only applicable defaults]]
describe("nullish helper defaults", () => {
  for (const [setup, argument] of [
    ["var flag = true;", "null"],
    ["var flag = true;", "flag &&= null"],
    ["var flag = null;", "flag &&= 0"],
    ["var input = null;", "input"],
    ["var input = null; var alias = input;", "alias"],
    ["var flag = true;", "(0, flag &&= null)"],
    ["var flag = true;", "true ? (flag &&= null) : void 0"],
    ["var flag = true;", "false ? void 0 : (flag &&= null)"],
  ] as const) {
    it(`skips an escaping default for the null argument ${argument}`, () => {
      assert.equal(
        unfilteredOperations(
          `var records = new GlideRecord("task"); ${setup} function use(value = external(records)) { value &&= false; } use(${argument}); records.deleteMultiple();`,
        ),
        1,
      );
    });
  }

  it("does not execute a bulk operation default for a null alias", () => {
    assert.equal(
      unfilteredOperations(
        `var records = new GlideRecord("task"); var input = null; function use(value = records.deleteMultiple()) { value &&= false; } use(input);`,
      ),
      0,
    );
  });

  it("propagates a null argument through known helper parameters", () => {
    assert.equal(
      unfilteredOperations(
        `var records = new GlideRecord("task"); var input = null; function use(value = external(records)) { value &&= false; } function relay(value) { use(value); } relay(input); records.deleteMultiple();`,
      ),
      1,
    );
  });

  it("captures null before a later argument replaces it with undefined", () => {
    assert.equal(
      unfilteredOperations(
        `var records = new GlideRecord("task"); var input = null; function use(value = external(records), unused) { value &&= false; } use(input, input = void 0); records.deleteMultiple();`,
      ),
      1,
    );
  });

  for (const [setup, argument] of [
    ["", ""],
    ["", "void 0"],
    ["", "undefined"],
    ["var input = void 0;", "input"],
    ["var input = undefined; var alias = input;", "alias"],
    ["var flag = true;", "flag &&= void 0"],
    ["var flag = true;", "(0, flag &&= void 0)"],
  ] as const) {
    it(`runs a default for the undefined argument ${argument || "omitted"}`, () => {
      assert.equal(
        unfilteredOperations(
          `var records = new GlideRecord("task"); ${setup} function use(value = records.deleteMultiple()) { value &&= false; } use(${argument});`,
        ),
        1,
      );
    });
  }

  it("keeps a possible default for joined null and undefined arguments", () => {
    assert.equal(
      unfilteredOperations(
        `var records = new GlideRecord("task"); var input; if (external) { input = null; } else { input = void 0; } function use(value = records.deleteMultiple()) { value &&= false; } use(input);`,
      ),
      1,
    );
  });

  it("retains shared nullish certainty when null and undefined facts join", () => {
    assert.equal(
      unfilteredOperations(
        `var records = new GlideRecord("task"); var input; if (external) { input = null; } else { input = void 0; } input ??= (records.addQuery("active", true), 0); records.deleteMultiple();`,
      ),
      0,
    );
  });
});
