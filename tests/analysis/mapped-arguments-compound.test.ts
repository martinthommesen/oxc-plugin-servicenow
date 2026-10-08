import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import { applyRules } from "../helpers/apply-rules.js";

// @lat: [[tests#Analysis behavior#Mapped arguments compound writes invalidate selectors]]
describe("mapped arguments compound writes", () => {
  for (const effect of [
    "arguments[0]++;",
    "++arguments[0];",
    "arguments[0]--;",
    "--arguments[0];",
    "arguments[0] += 1;",
    "arguments[0] -= 1;",
    "arguments[0] += (arguments = [], 1);",
    "arguments[(arguments = [], 0)]++;",
    "arguments[0] = (arguments = [], true);",
  ]) {
    for (const [params, argument, directive, expected] of [
      ["run", "false", "", 1],
      ["run", "false", '"use strict";', 0],
      ["run = false", "false", "", 0],
      ["run", "", "", 0],
    ] as const) {
      it(`${effect} respects (${params}), use(${argument}) and ${directive || "sloppy execution"}`, () => {
        const code = `var records = new GlideRecord("task"); function use(${params}) { ${directive} run = false; ${effect} run &&= records.deleteMultiple(); } use(${argument});`;
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
  }
});
