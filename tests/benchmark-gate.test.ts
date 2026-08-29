import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertBenchmarkFixtureSet,
  checkBenchmarkRegression,
  validateBenchmarkSummary,
  validateOxlintProcessResult,
} from "../scripts/benchmark-gate.mjs";

const regression = {
  elapsedMultiplier: 2,
  elapsedFloorMs: 10,
  rssMultiplier: 2,
  rssFloorKb: 10,
  maxScale: 4,
  maxRecommendedLargeMs: 5000,
};
const row = (fixture: string, elapsedMs: number, peakRssKb = 100, profile = "recommended") => ({
  fixture,
  profile,
  elapsedMs,
  peakRssKb,
});
const summary = (results = [row("a", 1)]) => ({
  date: "2026-08-21",
  node: "v26.7.0",
  npm: "12.0.2",
  oxlint: "1.79.0",
  plugin: "2.0.0",
  cpu: "test",
  platform: "darwin",
  arch: "arm64",
  commit: "b87972a8336d6cf6209801395cad82f72b827436",
  command: "npm run bench",
  warmup: 1,
  samples: 1,
  statistic: "median",
  regression,
  scale: 1,
  results,
});

describe("benchmark regression gate", () => {
  it("requires one-to-one fixture names", () => {
    assert.throws(
      () => assertBenchmarkFixtureSet([row("a", 1)], [row("a", 1), row("b", 1)]),
      /set mismatch/,
    );
    assert.throws(
      () => assertBenchmarkFixtureSet([row("a", 1), row("a", 1)], [row("a", 1), row("a", 1)]),
      /duplicate/,
    );
  });

  it("validates the emitted benchmark JSON shape", () => {
    assert.equal(validateBenchmarkSummary(summary()).results.length, 1);
    assert.throws(() => validateBenchmarkSummary({ ...summary(), scale: Number.NaN }), /scale/);
    assert.throws(() => validateBenchmarkSummary(summary([row("a", 1, 0)])), /unavailable RSS/);
    const withRawSamples = {
      ...summary(),
      samples: 2,
      results: [
        {
          ...row("a", 1),
          rawSamples: [
            { elapsedMs: 1, peakRssKb: null },
            { elapsedMs: 1, peakRssKb: 100 },
          ],
        },
      ],
    };
    assert.equal(
      validateBenchmarkSummary(withRawSamples, { requireRawSamples: true }).results.length,
      1,
    );
    assert.throws(
      () =>
        validateBenchmarkSummary(
          {
            ...withRawSamples,
            results: [
              {
                ...row("a", 1),
                rawSamples: [
                  { elapsedMs: 1, peakRssKb: null },
                  { elapsedMs: 1, peakRssKb: null },
                ],
              },
            ],
          },
          { requireRawSamples: true },
        ),
      /unavailable/,
    );
  });

  it("turns repeated full-file growth into a failing gate", () => {
    const baseline = {
      results: [row("classic-small/recommended", 100), row("classic-large/recommended", 200)],
      regression,
    };
    assert.throws(
      () =>
        checkBenchmarkRegression(
          [row("classic-small/recommended", 100), row("classic-large/recommended", 1000)],
          baseline,
        ),
      /exceeded/,
    );
    assert.doesNotThrow(() =>
      checkBenchmarkRegression(
        [row("classic-small/recommended", 100), row("classic-large/recommended", 300)],
        baseline,
      ),
    );
  });

  it("reports absolute runner variance as trend evidence", () => {
    const baseline = {
      results: [row("classic-small/recommended", 100), row("classic-large/recommended", 200)],
      regression,
    };
    const trends = checkBenchmarkRegression(
      [row("classic-small/recommended", 300, 500), row("classic-large/recommended", 600, 500)],
      baseline,
    );
    assert.equal(trends.length, 4);
    assert.match(trends.join("\n"), /elapsed/);
    assert.match(trends.join("\n"), /RSS/);
  });

  it("accepts only a clean, complete Oxlint result", () => {
    const valid = { status: 0, signal: null, stdout: '{"diagnostics":[]}', stderr: "" };
    assert.deepEqual(validateOxlintProcessResult(valid), { diagnostics: [] });
    assert.throws(() => validateOxlintProcessResult({ ...valid, stdout: "{" }), /complete JSON/);
    assert.throws(() => validateOxlintProcessResult({ ...valid, status: 1 }), /exited 1/);
    assert.throws(() => validateOxlintProcessResult({ ...valid, signal: "SIGTERM" }), /signal/);
    assert.throws(
      () => validateOxlintProcessResult({ ...valid, stderr: "configuration failed" }),
      /stderr/,
    );
    assert.throws(
      () =>
        validateOxlintProcessResult({
          ...valid,
          stdout: '{"diagnostics":[{"code":"parser"}]}',
        }),
      /parser/,
    );
  });
});
