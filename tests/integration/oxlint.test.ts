import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const oxlintBin = path.join(repoRoot, "node_modules", ".bin", "oxlint");
const configPath = path.join(repoRoot, "tests/integration/fixtures/.oxlintrc.json");
const fixturesDir = path.join(repoRoot, "tests/integration/fixtures");

type OxlintDiagnostic = {
  code: string;
  filename: string;
};

type OxlintReport = {
  diagnostics: OxlintDiagnostic[];
};

function runOxlint(targets: string[]): OxlintReport {
  try {
    const stdout = execFileSync(oxlintBin, ["--format", "json", "-c", configPath, ...targets], {
      encoding: "utf8",
      cwd: repoRoot,
    });
    return JSON.parse(stdout) as OxlintReport;
  } catch (error) {
    const failed = error as { stdout?: string };
    if (typeof failed.stdout === "string" && failed.stdout.length > 0) {
      return JSON.parse(failed.stdout) as OxlintReport;
    }
    throw error;
  }
}

function pluginRuleId(code: string): string | undefined {
  const wrapped = /^servicenow\((.+)\)$/.exec(code);
  if (wrapped) return `servicenow/${wrapped[1]}`;
  if (code.startsWith("servicenow/")) return code;
  return undefined;
}

function pluginRulesFor(report: OxlintReport, filenamePart: string): string[] {
  return report.diagnostics
    .filter((diagnostic) => diagnostic.filename.includes(filenamePart))
    .map((diagnostic) => pluginRuleId(diagnostic.code))
    .filter((id): id is string => id !== undefined);
}

describe("oxlint host integration", () => {
  it("reports the expected rules on the bad Business Rule fixture", () => {
    const report = runOxlint([fixturesDir]);
    const rules = pluginRulesFor(report, "bad-business-rule.br.js");
    for (const id of [
      "servicenow/no-hardcoded-sysid",
      "servicenow/no-gs-now",
      "servicenow/no-br-current-update",
    ]) {
      assert.ok(rules.includes(id), `missing ${id} (got ${rules.join(", ") || "(none)"})`);
    }
  });

  it("reports the expected rules on the bad Fluent fixture", () => {
    const report = runOxlint([fixturesDir]);
    const rules = pluginRulesFor(report, "bad-fluent.now.ts");
    for (const id of ["servicenow/fluent-proper-imports", "servicenow/require-fluent-id"]) {
      assert.ok(rules.includes(id), `missing ${id} (got ${rules.join(", ") || "(none)"})`);
    }
  });

  it("reports no plugin diagnostics on the clean examples", () => {
    const classic = runOxlint([path.join(repoRoot, "examples/classic-business-rule.js")]);
    const fluent = runOxlint([path.join(repoRoot, "examples/incident-table.now.ts")]);
    const classicPlugin = classic.diagnostics.filter((d) => pluginRuleId(d.code));
    const fluentPlugin = fluent.diagnostics.filter((d) => pluginRuleId(d.code));
    assert.deepEqual(classicPlugin, []);
    assert.deepEqual(fluentPlugin, []);
  });
});
