import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";
import { assertSubQuadratic } from "../helpers/scaling.js";

// The benchmark's counter shape: a counted cursor loop followed by a
// post-loop counter write, which prefer-glideaggregate must reject after
// checking every use of the counter binding.
function counterFixture(count: number): string {
  const blocks: string[] = [];
  for (let index = 0; index < count; index += 1) {
    blocks.push(`var rec${index} = new GlideRecord("incident");
rec${index}.addQuery("active", true);
rec${index}.query();
var count${index} = 0;
while (rec${index}.next()) {
  count${index} += 1;
}
count${index} += 1;`);
  }
  return `${blocks.join("\n")}\n`;
}

// A run whose path analysis exhausted its budget disables the analysis the
// counter checks depend on, so its elapsed time is not scaling evidence.
function lintActive(source: string): void {
  const { messages, analysis } = lintWithAnalysis(source, "prefer-glideaggregate", {
    filename: "counters.br.js",
  });
  assert.equal(analysis.pathBudgetExhausted, false, "path budget exhausted; not a valid sample");
  assert.deepEqual(messages, [], "post-loop counter writes must keep the loops unreported");
}

// @lat: [[tests#Analysis behavior#Counter analysis scales linearly]]
describe("counter scaling (FINDINGS.md PER-005)", () => {
  it("stays sub-quadratic when counted loops quadruple with analysis active", () => {
    // Capped at 200: above roughly 300 counted loops the shared path budget
    // exhausts, which disables the analysis this measures and makes the run
    // useless as scaling evidence.
    const small = counterFixture(50);
    const large = counterFixture(200);
    assertSubQuadratic({
      label: "counter scaling",
      smallLabel: "50 loops",
      largeLabel: "200",
      small: () => lintActive(small),
      large: () => lintActive(large),
    });
  });

  it("still reports each counted loop without a post-loop write", () => {
    const source = counterFixture(20).replaceAll(/\ncount\d+ \+= 1;/g, "");
    const { messages, analysis } = lintWithAnalysis(source, "prefer-glideaggregate", {
      filename: "counters.br.js",
    });
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(messages.length, 20);
  });
});
