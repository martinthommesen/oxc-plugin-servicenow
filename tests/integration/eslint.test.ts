import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it } from "node:test";
import { Linter } from "eslint";
import plugin, { configs } from "../../src/index.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const badBusinessRule = readFileSync(
  path.join(repoRoot, "tests/integration/fixtures/bad-business-rule.br.js"),
  "utf8",
);
const badFluent = readFileSync(
  path.join(repoRoot, "tests/integration/fixtures/bad-fluent.now.ts"),
  "utf8",
);
const cleanBusinessRule = readFileSync(
  path.join(repoRoot, "examples/classic-business-rule.js"),
  "utf8",
);
const cleanFluent = readFileSync(path.join(repoRoot, "examples/incident-table.now.ts"), "utf8");

function verify(code: string, filename: string) {
  const linter = new Linter({ configType: "flat" });
  // ESLint 10's default files glob is **/*.{js,mjs,cjs}. Fluent fixtures are
  // .now.ts; a files entry is required so recommended applies to them.
  return linter.verify(
    code,
    [
      { files: ["**/*.js", "**/*.ts"] },
      configs.flat.recommended as unknown as import("eslint").Linter.Config,
    ],
    { filename },
  );
}

function ruleIds(messages: Array<{ ruleId: string | null }>): string[] {
  return messages.map((message) => message.ruleId).filter((id): id is string => id !== null);
}

describe("eslint host integration", () => {
  it("loads 24 rules each with a create shim", () => {
    const names = Object.keys(plugin.rules);
    assert.equal(names.length, 24);
    for (const name of names) {
      const rule = plugin.rules[name as keyof typeof plugin.rules] as { create?: unknown };
      assert.equal(typeof rule.create, "function", `${name} should have a create shim`);
    }
  });

  it("reports the expected rules on the bad Business Rule fixture", () => {
    const messages = verify(badBusinessRule, "bad-business-rule.br.js");
    const ids = ruleIds(messages);
    for (const id of [
      "servicenow/no-hardcoded-sysid",
      "servicenow/no-gs-now",
      "servicenow/no-br-current-update",
    ]) {
      assert.ok(ids.includes(id), `missing ${id} (got ${ids.join(", ") || "(none)"})`);
    }
  });

  it("reports the expected rules on the bad Fluent fixture", () => {
    const messages = verify(badFluent, "bad-fluent.now.ts");
    const ids = ruleIds(messages);
    for (const id of ["servicenow/fluent-proper-imports", "servicenow/require-fluent-id"]) {
      assert.ok(ids.includes(id), `missing ${id} (got ${ids.join(", ") || "(none)"})`);
    }
  });

  it("reports no diagnostics on the clean examples", () => {
    assert.deepEqual(verify(cleanBusinessRule, "classic-business-rule.js"), []);
    assert.deepEqual(verify(cleanFluent, "incident-table.now.ts"), []);
  });
});
