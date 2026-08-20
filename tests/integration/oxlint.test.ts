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
    const failed = error as { stdout?: string; stderr?: string };
    const stdout = failed.stdout ?? "";
    if (stdout.trimStart().startsWith("{")) {
      return JSON.parse(stdout) as OxlintReport;
    }
    throw new Error([failed.stderr, stdout, String(error)].filter(Boolean).join("\n"));
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
    assert.ok(rules.includes("servicenow/fluent-proper-imports"), `missing import diagnostic (got ${rules.join(", ") || "(none)"})`);
    assert.equal(rules.includes("servicenow/require-fluent-id"), false, "wrong-module imports must not cascade semantic diagnostics");
  });

  it("reports no plugin diagnostics on the clean examples", () => {
    const files = [
      "classic-business-rule.js",
      "full-script-business-rule.js",
      "catalog-client.js",
      "es2021-server.js",
      "incident-table.now.ts",
    ];
    for (const file of files) {
      const report = runOxlint([path.join(repoRoot, "examples", file)]);
      const plugin = report.diagnostics.filter((diagnostic) => pluginRuleId(diagnostic.code));
      assert.deepEqual(plugin, [], `${file}: ${JSON.stringify(plugin)}`);
    }
  });
});
