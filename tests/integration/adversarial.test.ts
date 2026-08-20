import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { Linter } from "eslint";
import { configs } from "../../src/index.js";
import { pluginRuleId, pluginRulesFor, repoRoot, runOxlint, type OxlintDiagnostic } from "./helpers.js";

const profilesDir = path.join(repoRoot, "tests/integration/profiles");
const recommendedConfig = path.join(profilesDir, "configs/recommended.oxlintrc.json");
const invalidDir = path.join(profilesDir, "invalid");
const validDir = path.join(profilesDir, "valid");

function eslintMessages(code: string, filename: string) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(
    code,
    [configs.flat.recommended as unknown as import("eslint").Linter.Config],
    { filename },
  );
}

function oxlintPluginDiagnostics(file: string, filenamePart: string): OxlintDiagnostic[] {
  const report = runOxlint(recommendedConfig, [file]);
  return report.diagnostics.filter((diagnostic) => {
    if (!diagnostic.filename.includes(filenamePart)) return false;
    return Boolean(pluginRuleId(diagnostic.code));
  });
}

function assertHostFinding(input: {
  file: string;
  rule: string;
  messageId: string;
  line: number;
  includes: string;
}) {
  const file = path.join(invalidDir, input.file);
  const code = readFileSync(file, "utf8");
  const oxlint = oxlintPluginDiagnostics(file, input.file);
  const oxlintRule = oxlint.filter((diagnostic) => pluginRuleId(diagnostic.code) === input.rule);
  assert.equal(
    oxlintRule.length,
    1,
    `oxlint ${input.file}: expected 1 ${input.rule}, got ${oxlint.map((d) => d.code).join(", ") || "(none)"}`,
  );
  const label = oxlintRule[0]?.labels?.[0]?.span;
  assert.ok(label, `oxlint ${input.file}: missing label span`);
  assert.equal(label.line, input.line, `oxlint ${input.file}: line`);
  assert.ok(
    oxlintRule[0]?.message.includes(input.includes),
    `oxlint ${input.file}: message ${oxlintRule[0]?.message}`,
  );

  const eslint = eslintMessages(code, input.file).filter((message) => message.ruleId === input.rule);
  assert.equal(
    eslint.length,
    1,
    `eslint ${input.file}: expected 1 ${input.rule}, got ${eslint.map((m) => m.ruleId).join(", ") || "(none)"}`,
  );
  assert.equal(eslint[0]?.messageId, input.messageId, `eslint ${input.file}: messageId`);
  assert.equal(eslint[0]?.line, input.line, `eslint ${input.file}: line`);
  assert.ok(eslint[0]?.message.includes(input.includes), `eslint ${input.file}: message ${eslint[0]?.message}`);
}

describe("adversarial host binding and control-flow", () => {
  it("keeps recommended silent on alias, join, escape, and temporal valid fixtures", () => {
    const files = [
      "alias-query-consume.br.js",
      "sibling-reassign.br.js",
      "noop-join.br.js",
      "branch-unknown.br.js",
      "short-circuit.br.js",
      "early-return-query.br.js",
      "try-catch-query.br.js",
      "escaped-helper.br.js",
      "temporal-now-id.now.ts",
    ];
    for (const file of files) {
      const target = path.join(validDir, file);
      const oxlint = pluginRulesFor(runOxlint(recommendedConfig, [target]), file);
      assert.deepEqual(oxlint, [], `oxlint ${file}: ${oxlint.join(", ")}`);
      const eslint = eslintMessages(readFileSync(target, "utf8"), file).filter((message) =>
        message.ruleId?.startsWith("servicenow/"),
      );
      assert.deepEqual(eslint, [], `eslint ${file}: ${JSON.stringify(eslint)}`);
    }
  });

  it("reports exact query-before-next diagnostics on alias and independent objects", () => {
    assertHostFinding({
      file: "alias-next-without-query.br.js",
      rule: "servicenow/require-query-before-next",
      messageId: "missingQuery",
      line: 4,
      includes: "next()",
    });
    assertHostFinding({
      file: "independent-objects.br.js",
      rule: "servicenow/require-query-before-next",
      messageId: "missingQuery",
      line: 5,
      includes: "b.next()",
    });
    assertHostFinding({
      file: "early-return-next.br.js",
      rule: "servicenow/require-query-before-next",
      messageId: "missingQuery",
      line: 4,
      includes: "next()",
    });
    assertHostFinding({
      file: "switch-no-default.br.js",
      rule: "servicenow/require-query-before-next",
      messageId: "missingQuery",
      line: 7,
      includes: "next()",
    });
  });

  it("keeps Now.ID analysis temporal on the host", () => {
    assertHostFinding({
      file: "temporal-raw-id.now.ts",
      rule: "servicenow/require-fluent-id",
      messageId: "preferNowId",
      line: 5,
      includes: "Now.ID",
    });
  });
});
