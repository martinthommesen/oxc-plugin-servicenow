import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertBenchmarkFixtureSet, checkBenchmarkRegression } from "../scripts/benchmark-gate.mjs";

const regression = { elapsedMultiplier: 2, elapsedFloorMs: 10, rssMultiplier: 2, rssFloorKb: 10 };
const row = (fixture: string, elapsedMs: number, peakRssKb = 100) => ({ fixture, elapsedMs, peakRssKb });

describe("benchmark regression gate", () => {
  it("requires one-to-one fixture names", () => {
    assert.throws(() => assertBenchmarkFixtureSet([row("a", 1)], [row("a", 1), row("b", 1)]), /set mismatch/);
    assert.throws(() => assertBenchmarkFixtureSet([row("a", 1), row("a", 1)], [row("a", 1), row("a", 1)]), /duplicate/);
  });

  it("turns repeated full-file growth into a failing gate", () => {
    const baseline = { results: [row("full", 100)], regression };
    assert.throws(() => checkBenchmarkRegression([row("full", 500)], baseline), /exceeded/);
    assert.doesNotThrow(() => checkBenchmarkRegression([row("full", 200)], baseline));
  });
});
