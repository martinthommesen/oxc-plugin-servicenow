import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  exactProof,
  indexOutcomes,
  outcomeSummary,
  type TestOutcome,
} from "../scripts/lib/test-report.mjs";

const FILE = "tests/example.test.ts";
const NAME = "suite > case";

function outcome(overrides: Partial<TestOutcome> = {}): TestOutcome {
  return { file: FILE, fullName: NAME, status: "passed", ...overrides };
}

// @lat: [[tests#Scripts and tooling#Test report queries use one clean-pass rule]]
describe("test report queries", () => {
  it("distinguishes missing, ambiguous, failed, skipped, todo, and clean proofs", () => {
    assert.deepEqual(exactProof(indexOutcomes({ tests: [] }), FILE, NAME), {
      status: "missing",
      count: 0,
    });
    assert.deepEqual(exactProof(indexOutcomes({ tests: [outcome(), outcome()] }), FILE, NAME), {
      status: "ambiguous",
      count: 2,
    });
    for (const test of [
      outcome({ status: "failed" }),
      outcome({ skipped: true }),
      outcome({ todo: true }),
    ]) {
      assert.equal(exactProof(indexOutcomes({ tests: [test] }), FILE, NAME).status, "not-clean");
    }
    assert.equal(exactProof(indexOutcomes({ tests: [outcome()] }), FILE, NAME).status, "ok");
  });

  it("summarizes report outcomes with clean-pass semantics", () => {
    assert.deepEqual(
      outcomeSummary({
        tests: [
          outcome(),
          outcome({ fullName: "failed", status: "failed" }),
          outcome({ fullName: "skipped", skipped: true }),
          outcome({ fullName: "todo", todo: true }),
        ],
      }),
      { total: 4, passed: 1, failed: 1, skipped: 1, todo: 1 },
    );
  });
});
