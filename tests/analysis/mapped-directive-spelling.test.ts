import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import { applyRules } from "../helpers/apply-rules.js";

function bulkCalls(code: string): number {
  const parsed = parseSync("directive.br.js", code, { sourceType: "script", lang: "js" });
  assert.deepEqual(parsed.errors, []);
  let exhausted: boolean | undefined;
  const messages = applyRules(
    code,
    { ast: parsed.program },
    {
      filename: "directive.br.js",
      ruleNames: ["no-unfiltered-gliderecord-bulk-operation"],
      onFileAnalysis: (analysis) => {
        exhausted = analysis.pathBudgetExhausted;
      },
    },
  );
  assert.equal(exhausted, false);
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Strict directives retain their original spelling]]
describe("mapped argument directive spelling", () => {
  const use =
    "function use(run) { run = false; arguments[0]++; run &&= records.deleteMultiple(); } use(false);";
  for (const directive of [
    String.raw`"use\x20strict";`,
    String.raw`'use\x20strict';`,
    String.raw`"use\u0020strict";`,
    String.raw`"use\u{20}strict";`,
    String.raw`"u\u0073e strict";`,
    String.raw`"use\
 strict";`,
  ]) {
    it(`keeps escaped program directives sloppy: ${directive}`, () => {
      assert.equal(bulkCalls(directive + 'var records = new GlideRecord("task"); ' + use), 1);
    });
    it(`keeps escaped function directives sloppy: ${directive}`, () => {
      assert.equal(
        bulkCalls(
          'var records = new GlideRecord("task"); function outer() {' +
            directive +
            use +
            "} outer();",
        ),
        1,
      );
    });
  }
  for (const directive of [
    '"use strict";',
    "'use strict';",
    String.raw`"use\x20strict"; "use strict";`,
  ]) {
    it(`honors an unescaped strict directive: ${directive}`, () => {
      assert.equal(bulkCalls(directive + 'var records = new GlideRecord("task"); ' + use), 0);
    });
  }
  it("ends the prologue after a parenthesized string", () => {
    assert.equal(
      bulkCalls('( "use strict" ); "use strict"; var records = new GlideRecord("task"); ' + use),
      1,
    );
  });
});
