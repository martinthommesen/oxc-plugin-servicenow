import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPathBudgetExceededCount,
  resetPathBudgetExceededCount,
} from "../../src/analysis/path-state.js";
import { lint } from "../helpers/rule-tester.js";

// An ordinary ServiceNow script must be analyzed completely: the fixed
// 50k work budget was exhausted by roughly 300 lines of provenance-bearing
// code, after which every finding in the file was silently dropped
// (FINDINGS.md PER-003). The budget now scales with program size, so the
// finding count keeps growing with the file.
function corpus(blocks: number): string {
  return Array.from(
    { length: blocks },
    (_, i) =>
      `var gr${i} = new GlideRecord("incident");\ngr${i}.query();\nvar c${i} = 0;\nwhile (gr${i}.next()) { c${i}++; }\ngs.info(c${i});`,
  ).join("\n");
}

describe("path-analysis budget scaling (FINDINGS.md PER-003)", () => {
  it("analyzes a 60-block script completely without exhausting the budget", () => {
    resetPathBudgetExceededCount();
    const messages = lint(corpus(60), "prefer-glideaggregate");
    assert.equal(messages.length, 60);
    assert.equal(getPathBudgetExceededCount(), 0);
  });
});
