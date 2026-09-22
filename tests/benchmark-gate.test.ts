import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertBenchmarkFixtureSet,
  checkBenchmarkRegression,
  classifySourceState,
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
// Shaped like the reviewed docs/performance-baseline.json, which was written
// before worktree provenance existed and therefore carries no sourceState.
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

  it("accepts a fixture the target baseline lacks as new, without a trend", () => {
    assert.doesNotThrow(() =>
      assertBenchmarkFixtureSet([row("a", 1), row("b", 1)], [row("a", 1)], { allowNew: true }),
    );
    assert.throws(
      () =>
        assertBenchmarkFixtureSet([row("a", 1)], [row("a", 1), row("b", 1)], { allowNew: true }),
      /missing: b/,
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

  // @lat: [[tests#Scripts and tooling#Benchmark output records the measured source state]]
  it("distinguishes a clean worktree from the source that was measured", () => {
    assert.deepEqual(classifySourceState(""), { sourceState: "clean" });
    assert.deepEqual(classifySourceState(" M src/rules/no-gs-now.ts\0?? scripts/probe.mjs\0"), {
      sourceState: "dirty",
      dirtyFiles: ["scripts/probe.mjs", "src/rules/no-gs-now.ts"],
    });
    // A rename emits the destination first and the original as its own
    // record; the destination is the file present in the measured worktree.
    assert.deepEqual(classifySourceState("R  src/new name.ts\0src/old.ts\0"), {
      sourceState: "dirty",
      dirtyFiles: ["src/new name.ts"],
    });
    // The line format would quote this path as "src/caf\303\251.ts", which
    // the -z format hands back verbatim instead.
    assert.deepEqual(classifySourceState(" M src/café.ts\0?? tests/naïve.test.ts\0"), {
      sourceState: "dirty",
      dirtyFiles: ["src/café.ts", "tests/naïve.test.ts"],
    });
  });

  // @lat: [[tests#Scripts and tooling#Benchmark outputs never mark their own run dirty]]
  it("never calls a run dirty because of its own output files", () => {
    const porcelain =
      " M docs/performance-baseline.json\0?? artifacts/performance-current.json\0?? note.txt\0";
    assert.deepEqual(
      classifySourceState(porcelain, {
        ignorePaths: ["docs/performance-baseline.json", "artifacts/performance-current.json"],
      }),
      { sourceState: "clean" },
    );
    // Without the exclusion the same baseline edit is a real source change,
    // so the exclusion is what keeps the clean verdict honest.
    assert.deepEqual(classifySourceState(porcelain), {
      sourceState: "dirty",
      dirtyFiles: ["docs/performance-baseline.json"],
    });
  });

  // @lat: [[tests#Scripts and tooling#Source state is required for new runs and tolerated in old baselines]]
  it("requires worktree provenance from a new run but tolerates an older baseline", () => {
    const clean = { ...summary(), sourceState: "clean" as const };
    assert.equal(validateBenchmarkSummary(clean, { requireSourceState: true }).scale, 1);
    assert.equal(
      validateBenchmarkSummary(
        { ...summary(), sourceState: "dirty" as const, dirtyFiles: ["src/rules/no-gs-now.ts"] },
        { requireSourceState: true },
      ).scale,
      1,
    );
    assert.equal(validateBenchmarkSummary(summary()).scale, 1);
    assert.throws(
      () => validateBenchmarkSummary(summary(), { requireSourceState: true }),
      /sourceState is missing/,
    );
    assert.throws(
      () => validateBenchmarkSummary({ ...summary(), sourceState: "stale" }),
      /sourceState is malformed/,
    );
    assert.throws(
      () => validateBenchmarkSummary({ ...clean, dirtyFiles: ["src/rules/no-gs-now.ts"] }),
      /clean source with dirtyFiles/,
    );
    assert.throws(
      () => validateBenchmarkSummary({ ...summary(), sourceState: "dirty" }),
      /dirty source without dirtyFiles/,
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
