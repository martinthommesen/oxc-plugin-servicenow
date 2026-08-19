import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
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
});
