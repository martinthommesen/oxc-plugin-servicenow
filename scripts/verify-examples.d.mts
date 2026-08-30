export function sha256(value: string | Buffer): string;
export function parseRunId(value: string | undefined): string;
export function containedPath(base: string, dest: string): string;
export function runDirFor(repoRoot: string, runId: string): string;
export function sourceFingerprint(repoRoot: string): string;
export function distHash(repoRoot: string): string;
export function main(argv: string[]): number;
