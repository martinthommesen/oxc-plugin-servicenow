export interface EvidenceTestReport {
  readonly tests?: readonly unknown[];
}

export interface EvidenceResult {
  readonly errors: readonly string[];
  readonly records: readonly unknown[];
}

export function evidenceTestReportPath(base?: string): string;
export function runEvidenceTests(base?: string): EvidenceTestReport;
export function writeJsonArtifact(path: string, value: unknown): void;
export function verifyDocEvidence(
  catalog: readonly unknown[],
  report: EvidenceTestReport,
): Promise<EvidenceResult>;
export function main(): Promise<unknown>;
