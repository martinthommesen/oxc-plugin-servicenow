import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
export const oxlintBin = path.join(repoRoot, "node_modules", ".bin", "oxlint");

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

export function runOxlint(configPath: string, targets: string[]): OxlintReport {
  try {
    const stdout = execFileSync(oxlintBin, ["--format", "json", "-c", configPath, ...targets], {
      encoding: "utf8",
      cwd: repoRoot,
    });
    return JSON.parse(stdout) as OxlintReport;
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string; message?: string };
    const stdout = failed.stdout ?? "";
    if (stdout.trimStart().startsWith("{")) {
      return JSON.parse(stdout) as OxlintReport;
    }
    throw new Error(
      [failed.stderr, stdout, failed.message].filter(Boolean).join("\n") || "oxlint failed",
    );
  }
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
