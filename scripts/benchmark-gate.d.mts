export interface BenchmarkRow {
  fixture: string;
  profile: string;
  elapsedMs: number;
  peakRssKb: number;
  rawSamples?: Array<{ elapsedMs: number; peakRssKb: number }>;
}
export function assertBenchmarkFixtureSet(
  results: BenchmarkRow[],
  baselineRows: BenchmarkRow[],
): void;
export function validateOxlintProcessResult(result: {
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
}): unknown;
export function checkBenchmarkRegression(
  results: BenchmarkRow[],
  baseline: {
    results?: BenchmarkRow[];
    regression: {
      elapsedMultiplier: number;
      elapsedFloorMs: number;
      rssMultiplier: number;
      rssFloorKb: number;
      maxScale: number;
      maxRecommendedLargeMs: number;
    };
  },
): string[];

export function validateBenchmarkSummary<T extends { scale: number; results: BenchmarkRow[] }>(
  summary: T,
  options?: { requireRawSamples?: boolean },
): T;
