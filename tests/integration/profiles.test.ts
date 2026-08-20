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
const strictConfig = path.join(profilesDir, "configs/strict.oxlintrc.json");
const classicEs5Config = path.join(profilesDir, "configs/classic-es5.oxlintrc.json");
const es2021Config = path.join(profilesDir, "configs/es2021.oxlintrc.json");
const fullScriptConfig = path.join(profilesDir, "configs/recommended-full-script.oxlintrc.json");
const securityConfig = path.join(profilesDir, "configs/security.oxlintrc.json");
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

  it("recommended flags Phase 2 server and client rules", () => {
    const windowed = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "windowed-delete.br.js")]),
    );
    const getRef = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "sync-getreference.client.js")]),
    );
    const sysparm = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "glideajax-sysparm.client.js")]),
    );
    const aggregate = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "glideaggregate.br.js")]),
    );
    const getAnswer = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "glideajax-getanswer.client.js")]),
    );
    assert.ok(
      windowed.includes("servicenow/no-delete-multiple-with-windowing"),
      `windowed-delete: ${windowed.join(", ") || "(none)"}`,
    );
    assert.ok(
      getRef.includes("servicenow/require-callback-for-getreference"),
      `sync-getreference: ${getRef.join(", ") || "(none)"}`,
    );
    assert.ok(
      sysparm.includes("servicenow/require-glideajax-sysparm-name"),
      `glideajax-sysparm: ${sysparm.join(", ") || "(none)"}`,
    );
    assert.ok(
      aggregate.includes("servicenow/validate-glideaggregate-calls"),
      `glideaggregate: ${aggregate.join(", ") || "(none)"}`,
    );
    assert.ok(
      getAnswer.includes("servicenow/no-glideajax-getanswer"),
      `glideajax-getanswer: ${getAnswer.join(", ") || "(none)"}`,
    );
    const missingQuery = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "missing-query.br.js")]),
    );
    assert.ok(
      missingQuery.includes("servicenow/require-query-before-next"),
      `missing-query: ${missingQuery.join(", ") || "(none)"}`,
    );
  });

  it("recommended ESLint flags Phase 2 rules", () => {
    const cases: Array<[string, string]> = [
      ["windowed-delete.br.js", "servicenow/no-delete-multiple-with-windowing"],
      ["sync-getreference.client.js", "servicenow/require-callback-for-getreference"],
      ["glideajax-sysparm.client.js", "servicenow/require-glideajax-sysparm-name"],
      ["glideaggregate.br.js", "servicenow/validate-glideaggregate-calls"],
      ["glideajax-getanswer.client.js", "servicenow/no-glideajax-getanswer"],
      ["now-id-ref.now.ts", "servicenow/no-now-id-as-reference"],
      ["duplicate-id.now.ts", "servicenow/no-duplicate-fluent-id"],
      ["missing-query.br.js", "servicenow/require-query-before-next"],
    ];
    for (const [file, ruleId] of cases) {
      const code = readFileSync(path.join(invalidDir, file), "utf8");
      const ids = eslintRecommended(code, file)
        .map((message) => message.ruleId)
        .filter((id): id is string => Boolean(id));
      assert.ok(ids.includes(ruleId), `${file}: missing ${ruleId} (got ${ids.join(", ") || "(none)"})`);
    }
  });

  it("recommended flags Phase 2 Fluent identity rules", () => {
    const nowId = pluginRulesFor(runOxlint(recommendedConfig, [path.join(invalidDir, "now-id-ref.now.ts")]));
    const duplicate = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "duplicate-id.now.ts")]),
    );
    assert.ok(nowId.includes("servicenow/no-now-id-as-reference"), `now-id-ref: ${nowId.join(", ") || "(none)"}`);
    assert.ok(
      duplicate.includes("servicenow/no-duplicate-fluent-id"),
      `duplicate-id: ${duplicate.join(", ") || "(none)"}`,
    );
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

  it("recommended flags Phase 3 server rules", () => {
    const element = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "glideelement-push.br.js")]),
    );
    const late = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "late-modifier.br.js")]),
    );
    const bulk = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "unfiltered-bulk.br.js")]),
    );
    assert.ok(
      element.includes("servicenow/no-glideelement-in-collection"),
      `glideelement-push: ${element.join(", ") || "(none)"}`,
    );
    assert.ok(
      late.includes("servicenow/no-gliderecord-query-modifier-after-query"),
      `late-modifier: ${late.join(", ") || "(none)"}`,
    );
    assert.ok(
      bulk.includes("servicenow/no-unfiltered-gliderecord-bulk-operation"),
      `unfiltered-bulk: ${bulk.join(", ") || "(none)"}`,
    );
  });

  it("recommended stays silent on body-only Business Rule source", () => {
    const rules = pluginRulesFor(runOxlint(recommendedConfig, [path.join(invalidDir, "unwrapped.br.js")]));
    assert.ok(!rules.includes("servicenow/require-business-rule-wrapper"), rules.join(", "));
  });

  it("full-script settings enable the Business Rule wrapper rule", () => {
    const rules = pluginRulesFor(runOxlint(fullScriptConfig, [path.join(invalidDir, "unwrapped.br.js")]));
    assert.ok(
      rules.includes("servicenow/require-business-rule-wrapper"),
      `unwrapped: ${rules.join(", ") || "(none)"}`,
    );
  });

  it("security profile flags documented ACL-bypass methods", () => {
    const recommended = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "system-query.br.js")]),
    );
    const security = pluginRulesFor(
      runOxlint(securityConfig, [path.join(invalidDir, "system-query.br.js")]),
    );
    assert.ok(!recommended.includes("servicenow/no-system-query-bypass"));
    assert.ok(
      security.includes("servicenow/no-system-query-bypass"),
      `system-query: ${security.join(", ") || "(none)"}`,
    );
  });

  it("recommended oxlint flags empty filters, late aggregates, and empty GlideAjax values", () => {
    const emptyQuery = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "empty-addquery-bulk.br.js")]),
    );
    const emptyEncoded = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "empty-encoded-bulk.br.js")]),
    );
    const lateAgg = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "aggregate-late-config.br.js")]),
    );
    const typeOnly = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "aggregate-type-only-field.br.js")]),
    );
    const emptyAjax = pluginRulesFor(
      runOxlint(recommendedConfig, [path.join(invalidDir, "glideajax-empty-sysparm.client.js")]),
    );
    assert.ok(emptyQuery.includes("servicenow/no-unfiltered-gliderecord-bulk-operation"));
    assert.ok(emptyEncoded.includes("servicenow/no-unfiltered-gliderecord-bulk-operation"));
    assert.ok(lateAgg.includes("servicenow/validate-glideaggregate-calls"));
    assert.ok(typeOnly.includes("servicenow/validate-glideaggregate-calls"));
    assert.ok(emptyAjax.includes("servicenow/require-glideajax-sysparm-name"));
  });

  it("strict oxlint and ESLint cover query-in-loop receivers and setNoCount epochs", () => {
    const iterator = pluginRulesFor(
      runOxlint(strictConfig, [path.join(validDir, "custom-iterator-loop.br.js")]),
    );
    const secondQuery = pluginRulesFor(
      runOxlint(strictConfig, [path.join(invalidDir, "setnocount-second-query.br.js")]),
    );
    const nested = pluginRulesFor(
      runOxlint(strictConfig, [path.join(invalidDir, "nested-cursor-query.br.js")]),
    );
    assert.ok(
      !iterator.includes("servicenow/no-gliderecord-query-in-loop"),
      `custom iterator: ${iterator.join(", ") || "(none)"}`,
    );
    assert.ok(
      secondQuery.includes("servicenow/prefer-setnocount-with-choosewindow"),
      `second query: ${secondQuery.join(", ") || "(none)"}`,
    );
    assert.ok(
      nested.includes("servicenow/no-gliderecord-query-in-loop"),
      `nested cursor: ${nested.join(", ") || "(none)"}`,
    );

    const eslintStrict = (code: string, filename: string) => {
      const linter = new Linter({ configType: "flat" });
      return linter.verify(
        code,
        [configs.flat.strict as unknown as import("eslint").Linter.Config],
        { filename },
      );
    };
    const iteratorCode = readFileSync(path.join(validDir, "custom-iterator-loop.br.js"), "utf8");
    const iteratorIds = eslintStrict(iteratorCode, "custom-iterator-loop.br.js")
      .map((message) => message.ruleId)
      .filter((id): id is string => Boolean(id));
    assert.ok(!iteratorIds.includes("servicenow/no-gliderecord-query-in-loop"));

    const secondCode = readFileSync(path.join(invalidDir, "setnocount-second-query.br.js"), "utf8");
    const secondIds = eslintStrict(secondCode, "setnocount-second-query.br.js")
      .map((message) => message.ruleId)
      .filter((id): id is string => Boolean(id));
    assert.ok(secondIds.includes("servicenow/prefer-setnocount-with-choosewindow"));

    const nestedCode = readFileSync(path.join(invalidDir, "nested-cursor-query.br.js"), "utf8");
    const nestedIds = eslintStrict(nestedCode, "nested-cursor-query.br.js")
      .map((message) => message.ruleId)
      .filter((id): id is string => Boolean(id));
    assert.ok(nestedIds.includes("servicenow/no-gliderecord-query-in-loop"));
  });

  it("recommended ESLint flags Phase 3 rules", () => {
    const cases: Array<[string, string]> = [
      ["glideelement-push.br.js", "servicenow/no-glideelement-in-collection"],
      ["late-modifier.br.js", "servicenow/no-gliderecord-query-modifier-after-query"],
      ["unfiltered-bulk.br.js", "servicenow/no-unfiltered-gliderecord-bulk-operation"],
      ["empty-addquery-bulk.br.js", "servicenow/no-unfiltered-gliderecord-bulk-operation"],
      ["empty-encoded-bulk.br.js", "servicenow/no-unfiltered-gliderecord-bulk-operation"],
      ["aggregate-late-config.br.js", "servicenow/validate-glideaggregate-calls"],
      ["aggregate-type-only-field.br.js", "servicenow/validate-glideaggregate-calls"],
      ["glideajax-empty-sysparm.client.js", "servicenow/require-glideajax-sysparm-name"],
    ];
    for (const [file, ruleId] of cases) {
      const code = readFileSync(path.join(invalidDir, file), "utf8");
      const ids = eslintRecommended(code, file)
        .map((message) => message.ruleId)
        .filter((id): id is string => Boolean(id));
      assert.ok(ids.includes(ruleId), `${file}: missing ${ruleId} (got ${ids.join(", ") || "(none)"})`);
    }
  });
});
