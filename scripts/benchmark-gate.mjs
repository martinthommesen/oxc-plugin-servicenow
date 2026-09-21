/**
 * Paths whose untracked content can change what a benchmark measures. A
 * tracked change anywhere else still counts; only untracked noise outside
 * these prefixes is ignored.
 */
const SOURCE_PATHS = ["src/", "scripts/", "tests/", "package.json"];

/**
 * @typedef {object} SourceState
 * @property {"clean" | "dirty"} sourceState
 * @property {string[]} [dirtyFiles]
 */

/**
 * Classify the measured worktree against HEAD from
 * `git status --porcelain -z`.
 *
 * Two rules keep the classification simple and keep a run from marking
 * itself dirty (FINDINGS.md DX-001):
 *
 * 1. `ignorePaths` — the run's own current-result and baseline files — never
 *    count, because the benchmark writes them itself.
 * 2. An untracked file counts only under `SOURCE_PATHS`; every tracked
 *    difference from HEAD counts wherever it is.
 *
 * The NUL-terminated format carries every path verbatim. The line format
 * quotes a non-ASCII path with octal byte escapes (`"src/caf\303\251.ts"`),
 * which is not JSON and cannot be decoded here.
 *
 * @param {string} porcelain
 * @param {{ ignorePaths?: readonly string[] }} [options]
 * @returns {SourceState}
 */
export function classifySourceState(porcelain, options = {}) {
  const ignored = new Set(options.ignorePaths ?? []);
  /** @type {string[]} */
  const dirtyFiles = [];
  const records = porcelain.split("\0");
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] ?? "";
    if (record.length < 4) continue;
    const status = record.slice(0, 2);
    const file = record.slice(3);
    // A rename or copy emits the destination, then the original as its own
    // record. The destination is the file present in the measured worktree.
    if (status.includes("R") || status.includes("C")) index += 1;
    if (ignored.has(file)) continue;
    if (status === "??" && !SOURCE_PATHS.some((prefix) => file.startsWith(prefix))) continue;
    if (!dirtyFiles.includes(file)) dirtyFiles.push(file);
  }
  if (dirtyFiles.length === 0) return { sourceState: "clean" };
  return { sourceState: "dirty", dirtyFiles: dirtyFiles.sort() };
}

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
 * Validate the worktree provenance a run records beside its commit.
 *
 * The field is additive: a reviewed baseline written before it existed still
 * validates, so old readers and `docs/performance-baseline.json` keep working
 * (FINDINGS.md DX-001).
 *
 * @param {Record<string, unknown>} record
 * @param {boolean} required
 * @returns {void}
 */
function validateSourceState(record, required) {
  const state = record["sourceState"];
  if (state === undefined) {
    if (required) throw new Error("benchmark summary sourceState is missing");
    return;
  }
  if (state !== "clean" && state !== "dirty")
    throw new Error("benchmark summary sourceState is malformed");
  const dirtyFiles = record["dirtyFiles"];
  if (state === "clean") {
    if (dirtyFiles !== undefined)
      throw new Error("benchmark summary reports a clean source with dirtyFiles");
    return;
  }
  if (
    !Array.isArray(dirtyFiles) ||
    dirtyFiles.length === 0 ||
    dirtyFiles.some((file) => typeof file !== "string" || !file)
  ) {
    throw new Error("benchmark summary reports a dirty source without dirtyFiles");
  }
}

/**
 * @template {{ scale: number, results: BenchmarkRow[] }} T
 * @param {T} summary
 * @param {{ requireRawSamples?: boolean, requireSourceState?: boolean }} [options]
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
  validateSourceState(record, options.requireSourceState === true);
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
