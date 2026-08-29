function caseKey(row) {
  return `${row.fixture}\0${row.profile}`;
}

export function assertBenchmarkFixtureSet(results, baselineRows) {
  const actual = results.map(caseKey);
  const baseline = baselineRows.map(caseKey);
  if (new Set(actual).size !== actual.length)
    throw new Error("benchmark produced duplicate fixture/profile keys");
  if (new Set(baseline).size !== baseline.length)
    throw new Error("performance baseline contains duplicate fixture/profile keys");
  const missing = actual.filter((key) => !baseline.includes(key));
  const extra = baseline.filter((key) => !actual.includes(key));
  if (missing.length || extra.length) {
    throw new Error(
      `benchmark fixture set mismatch (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
    );
  }
}

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
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code ?? "unknown");
    throw new Error(`benchmark fixture produced diagnostics: ${codes.join(", ")}`);
  }
  return report;
}

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

export function validateBenchmarkSummary(summary, options = {}) {
  if (!summary || typeof summary !== "object" || !Array.isArray(summary.results)) {
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
    if (typeof summary[field] !== "string" || !summary[field])
      throw new Error(`benchmark summary ${field} is malformed`);
  }
  for (const field of ["warmup", "samples", "scale"]) {
    if (typeof summary[field] !== "number" || !Number.isFinite(summary[field])) {
      throw new Error(`benchmark summary ${field} is malformed`);
    }
  }
  validateThresholds(summary.regression);
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
      if (!Array.isArray(row.rawSamples) || row.rawSamples.length !== summary.samples) {
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

export function checkBenchmarkRegression(results, baseline) {
  validateThresholds(baseline.regression);
  const baselineRows = baseline.results ?? [];
  assertBenchmarkFixtureSet(results, baselineRows);
  const trends = [];
  for (const row of results) {
    const previous = baselineRows.find((item) => caseKey(item) === caseKey(row));
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
