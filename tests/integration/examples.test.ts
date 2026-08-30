import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { classicEs5Rules } from "../../src/configs/maps.js";
import { exampleProjectNames, pluginRulesFor, repoRoot, runOxlint } from "./helpers.js";

const examplesDir = path.join(repoRoot, "examples");

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

function withLocalConfig<T>(
  project: string,
  run: (configPath: string) => T,
  settings?: unknown,
): T {
  const directory = path.join(examplesDir, project);
  const config = JSON.parse(readFileSync(path.join(directory, ".oxlintrc.json"), "utf8")) as {
    jsPlugins: Array<{ name: string; specifier: string }>;
    settings?: unknown;
  };
  const plugin = config.jsPlugins[0];
  assert.ok(plugin);
  plugin.specifier = path.join(repoRoot, "dist/index.js");
  if (settings !== undefined) config.settings = settings;
  const configDirectory = mkdtempSync(path.join(tmpdir(), "sn-oxc-example-config-"));
  const configPath = path.join(configDirectory, ".oxlintrc.json");
  try {
    writeFileSync(configPath, JSON.stringify(config));
    return run(configPath);
  } finally {
    rmSync(configDirectory, { recursive: true, force: true });
  }
}

describe("example projects", () => {
  it("keeps generated configs outside the checkout", () => {
    const configPath = withLocalConfig("classic-compatibility", (value) => value);
    const relativeConfigPath = path.relative(repoRoot, configPath);
    assert.ok(
      relativeConfigPath === ".." ||
        relativeConfigPath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeConfigPath),
      configPath,
    );
    assert.throws(() => readFileSync(configPath), { code: "ENOENT" });
  });

  it("recommended oxlint is silent on every example valid tree", () => {
    for (const project of exampleProjectNames) {
      const valid = path.join(examplesDir, project, "valid");
      const report = withLocalConfig(project, (config) => runOxlint(config, collectSources(valid)));
      assert.deepEqual(
        pluginRulesFor(report),
        [],
        `${project}: ${JSON.stringify(report.diagnostics, null, 2)}`,
      );
    }
  });

  it("example invalid trees produce plugin diagnostics", () => {
    for (const project of exampleProjectNames) {
      const invalid = path.join(examplesDir, project, "invalid");
      const files = collectSources(invalid);
      if (files.length === 0) continue;
      const report = withLocalConfig(project, (config) => runOxlint(config, files));
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
    const json = block?.[1];
    assert.ok(json, "UI Action README JSON block must not be empty");
    const documented = JSON.parse(json) as { servicenow?: { surfaces?: string } };
    assert.equal(documented.servicenow?.surfaces, "auto");
    withLocalConfig(
      "ui-action",
      (configPath) => {
        const report = runOxlint(configPath, [
          path.join(examplesDir, "ui-action/invalid/client-query.client.ui-action.js"),
        ]);
        assert.ok(pluginRulesFor(report).includes("servicenow/no-client-gliderecord"));
      },
      documented,
    );
  });

  it("classic mode examples fail for the intended engine rule, not a sys_id crutch", () => {
    const compatibility = withLocalConfig("classic-compatibility", (config) =>
      pluginRulesFor(
        runOxlint(config, [
          path.join(examplesDir, "classic-compatibility/invalid/promise.server.js"),
        ]),
      ),
    );
    assert.ok(compatibility.includes("servicenow/no-promise"), compatibility.join(", "));
    assert.ok(!compatibility.includes("servicenow/no-hardcoded-sysid"), compatibility.join(", "));

    const es5 = withLocalConfig("classic-es5", (config) =>
      pluginRulesFor(
        runOxlint(config, [path.join(examplesDir, "classic-es5/invalid/optional.server.js")]),
      ),
    );
    assert.ok(es5.includes("servicenow/no-unsupported-syntax"), es5.join(", "));
    assert.ok(!es5.includes("servicenow/no-hardcoded-sysid"), es5.join(", "));
  });
});
