import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { Linter } from "eslint";
import { configs } from "../../src/index.js";
import { pluginRulesFor, repoRoot, runOxlint } from "./helpers.js";

const profilesDir = path.join(repoRoot, "tests/integration/profiles");
const validDir = path.join(profilesDir, "valid");
const invalidDir = path.join(profilesDir, "invalid");
const recommendedConfig = path.join(profilesDir, "configs/recommended.oxlintrc.json");
const classicEs5Config = path.join(profilesDir, "configs/classic-es5.oxlintrc.json");
const es2021Config = path.join(profilesDir, "configs/es2021.oxlintrc.json");
const mixedDir = path.join(profilesDir, "mixed");

function validFiles(): string[] {
  return readdirSync(validDir)
    .filter((name) => name.endsWith(".js") || name.endsWith(".now.ts"))
    .map((name) => path.join(validDir, name));
}

function eslintRecommended(code: string, filename: string) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(
    code,
    [configs.flat.recommended as unknown as import("eslint").Linter.Config],
    { filename },
  );
}

describe("profile fixtures", () => {
  it("recommended oxlint is silent on every valid profile fixture", () => {
    const report = runOxlint(recommendedConfig, [validDir]);
    assert.deepEqual(pluginRulesFor(report), [], JSON.stringify(report.diagnostics, null, 2));
  });

  it("recommended ESLint is silent on every valid profile fixture", () => {
    for (const file of validFiles()) {
      const code = readFileSync(file, "utf8");
      const messages = eslintRecommended(code, path.basename(file)).filter((message) =>
        message.ruleId?.startsWith("servicenow/"),
      );
      assert.deepEqual(messages, [], `${path.basename(file)}: ${JSON.stringify(messages)}`);
    }
  });

  it("classic-es5 rejects Promise in an ES2021 fixture and recommended does not", () => {
    const file = path.join(validDir, "es2021.server.js");
    const recommended = pluginRulesFor(runOxlint(recommendedConfig, [file]));
    const es5 = pluginRulesFor(runOxlint(classicEs5Config, [file]));
    assert.deepEqual(recommended, []);
    assert.ok(es5.includes("servicenow/no-promise"), `classic-es5 diagnostics: ${es5.join(", ")}`);
    assert.ok(es5.includes("servicenow/no-async-await"), `classic-es5 diagnostics: ${es5.join(", ")}`);
    assert.ok(
      es5.includes("servicenow/no-unsupported-syntax"),
      `classic-es5 diagnostics: ${es5.join(", ")}`,
    );
  });

  it("es2021 accepts supported syntax and still flags async iteration", () => {
    const valid = pluginRulesFor(runOxlint(es2021Config, [path.join(validDir, "es2021.server.js")]));
    const invalid = pluginRulesFor(
      runOxlint(es2021Config, [path.join(invalidDir, "es2021-async-iter.server.js")]),
    );
    assert.deepEqual(valid, []);
    assert.ok(invalid.includes("servicenow/no-async-iterators"));
  });

  it("classic-es5 flags Promise on the dedicated invalid fixture", () => {
    const rules = pluginRulesFor(
      runOxlint(classicEs5Config, [path.join(invalidDir, "es5-promise.server.js")]),
    );
    assert.ok(rules.includes("servicenow/no-promise"));
  });

  it("recommended flags GlideRecord in a client fixture", () => {
    const rules = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "client-gliderecord.client.js")]),
    );
    assert.ok(rules.includes("servicenow/no-client-gliderecord"));
  });

  it("client rules do not leak onto a server UI Action", () => {
    const rules = pluginRulesFor(runOxlint(recommendedConfig, [path.join(validDir, "close.ui-action.js")]));
    assert.ok(!rules.includes("servicenow/no-client-gliderecord"));
    assert.ok(!rules.includes("servicenow/no-br-current-update"));
  });

  it("mixed-repository recommended oxlint is silent", () => {
    const report = runOxlint(path.join(mixedDir, ".oxlintrc.json"), [mixedDir]);
    assert.deepEqual(pluginRulesFor(report), [], JSON.stringify(report.diagnostics, null, 2));
  });
});
