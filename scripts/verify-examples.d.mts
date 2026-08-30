export type VerifyExpectation = {
  rule: string;
  file?: string;
  minCount?: number;
};

export type VerifyProject = {
  name: string;
  dir: string;
  feature: string;
  config: string;
  valid: string;
  invalid: string;
  invalidExpected: VerifyExpectation[];
};

export function sha256(value: string | Buffer): string;
export function parseRunId(value: string | undefined): string;
export function containedPath(base: string, dest: string): string;
export function runDirFor(repoRoot: string, runId: string): string;
export function sourceFingerprint(repoRoot: string): string;
export function distHash(repoRoot: string): string;
export function loadAndValidateProjects(repoRoot?: string): {
  oxfmtConfig: string;
  skillDir: string;
  projects: Record<string, VerifyProject>;
  names: string[];
};
export function findRepo(start?: string): { root: string; pkg: Record<string, unknown> };
export function examplesGit(repoRoot: string): {
  kind: "clean" | "dirty" | "error";
  detail: string;
  hash: string;
};
export function main(argv: string[]): number;
