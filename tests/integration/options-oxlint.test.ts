import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { ruleCatalog } from "../../src/catalog.js";
import { oxlintBin, repoRoot } from "./helpers.js";

const pluginPath = path.join(repoRoot, "dist/index.js");

function run(options: {
  rule: string;
  values: readonly unknown[];
  code?: string;
  filename?: string;
}) {
  const directory = mkdtempSync(path.join(tmpdir(), "sn-oxlint-options-"));
  const config = path.join(directory, ".oxlintrc.json");
  const source = path.join(directory, options.filename ?? "sample.server.js");
  writeFileSync(
    config,
    JSON.stringify({
      jsPlugins: [{ name: "servicenow", specifier: pluginPath }],
      rules: { [`servicenow/${options.rule}`]: ["error", ...options.values] },
    }),
  );
  writeFileSync(source, options.code ?? 'var value = "97c04b3b1b12100043ab85e5bd0713e2";\n');
  try {
    return spawnSync(oxlintBin, ["--format", "json", "-c", config, source], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function stableError(result: ReturnType<typeof run>): string {
  const ansiColor = new RegExp(`${String.fromCodePoint(27)}\\[[0-9;]*m`, "g");
  const output = `${result.stdout}${result.stderr}`.replace(ansiColor, "");
  return output
    .split("\n")
    .filter((line) => !/^\s+at /.test(line))
    .join("\n")
    .trim();
}

const invalidCases = [
  {
    name: "boolean string",
    rule: "no-hardcoded-sysid",
    values: [{ ignoreHashNames: "false" }],
    error: '\tValue "false" should be boolean.',
  },
  {
    name: "numeric string",
    rule: "prefer-now-include",
    values: [{ maxLines: "8" }],
    error: '\tValue "8" should be integer.',
  },
  {
    name: "below-minimum integer",
    rule: "prefer-now-include",
    values: [{ maxLines: 0 }],
    error: "\tValue 0 should be >= 1.",
  },
  {
    name: "invalid enum",
    rule: "fluent-naming-convention",
    values: [{ idStyle: "PascalCase" }],
    error: '\tValue "PascalCase" should be equal to one of the allowed values.',
  },
  {
    name: "non-array",
    rule: "no-hardcoded-table-names",
    values: [{ allowedTables: 42 }],
    error: "\tValue 42 should be array.",
  },
  {
    name: "invalid array item",
    rule: "no-hardcoded-sysid",
    values: [{ allowedSysIds: [2] }],
    error: "\tValue 2 should be string.",
  },
  {
    name: "unknown property",
    rule: "require-fluent-id",
    values: [{ extra: true }],
    error:
      '\tValue {"extra":true} should NOT have additional properties.\n\t\tUnexpected property "extra". Expected properties: "preferNowId".',
  },
  {
    name: "extra positional option",
    rule: "require-fluent-id",
    values: [{ preferNowId: false }, true],
    error: '\tValue [{"preferNowId":false},true] should NOT have more than 1 items.',
  },
] as const;

describe("Oxlint rule option contracts", () => {
  for (const testCase of invalidCases) {
    it(`rejects ${testCase.name} without partial lint output`, () => {
      assert.ok(
        ruleCatalog.some((entry) => entry.name === testCase.rule && entry.optionDescriptor),
      );
      const result = run(testCase);
      assert.notEqual(result.status, 0);
      assert.equal(result.signal, null);
      assert.equal(result.stdout.trimStart().startsWith("{"), false);
      const error = stableError(result);
      assert.ok(
        error.startsWith("Failed to setup JS plugin options:\nError: Options validation failed"),
      );
      assert.ok(error.includes(`rule 'servicenow/${testCase.rule}'`));
      assert.ok(error.includes(JSON.stringify(testCase.values, null, 2)));
      assert.ok(error.includes(testCase.error), error);
      assert.doesNotMatch(error, /hardcoded sys_id|diagnostics/);
    });
  }

  for (const testCase of [
    {
      rule: "no-hardcoded-sysid",
      values: [{ allowedSysIds: ["97c04b3b1b12100043ab85e5bd0713e2"] }],
      code: 'gs.info("97c04b3b1b12100043ab85e5bd0713e2");\n',
    },
    {
      rule: "no-hardcoded-table-names",
      values: [{ allowedTables: ["incident"] }],
      code: 'new GlideRecord("incident");\n',
    },
    {
      rule: "require-fluent-id",
      values: [{ preferNowId: false }],
      filename: "sample.now.ts",
      code: 'import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: "raw-id", table: "incident", name: "Test" });\n',
    },
    {
      rule: "prefer-now-include",
      values: [{ maxLines: 20, maxChars: 1000 }],
      filename: "sample.now.ts",
      code: 'import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["test"], table: "incident", name: "Test" });\n',
    },
    {
      rule: "fluent-naming-convention",
      values: [{ idStyle: "either", fileStyle: "either" }],
      filename: "sample-name.now.ts",
      code: 'import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["test_name"], table: "incident", name: "Test" });\n',
    },
  ]) {
    it(`accepts a valid ${testCase.rule} boundary`, () => {
      const result = run(testCase);
      assert.equal(result.status, 0, stableError(result));
      assert.equal(result.signal, null);
      const report = JSON.parse(result.stdout) as { diagnostics: unknown[] };
      assert.deepEqual(report.diagnostics, []);
      assert.equal(result.stderr, "");
    });
  }
});
