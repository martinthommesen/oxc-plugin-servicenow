import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { pluginRuleId, pluginRulesFor, repoRoot, runOxlint } from "./helpers.js";

const configPath = path.join(repoRoot, "tests/integration/fixtures/.oxlintrc.json");
const fixturesDir = path.join(repoRoot, "tests/integration/fixtures");

describe("oxlint host integration", () => {
  it("reports the expected rules on the bad Business Rule fixture", () => {
    const report = runOxlint(configPath, [fixturesDir]);
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
    const report = runOxlint(configPath, [fixturesDir]);
    const rules = pluginRulesFor(report, "bad-fluent.now.ts");
    assert.ok(
      rules.includes("servicenow/fluent-proper-imports"),
      `missing import diagnostic (got ${rules.join(", ") || "(none)"})`,
    );
    assert.equal(
      rules.includes("servicenow/require-fluent-id"),
      false,
      "wrong-module imports must not cascade semantic diagnostics",
    );
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
      const report = runOxlint(configPath, [path.join(repoRoot, "examples", file)]);
      const plugin = report.diagnostics.filter((diagnostic) => pluginRuleId(diagnostic.code));
      assert.deepEqual(plugin, [], `${file}: ${JSON.stringify(plugin)}`);
    }
  });
});
