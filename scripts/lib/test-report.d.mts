export interface TestOutcome {
  readonly file: string;
  readonly fullName: string;
  readonly status: string;
  readonly skipped?: boolean;
  readonly todo?: boolean;
  readonly durationMs?: number;
}

export interface TestReport {
  readonly tests?: readonly TestOutcome[];
}

export type ExactProof =
  | { readonly status: "missing"; readonly count: 0 }
  | { readonly status: "ambiguous"; readonly count: number }
  | { readonly status: "not-clean"; readonly count: 1; readonly outcome: TestOutcome }
  | { readonly status: "ok"; readonly count: 1; readonly outcome: TestOutcome };

export function indexOutcomes(report: TestReport): Map<string, TestOutcome[]>;
export function exactProof(
  index: ReadonlyMap<string, readonly TestOutcome[]>,
  file: string,
  fullName: string,
): ExactProof;
export function outcomeSummary(report: TestReport): {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly todo: number;
};
