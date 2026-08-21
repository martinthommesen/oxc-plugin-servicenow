import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("performance baseline", () => {
  it("records a real Oxlint matrix and a release threshold", () => {
    const raw = readFileSync(path.join(root, "docs/performance-baseline.json"), "utf8");
    const baseline = JSON.parse(raw) as {
      command: string;
      statistic: string;
      regression: { maxRecommendedLargeMs: number; maxScale: number };
      results: Array<{ fixture: string; profile: string; elapsedMs: number; peakRssKb: number }>;
    };
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
    for (const row of baseline.results) {
      assert.ok(row.elapsedMs >= 0);
      assert.ok(row.peakRssKb >= 0);
    }
  });
});
