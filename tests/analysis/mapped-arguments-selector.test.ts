import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import { applyRules } from "../helpers/apply-rules.js";

// @lat: [[tests#Analysis behavior#Mapped arguments writes invalidate scalar selectors]]
describe("mapped arguments selectors", () => {
  for (const [params, effect, argument, expected] of [
    ["run", "arguments[0] = true;", "true", 1],
    // The bound no-init alias loses method authority; path-state.test.ts proves mapping with fixed authority.
    ["run", "var arguments; arguments[0] = true;", "true", 0],
    ["run", "var arguments = []; arguments[0] = true;", "true", 0],
    ["run, arguments", "arguments[0] = true;", "true, []", 0],
    ["run", "var args = arguments; args[0] = true;", "true", 1],
    ["run", "(() => { arguments[0] = true; })();", "true", 1],
    ["run", "external(arguments);", "true", 1],
    ["run", "arguments[0] = true;", "", 0],
    ["run = false", "arguments[0] = true;", "true", 0],
    ["...run", "arguments[0] = true;", "true", 0],
    ["run", "var args = arguments; args = []; args[0] = true;", "true", 0],
    ["run", "arguments = []; arguments[0] = true;", "true", 0],
    ["run", "function inner() { arguments[0] = true; } inner(true);", "true", 0],
  ] as const) {
    it(`respects the arguments owner for (${params}) with ${effect} use(${argument})`, () => {
      const code = `var records = new GlideRecord("task"); function use(${params}) { run = false; ${effect} run &&= records.deleteMultiple(); } use(${argument});`;
      const parsed = parseSync("mapped.br.js", code, { sourceType: "script", lang: "js" });
      assert.deepEqual(parsed.errors, []);
      let exhausted: boolean | undefined;
      const messages = applyRules(
        code,
        { ast: parsed.program },
        {
          filename: "mapped.br.js",
          ruleNames: ["no-unfiltered-gliderecord-bulk-operation"],
          onFileAnalysis: (analysis) => {
            exhausted = analysis.pathBudgetExhausted;
          },
        },
      );
      assert.equal(exhausted, false);
      assert.equal(messages.length, expected);
    });
  }
  for (const sourceType of ["script", "module"] as const) {
    it(`respects inherited strictness in ${sourceType}`, () => {
      const code = `"use strict"; var records = new GlideRecord("task"); function use(run) { run = false; arguments[0] = true; run &&= records.deleteMultiple(); } use(true);`;
      const parsed = parseSync("mapped.br.js", code, { sourceType, lang: "js" });
      assert.deepEqual(parsed.errors, []);
      assert.deepEqual(
        applyRules(
          code,
          { ast: parsed.program },
          { filename: "mapped.br.js", ruleNames: ["no-unfiltered-gliderecord-bulk-operation"] },
        ),
        [],
      );
    });
  }
  it("keeps strict function parameters separate from arguments", () => {
    const code = `var records = new GlideRecord("task"); function use(run) { "use strict"; run = false; arguments[0] = true; run &&= records.deleteMultiple(); } use(true);`;
    const parsed = parseSync("mapped.br.js", code, { sourceType: "script", lang: "js" });
    assert.deepEqual(parsed.errors, []);
    assert.deepEqual(
      applyRules(
        code,
        { ast: parsed.program },
        { filename: "mapped.br.js", ruleNames: ["no-unfiltered-gliderecord-bulk-operation"] },
      ),
      [],
    );
  });
});
