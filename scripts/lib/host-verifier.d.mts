export const DEFAULT_TIMEOUT_MS: number;
export const DEFAULT_MAX_BUFFER: number;

export type HostError = {
  code?: string;
  message: string;
};

export type HostResult = {
  argv: string[];
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error: HostError | null;
  timedOut: boolean;
  durationMs: number;
};

export type OxlintDiagnostic = {
  message?: string;
  code?: string;
  severity?: string;
  filename?: string;
};

export type OxlintReport = {
  diagnostics: OxlintDiagnostic[];
};

export type ProofExpectation = {
  rule: string;
  file?: string;
  minCount?: number;
};

export type GitState = {
  kind: "clean" | "dirty" | "error";
  detail: string;
};

export type OxlintProof = {
  ok: boolean;
  reasons: string[];
  pluginRules: string[];
  hostFaults: OxlintDiagnostic[];
  unexpectedErrors: OxlintDiagnostic[];
};

export function runHostProcess(options: {
  bin: string;
  args: string[];
  cwd: string;
  timeoutMs?: number;
  maxBuffer?: number;
}): HostResult;

export function parseOxlintStdout(stdout: string): {
  report: OxlintReport | null;
  parseError: string | null;
};

export const HOST_FAULT_CODES: ReadonlySet<string>;
export function unwrapServicenowRuleId(code: string | undefined): string | undefined;
export function isHostFaultCode(code: string | undefined): boolean;
export function isErrorSeverity(diagnostic: OxlintDiagnostic): boolean;
export function pluginRuleIds(
  report: OxlintReport | null | undefined,
  filenamePart?: string,
): string[];
export function interpretGitStatus(result: {
  status: number | null;
  stdout?: string;
  stderr?: string;
  error?: HostError | null;
  signal?: NodeJS.Signals | null;
}): GitState;
export function classifyOxlintProof(input: {
  tree: string;
  status: number | null;
  report: OxlintReport | null;
  parseError: string | null;
  host?: HostResult;
  expectations?: ProofExpectation[];
}): OxlintProof;
export function classifyOxfmtProof(host: HostResult): { ok: boolean; reasons: string[] };
