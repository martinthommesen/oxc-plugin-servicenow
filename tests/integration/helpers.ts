import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

export interface TemporaryProject {
  readonly directory: string;
  readonly source: string;
  readonly config: string;
  cleanup(): void;
}

export function createTemporaryProject(options: {
  readonly prefix: string;
  readonly filename: string;
  readonly code: string;
  readonly settings?: unknown;
  readonly rules: Record<string, unknown>;
}): TemporaryProject {
  const directory = mkdtempSync(path.join(tmpdir(), options.prefix));
  const source = path.join(directory, options.filename);
  const config = path.join(directory, ".oxlintrc.json");
  writeFileSync(source, options.code);
  writeFileSync(
    config,
    JSON.stringify({
      jsPlugins: [{ name: "servicenow", specifier: path.join(repoRoot, "dist/index.js") }],
      settings: { servicenow: options.settings ?? {} },
      rules: options.rules,
    }),
  );
  return {
    directory,
    source,
    config,
    cleanup() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export function eslintFlatConfig(options: {
  readonly plugin: import("eslint").ESLint.Plugin;
  readonly files: readonly string[];
  readonly rule: string;
  readonly settings?: unknown;
}): import("eslint").Linter.Config[] {
  return [
    {
      files: [...options.files],
      plugins: { servicenow: options.plugin },
      settings: { servicenow: options.settings ?? {} },
      rules: { [options.rule]: "error" },
    },
  ];
}

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
