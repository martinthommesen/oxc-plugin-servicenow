export function assertBenchmarkFixtureSet(results, baselineRows) {
  const actual = results.map((row) => row.fixture);
  const baseline = baselineRows.map((row) => row.fixture);
  if (new Set(actual).size !== actual.length) throw new Error("benchmark produced duplicate fixture names");
  if (new Set(baseline).size !== baseline.length) throw new Error("performance baseline contains duplicate fixture names");
  const missing = actual.filter((fixture) => !baseline.includes(fixture));
  const extra = baseline.filter((fixture) => !actual.includes(fixture));
  if (missing.length || extra.length) {
    throw new Error(`benchmark fixture set mismatch (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`);
  }
}

export function checkBenchmarkRegression(results, baseline) {
  const baselineRows = baseline.results ?? [];
  assertBenchmarkFixtureSet(results, baselineRows);
  for (const row of results) {
    const previous = baselineRows.find((item) => item.fixture === row.fixture);
    const elapsedLimit =
      Math.max(previous.elapsedMs * baseline.regression.elapsedMultiplier, previous.elapsedMs) +
      baseline.regression.elapsedFloorMs;
    if (row.elapsedMs > elapsedLimit) {
      throw new Error(`${row.fixture} elapsed ${row.elapsedMs}ms exceeded ${elapsedLimit}ms`);
    }
    if (previous.peakRssKb <= 0) throw new Error(`performance baseline ${row.fixture} has unavailable RSS measurement`);
    if (row.peakRssKb > 0) {
      const rssLimit = Math.max(previous.peakRssKb * baseline.regression.rssMultiplier, previous.peakRssKb) +
        baseline.regression.rssFloorKb;
      if (row.peakRssKb > rssLimit) throw new Error(`${row.fixture} RSS ${row.peakRssKb}KB exceeded ${rssLimit}KB`);
    }
  }
}
