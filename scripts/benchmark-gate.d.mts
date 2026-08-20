export interface BenchmarkRow { fixture: string; elapsedMs: number; peakRssKb: number }
export function assertBenchmarkFixtureSet(results: BenchmarkRow[], baselineRows: BenchmarkRow[]): void;
export function checkBenchmarkRegression(results: BenchmarkRow[], baseline: { results?: BenchmarkRow[]; regression: { elapsedMultiplier: number; elapsedFloorMs: number; rssMultiplier: number; rssFloorKb: number } }): void;

export function validateBenchmarkSummary(summary: { scale: number; results: BenchmarkRow[] }): typeof summary;
