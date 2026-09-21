import assert from "node:assert/strict";

const SAMPLES = 5;

function median(values: readonly number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
}

/**
 * Asserts that quadrupling the input stays well below quadratic time.
 *
 * Both sizes run once before timing so first-run compilation lands outside
 * the samples. The two sizes are then timed alternately within each sample
 * and the ratio is taken per sample: a machine that slows down partway
 * through the run then inflates both measurements instead of only the one
 * that happened to be timed last.
 */
export function assertSubQuadratic(options: {
  readonly label: string;
  readonly smallLabel: string;
  readonly largeLabel: string;
  readonly small: () => void;
  readonly large: () => void;
  readonly maxRatio?: number;
}): void {
  options.small();
  options.large();
  const smallSamples: number[] = [];
  const largeSamples: number[] = [];
  const ratios: number[] = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    const smallStart = performance.now();
    options.small();
    const smallMs = performance.now() - smallStart;
    const largeStart = performance.now();
    options.large();
    const largeMs = performance.now() - largeStart;
    smallSamples.push(smallMs);
    largeSamples.push(largeMs);
    ratios.push(smallMs === 0 ? Infinity : largeMs / smallMs);
  }
  const smallMs = median(smallSamples);
  const largeMs = median(largeSamples);
  assert.ok(
    median(ratios) < (options.maxRatio ?? 9),
    `${options.label} regressed: ${options.smallLabel} took ${smallMs.toFixed(1)}ms, ${options.largeLabel} took ${largeMs.toFixed(1)}ms`,
  );
}
