import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
export const oxlintBin = path.join(repoRoot, "node_modules", ".bin", "oxlint");
export const TSX_CLI_EXECUTION_PATTERN =
  /(?:^|[\n|&;]\s*|\brun:\s*)(?:(?:npx(?:\s+--no-install)?|npm exec(?:\s+--[A-Za-z][\w-]*(?:=[^\s]+)?)*\s+(?:--\s+)?)\s*)?tsx(?:\s|$)/m;

export type OxlintDiagnostic = {
  message: string;
  code: string;
  severity?: string;
  filename: string;
  labels?: Array<{
    span: { offset: number; length: number; line: number; column: number };
  }>;
};

export type OxlintReport = {
  diagnostics: OxlintDiagnostic[];
};

export type OxlintProcessResult = {
  status: 0 | 1;
  signal: null;
  stdout: string;
  stderr: string;
  report: OxlintReport;
};

export function runOxlintProcess(configPath: string, targets: string[]): OxlintProcessResult {
  const result = spawnSync(oxlintBin, ["--format", "json", "-c", configPath, ...targets], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`oxlint terminated by ${result.signal}`);
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`oxlint exited ${result.status}: ${result.stderr || result.stdout}`);
  }
  let report: OxlintReport;
  try {
    report = JSON.parse(result.stdout) as OxlintReport;
  } catch {
    throw new Error(
      `oxlint emitted malformed or truncated JSON:\n${result.stdout}\n${result.stderr}`,
    );
  }
  if (!report || !Array.isArray(report.diagnostics)) {
    throw new Error("oxlint JSON has no diagnostics array");
  }
  const hostFailure = report.diagnostics.find((diagnostic) =>
    /parse|parser|configuration|plugin-load/i.test(diagnostic.code),
  );
  if (hostFailure)
    throw new Error(`oxlint host diagnostic: ${hostFailure.code}: ${hostFailure.message}`);
  if (result.status === 1 && report.diagnostics.length === 0) {
    throw new Error("oxlint exited 1 without diagnostics");
  }
  return {
    status: result.status,
    signal: null,
    stdout: result.stdout,
    stderr: result.stderr,
    report,
  };
}

export function runOxlint(configPath: string, targets: string[]): OxlintReport {
  return runOxlintProcess(configPath, targets).report;
}

export function pluginRuleId(code: string): string | undefined {
  const wrapped = /^servicenow\((.+)\)$/.exec(code);
  if (wrapped) return `servicenow/${wrapped[1]}`;
  if (code.startsWith("servicenow/")) return code;
  return undefined;
}

export function pluginRulesFor(report: OxlintReport, filenamePart?: string): string[] {
  return report.diagnostics
    .filter((diagnostic) => (filenamePart ? diagnostic.filename.includes(filenamePart) : true))
    .map((diagnostic) => pluginRuleId(diagnostic.code))
    .filter((id): id is string => id !== undefined);
}
