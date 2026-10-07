import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { Linter } from "eslint";
import plugin from "../../src/index.js";
import {
  deepFluentAliasFixture,
  FLUENT_DIRECTIVE_PROOF_CASES,
  FLUENT_PROPERTY_PROOF_CASES,
  FLUENT_SCOPE_PROOF_CASES,
  FLUENT_WRITE_PROOF_CASES,
} from "../helpers/fluent-proof-cases.js";
import { createTemporaryProject, eslintFlatConfig, runOxlintProcess } from "./helpers.js";

describe("Fluent proof boundaries in real hosts", () => {
  const cases = [
    ...FLUENT_WRITE_PROOF_CASES,
    ...FLUENT_PROPERTY_PROOF_CASES,
    ...FLUENT_DIRECTIVE_PROOF_CASES,
    ...FLUENT_SCOPE_PROOF_CASES,
    {
      name: "finite 6000-alias chain",
      code: deepFluentAliasFixture(),
      rule: "require-fluent-id",
      expected: ["missing"],
    },
  ];
  for (const testCase of cases) {
    it(testCase.name, () => {
      const project = createTemporaryProject({
        prefix: "sn-fluent-proof-",
        filename: "proof.now.ts",
        code: testCase.code,
        rules: { "no-unused-vars": "off", [`servicenow/${testCase.rule}`]: "error" },
      });
      try {
        const oxlint = runOxlintProcess(project.config, [project.source]);
        assert.equal(oxlint.stderr, "");
        assert.equal(oxlint.status, testCase.expected.length > 0 ? 1 : 0);
        assert.deepEqual(
          oxlint.report.diagnostics.map((diagnostic) => diagnostic.code),
          testCase.expected.map(() => `servicenow(${testCase.rule})`),
        );
        const eslint = new Linter({ configType: "flat" }).verify(
          testCase.code,
          eslintFlatConfig({
            files: ["**/*.ts"],
            plugin: plugin as unknown as import("eslint").ESLint.Plugin,
            rule: `servicenow/${testCase.rule}`,
          }),
          { filename: path.basename(project.source) },
        );
        assert.ok(eslint.every((message) => !message.fatal));
        assert.deepEqual(
          eslint.map((message) => message.messageId),
          testCase.expected,
        );
        assert.deepEqual(
          oxlint.report.diagnostics.map((diagnostic) => diagnostic.message),
          eslint.map((message) => message.message),
        );
      } finally {
        project.cleanup();
      }
    });
  }
});
