import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it } from "node:test";
import { Linter } from "eslint";
import plugin, { configs, ruleCatalog } from "../../src/index.js";

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
  return linter.verify(
    code,
    [configs.flat.recommended as unknown as import("eslint").Linter.Config],
    { filename },
  );
}

function ruleIds(messages: Array<{ ruleId: string | null }>): string[] {
  return messages.map((message) => message.ruleId).filter((id): id is string => id !== null);
}

describe("eslint host integration", () => {
  it("loads every catalogued rule with a create shim", () => {
    const names = Object.keys(plugin.rules);
    assert.equal(names.length, ruleCatalog.length);
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

  it("does not apply the preset to ordinary TypeScript", () => {
    const messages = verify(badFluent, "app.ts");
    assert.equal(
      messages.some((message) => message.ruleId?.startsWith("servicenow/")),
      false,
    );
  });

  it("fatal-parses typed Fluent without a TypeScript parser", () => {
    const messages = verify('const x: string = "a";\n', "table.now.ts");
    assert.ok(
      messages.some(
        (message) => message.fatal === true && /Unexpected token :/.test(message.message),
      ),
    );
  });
});
