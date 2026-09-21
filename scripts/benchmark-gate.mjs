/**
 * @typedef {object} BenchmarkRow
 * @property {string} fixture
 * @property {string} profile
 * @property {number} elapsedMs
 * @property {number} peakRssKb
 * @property {Array<{ elapsedMs: number, peakRssKb: number | null }>} [rawSamples]
 */

/**
 * @param {BenchmarkRow} row
 * @returns {string}
 */
function caseKey(row) {
  return `${row.fixture}\0${row.profile}`;
}

/**
 * @param {BenchmarkRow[]} results
 * @param {BenchmarkRow[]} baselineRows
 * @param {{ allowNew?: boolean }} [options] `allowNew` accepts fixtures the
 *   baseline lacks, which is how a pull request introduces a fixture before
 *   the target branch has a row for it.
 * @returns {void}
 */
export function assertBenchmarkFixtureSet(results, baselineRows, { allowNew = false } = {}) {
  const actual = results.map(caseKey);
  const baseline = baselineRows.map(caseKey);
  if (new Set(actual).size !== actual.length)
    throw new Error("benchmark produced duplicate fixture/profile keys");
  if (new Set(baseline).size !== baseline.length)
    throw new Error("performance baseline contains duplicate fixture/profile keys");
  const actualKeys = new Set(actual);
  const baselineKeys = new Set(baseline);
  const missing = baseline.filter((key) => !actualKeys.has(key));
  const extra = allowNew ? [] : actual.filter((key) => !baselineKeys.has(key));
  if (missing.length || extra.length) {
    throw new Error(
      `benchmark fixture set mismatch (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
    );
  }
}

/**
 * @param {{ status: number | null, signal: string | null, stdout: string, stderr: string }} result
 * @returns {unknown}
 */
export function validateOxlintProcessResult(result) {
  if (result.signal) throw new Error(`oxlint terminated by signal ${result.signal}`);
  if (result.status !== 0)
    throw new Error(`oxlint exited ${result.status}: ${result.stderr || result.stdout}`);
  if (result.stderr.trim()) throw new Error(`oxlint wrote to stderr: ${result.stderr}`);
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error("oxlint output is not one complete JSON document");
  }
  if (!report || typeof report !== "object" || !Array.isArray(report.diagnostics)) {
    throw new Error("oxlint JSON has no diagnostics array");
  }
  if (report.diagnostics.length > 0) {
    const codes = report.diagnostics.map(
      /** @param {any} diagnostic */ (diagnostic) => diagnostic.code ?? "unknown",
    );
    throw new Error(`benchmark fixture produced diagnostics: ${codes.join(", ")}`);
  }
  return report;
}

/**
 * @param {any} regression
 * @returns {void}
 */
function validateThresholds(regression) {
  for (const field of [
    "elapsedMultiplier",
    "elapsedFloorMs",
    "rssMultiplier",
    "rssFloorKb",
    "maxScale",
    "maxRecommendedLargeMs",
  ]) {
    if (
      typeof regression?.[field] !== "number" ||
      !Number.isFinite(regression[field]) ||
      regression[field] <= 0
    ) {
      throw new Error(`benchmark regression.${field} is malformed`);
    }
  }
}

/**
 * @template {{ scale: number, results: BenchmarkRow[] }} T
 * @param {T} summary
 * @param {{ requireRawSamples?: boolean }} [options]
 * @returns {T}
 */
export function validateBenchmarkSummary(summary, options = {}) {
  const record = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (summary));
  if (!record || typeof record !== "object" || !Array.isArray(record["results"])) {
    throw new Error("benchmark summary is malformed");
  }
  for (const field of [
    "date",
    "node",
    "npm",
    "oxlint",
    "plugin",
    "cpu",
    "platform",
    "arch",
    "commit",
    "command",
    "statistic",
  ]) {
    if (typeof record[field] !== "string" || !record[field])
      throw new Error(`benchmark summary ${field} is malformed`);
  }
  for (const field of ["warmup", "samples", "scale"]) {
    if (typeof record[field] !== "number" || !Number.isFinite(record[field])) {
      throw new Error(`benchmark summary ${field} is malformed`);
    }
  }
  validateThresholds(record["regression"]);
  for (const row of summary.results) {
    if (
      !row ||
      typeof row.fixture !== "string" ||
      typeof row.profile !== "string" ||
      typeof row.elapsedMs !== "number" ||
      !Number.isFinite(row.elapsedMs) ||
      typeof row.peakRssKb !== "number" ||
      !Number.isFinite(row.peakRssKb) ||
      row.peakRssKb <= 0
    ) {
      throw new Error("benchmark result row is malformed or has unavailable RSS");
    }
    if (options.requireRawSamples) {
      if (!Array.isArray(row.rawSamples) || row.rawSamples.length !== record["samples"]) {
        throw new Error(`benchmark ${caseKey(row)} raw samples are missing`);
      }
      let availableRssSamples = 0;
      for (const sample of row.rawSamples) {
        if (!(sample.elapsedMs > 0) || (sample.peakRssKb !== null && !(sample.peakRssKb > 0))) {
          throw new Error(`benchmark ${caseKey(row)} raw sample is malformed`);
        }
        if (sample.peakRssKb !== null) availableRssSamples += 1;
      }
      if (availableRssSamples === 0)
        throw new Error(`benchmark ${caseKey(row)} required peak RSS metric is unavailable`);
    }
  }
  assertBenchmarkFixtureSet(summary.results, summary.results);
  return summary;
}

/**
 * @param {BenchmarkRow[]} results
 * @param {{ results?: BenchmarkRow[], regression: { elapsedMultiplier: number, elapsedFloorMs: number, rssMultiplier: number, rssFloorKb: number, maxScale: number, maxRecommendedLargeMs: number } }} baseline
 * @returns {string[]}
 */
export function checkBenchmarkRegression(results, baseline) {
  validateThresholds(baseline.regression);
  const baselineRows = baseline.results ?? [];
  assertBenchmarkFixtureSet(results, baselineRows, { allowNew: true });
  const trends = [];
  for (const row of results) {
    const previous = baselineRows.find((item) => caseKey(item) === caseKey(row));
    // A fixture the target-branch baseline lacks was added by this change, so
    // it has no trend yet; the absolute ceilings below still apply to it.
    if (!previous) continue;
    const elapsedLimit =
      previous.elapsedMs * baseline.regression.elapsedMultiplier +
      baseline.regression.elapsedFloorMs;
    if (row.elapsedMs > elapsedLimit) {
      trends.push(
        `${row.fixture}/${row.profile} elapsed ${row.elapsedMs}ms exceeded ${elapsedLimit}ms`,
      );
    }
    const rssLimit =
      previous.peakRssKb * baseline.regression.rssMultiplier + baseline.regression.rssFloorKb;
    if (row.peakRssKb > rssLimit) {
      trends.push(`${row.fixture}/${row.profile} RSS ${row.peakRssKb}KB exceeded ${rssLimit}KB`);
    }
  }
  const large = results.find((row) => row.fixture === "classic-large/recommended");
  const small = results.find((row) => row.fixture === "classic-small/recommended");
  const scale = large && small ? large.elapsedMs / small.elapsedMs : Number.POSITIVE_INFINITY;
  if (scale > baseline.regression.maxScale) {
    throw new Error(
      `recommended scale ${scale.toFixed(2)} exceeded ${baseline.regression.maxScale}`,
    );
  }
  if (!large || large.elapsedMs > baseline.regression.maxRecommendedLargeMs) {
    throw new Error(
      `classic-large/recommended exceeded ${baseline.regression.maxRecommendedLargeMs}ms`,
    );
  }
  return trends;
}
