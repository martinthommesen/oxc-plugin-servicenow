import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isHostFaultDiagnostic,
  parseOxlintStdout,
  pluginRuleIdOccurrences,
  runHostProcess,
  unwrapServicenowRuleId,
} from "../../scripts/lib/host-verifier.mjs";

export const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
export const oxlintBin = path.join(repoRoot, "node_modules", ".bin", "oxlint");

export const exampleProjectNames = Object.keys(
  (
    JSON.parse(readFileSync(path.join(repoRoot, "scripts/verify-projects.json"), "utf8")) as {
      projects: Record<string, unknown>;
    }
  ).projects,
);
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
  const result = runHostProcess({
    bin: oxlintBin,
    args: ["--format", "json", "-c", configPath, ...targets],
    cwd: repoRoot,
  });
  if (result.timedOut) throw new Error(`oxlint timed out: ${result.error?.message ?? "ETIMEDOUT"}`);
  if (result.error) throw new Error(result.error.message);
  if (result.signal) throw new Error(`oxlint terminated by ${result.signal}`);
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`oxlint exited ${result.status}: ${result.stderr || result.stdout}`);
  }
  const { report, parseError } = parseOxlintStdout(result.stdout);
  if (parseError || !report) {
    throw new Error(
      `oxlint emitted malformed or truncated JSON:\n${result.stdout}\n${result.stderr}`,
    );
  }
  const hostFailure = report.diagnostics.find((diagnostic) => isHostFaultDiagnostic(diagnostic));
  if (hostFailure) {
    throw new Error(`oxlint host diagnostic: ${hostFailure.code}: ${hostFailure.message}`);
  }
  if (result.status === 1 && report.diagnostics.length === 0) {
    throw new Error("oxlint exited 1 without diagnostics");
  }
  return {
    status: result.status === 0 ? 0 : 1,
    signal: null,
    stdout: result.stdout,
    stderr: result.stderr,
    report: report as OxlintReport,
  };
}

export function runOxlint(configPath: string, targets: string[]): OxlintReport {
  return runOxlintProcess(configPath, targets).report;
}

export function pluginRuleId(code: string): string | undefined {
  return unwrapServicenowRuleId(code);
}

export function pluginRulesFor(report: OxlintReport, filenamePart?: string): string[] {
  return pluginRuleIdOccurrences(report, filenamePart);
}
