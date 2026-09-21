import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { validateBenchmarkSummary } from "../../scripts/benchmark-gate.mjs";
import { repoRoot } from "../integration/helpers.js";

describe("performance baseline", () => {
  it("records a real Oxlint matrix and a release threshold", () => {
    const raw = readFileSync(path.join(repoRoot, "docs/performance-baseline.json"), "utf8");
    // One schema check for every row and metadata field, shared with the
    // gate the benchmark itself runs.
    const baseline = validateBenchmarkSummary(
      JSON.parse(raw) as {
        command: string;
        statistic: string;
        scale: number;
        regression: { maxRecommendedLargeMs: number; maxScale: number };
        results: Array<{ fixture: string; profile: string; elapsedMs: number; peakRssKb: number }>;
      },
    );
    assert.equal(baseline.command, "npm run bench -- --write");
    assert.equal(baseline.statistic, "median");
    assert.ok(baseline.regression.maxRecommendedLargeMs >= 2000);
    const fixtures = baseline.results.map((row) => row.fixture);
    for (const name of [
      "classic-small/recommended",
      "classic-medium/recommended",
      "classic-large/recommended",
      "branch-heavy/recommended",
      "fluent-large/recommended",
      "skip-client/recommended",
      "mixed/recommended",
      "classic-small/disabled",
    ]) {
      assert.ok(fixtures.includes(name), `missing ${name}`);
    }
  });
});
