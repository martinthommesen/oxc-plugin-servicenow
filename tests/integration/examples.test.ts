import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { classicEs5Rules } from "../../src/configs/maps.js";
import { pluginRulesFor, repoRoot, runOxlint } from "./helpers.js";

const examplesDir = path.join(repoRoot, "examples");
const PROJECTS = [
  "classic-compatibility",
  "classic-es5",
  "es2021",
  "client",
  "business-rule",
  "ui-action",
  "fluent",
  "mixed",
];

function collectSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectSources(full));
      continue;
    }
    if (name.endsWith(".js") || name.endsWith(".now.ts")) out.push(full);
  }
  return out;
}

describe("example projects", () => {
  it("recommended oxlint is silent on every example valid tree", () => {
    for (const project of PROJECTS) {
      const config = path.join(examplesDir, project, ".oxlintrc.json");
      const valid = path.join(examplesDir, project, "valid");
      const report = runOxlint(config, collectSources(valid));
      assert.deepEqual(
        pluginRulesFor(report),
        [],
        `${project}: ${JSON.stringify(report.diagnostics, null, 2)}`,
      );
    }
  });

  it("example invalid trees produce plugin diagnostics", () => {
    for (const project of PROJECTS) {
      const config = path.join(examplesDir, project, ".oxlintrc.json");
      const invalid = path.join(examplesDir, project, "invalid");
      const files = collectSources(invalid);
      if (files.length === 0) continue;
      const report = runOxlint(config, files);
      assert.ok(
        pluginRulesFor(report).length > 0,
        `${project} invalid produced no plugin diagnostics`,
      );
    }
  });

  it("generates mode-specific classic example maps rather than recommended-only maps", () => {
    const compatibility = JSON.parse(
      readFileSync(path.join(examplesDir, "classic-compatibility/.oxlintrc.json"), "utf8"),
    ) as { rules: Record<string, string> };
    const es5 = JSON.parse(
      readFileSync(path.join(examplesDir, "classic-es5/.oxlintrc.json"), "utf8"),
    ) as { rules: Record<string, string> };
    assert.deepEqual(compatibility.rules, classicEs5Rules);
    assert.deepEqual(es5.rules, classicEs5Rules);
  });

  it("executes the exact UI Action settings copied from its README", () => {
    const readme = readFileSync(path.join(examplesDir, "ui-action/README.md"), "utf8");
    const block = readme.match(/```json\n([\s\S]*?)\n```/);
    assert.ok(block, "UI Action README must contain a JSON settings block");
    const documented = JSON.parse(block[1]) as { servicenow?: { surfaces?: string } };
    assert.equal(documented.servicenow?.surfaces, "auto");
    const configPath = path.join(examplesDir, "ui-action/.readme-test.oxlintrc.json");
    const base = JSON.parse(readFileSync(path.join(examplesDir, "ui-action/.oxlintrc.json"), "utf8")) as Record<string, unknown>;
    base.settings = documented;
    writeFileSync(configPath, JSON.stringify(base));
    try {
      const report = runOxlint(configPath, [path.join(examplesDir, "ui-action/invalid/client-query.client.ui-action.js")]);
      assert.ok(pluginRulesFor(report).includes("servicenow/no-client-gliderecord"));
    } finally {
      unlinkSync(configPath);
    }
  });

  it("classic mode examples fail for the intended engine rule, not a sys_id crutch", () => {
    const compatibility = pluginRulesFor(
      runOxlint(
        path.join(examplesDir, "classic-compatibility/.oxlintrc.json"),
        [path.join(examplesDir, "classic-compatibility/invalid/promise.server.js")],
      ),
    );
    assert.ok(compatibility.includes("servicenow/no-promise"), compatibility.join(", "));
    assert.ok(!compatibility.includes("servicenow/no-hardcoded-sysid"), compatibility.join(", "));

    const es5 = pluginRulesFor(
      runOxlint(
        path.join(examplesDir, "classic-es5/.oxlintrc.json"),
        [path.join(examplesDir, "classic-es5/invalid/optional.server.js")],
      ),
    );
    assert.ok(es5.includes("servicenow/no-unsupported-syntax"), es5.join(", "));
    assert.ok(!es5.includes("servicenow/no-hardcoded-sysid"), es5.join(", "));
  });
});
