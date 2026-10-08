import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function disabledHelperChain(count: number): string {
  const lines = ["var f0 = function() {}; f0(false);"];
  for (let index = 1; index <= count; index += 1) {
    lines.push(`var f${index} = function(flag) { flag &&= f${index - 1}(); }; f${index}(false);`);
  }
  lines.push('var records = new GlideRecord("task"); records.deleteMultiple();');
  return lines.join("\n");
}

// @lat: [[tests#Analysis behavior#Helper definitions retain direct capture snapshots within budget]]
describe("definition-time callable capture scaling", () => {
  for (const count of [200, 375]) {
    it(`preserves a later bulk finding after ${count} pruned helper definitions`, () => {
      const code = disabledHelperChain(count);
      const { messages, analysis } = lintWithAnalysis(
        code,
        "no-unfiltered-gliderecord-bulk-operation",
      );
      assert.equal(analysis.pathBudgetExhausted, false);
      assert.deepEqual(
        messages.map(({ messageId, line }) => ({ messageId, line })),
        [{ messageId: "unfiltered", line: code.split("\n").length }],
      );
    });
  }
});
