import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { repoRoot, TSX_CLI_EXECUTION_PATTERN } from "./helpers.js";

describe("tooling execution", () => {
  it("recognizes package-selected tsx CLI invocations", () => {
    for (const command of [
      "tsx script.ts",
      "npx --no-install tsx script.ts",
      "npm exec -- tsx script.ts",
      "npm exec --package=tsx -- tsx script.ts",
      "run: npm exec --yes -- tsx script.ts",
    ]) {
      assert.match(command, TSX_CLI_EXECUTION_PATTERN, command);
    }
    assert.doesNotMatch(
      "node --import ./scripts/register-tsx.mjs script.ts",
      TSX_CLI_EXECUTION_PATTERN,
    );
  });

  it("runs TypeScript tests and the JSON reporter without the tsx CLI", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "sn-test-runner-"));
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    try {
      const result = spawnSync(
        process.execPath,
        [
          path.join(repoRoot, "scripts/run-tests.mjs"),
          "tests/utils/ast.test.ts",
          "--report-json",
          "results.json",
        ],
        { cwd: directory, encoding: "utf8", env },
      );
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(readFileSync(path.join(directory, "results.json"), "utf8")) as {
        schemaVersion: number;
        tests: Array<{ file: string; status: string }>;
      };
      assert.equal(report.schemaVersion, 1);
      assert.ok(report.tests.length > 0);
      assert.ok(report.tests.every((test) => test.file === "tests/utils/ast.test.ts"));
      assert.ok(report.tests.every((test) => test.status === "passed"));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps package tools off the tsx CLI execution path", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const commands = Object.values(pkg.scripts).join("\n");
    assert.doesNotMatch(commands, TSX_CLI_EXECUTION_PATTERN);
    assert.equal(pkg.scripts.compat, "node scripts/compat-consumer.mjs");
    assert.equal(pkg.scripts["acceptance:check"], "node scripts/verify-acceptance-ledger.mjs");
    assert.match(
      pkg.scripts["evidence:check"] ?? "",
      /^node --import \.\/scripts\/register-tsx\.mjs /,
    );
  });
});
