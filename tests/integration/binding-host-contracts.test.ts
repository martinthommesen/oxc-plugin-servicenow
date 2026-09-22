import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { Linter } from "eslint";
import plugin from "../../src/index.js";
import { BINDING_MATRIX_CASES } from "../helpers/binding-matrix.js";
import { createTemporaryProject, eslintFlatConfig, runOxlintProcess } from "./helpers.js";

describe("exact binding matrix contracts in real hosts", () => {
  for (const testCase of BINDING_MATRIX_CASES) {
    it(testCase.id, () => {
      const project = createTemporaryProject({
        prefix: "sn-binding-host-",
        filename: `${testCase.id}.${testCase.filename.split(".").slice(1).join(".")}`,
        code: testCase.code,
        settings: testCase.settings,
        rules: {
          "no-unused-vars": "off",
          [`servicenow/${testCase.rule}`]: "error",
        },
      });
      const { source, config } = project;
      try {
        const oxlint = runOxlintProcess(config, [source]);
        assert.equal(oxlint.stderr, "");
        const pluginDiagnostics = oxlint.report.diagnostics.filter((diagnostic) =>
          diagnostic.code.startsWith("servicenow("),
        );

        const linter = new Linter({ configType: "flat" });
        const eslint = linter.verify(
          testCase.code,
          eslintFlatConfig({
            files: ["**/*.{js,ts,tsx}"],
            plugin: plugin as unknown as import("eslint").ESLint.Plugin,
            settings: testCase.settings,
            rule: `servicenow/${testCase.rule}`,
          }),
          { filename: path.basename(source) },
        );

        if (testCase.expected === "silent") {
          assert.equal(oxlint.status, 0);
          assert.deepEqual(pluginDiagnostics, []);
          assert.deepEqual(eslint, []);
          return;
        }

        assert.equal(oxlint.status, 1);
        assert.equal(pluginDiagnostics.length, 1);
        const diagnostic = pluginDiagnostics[0];
        assert.deepEqual(
          {
            code: diagnostic?.code,
            severity: diagnostic?.severity,
            message: diagnostic?.message,
            filename: diagnostic?.filename,
          },
          {
            code: `servicenow(${testCase.rule})`,
            severity: "error",
            message: testCase.message,
            filename: source,
          },
        );
        assert.deepEqual(diagnostic?.labels, [
          {
            span: {
              offset: testCase.offset,
              length: testCase.length,
              line: testCase.start.line,
              column: testCase.start.column + 1,
            },
          },
        ]);

        assert.equal(eslint.length, 1);
        const message = eslint[0];
        assert.deepEqual(
          {
            ruleId: message?.ruleId,
            severity: message?.severity,
            messageId: message?.messageId,
            message: message?.message,
            line: message?.line,
            column: message?.column,
            endLine: message?.endLine,
            endColumn: message?.endColumn,
            fatal: message?.fatal ?? false,
          },
          {
            ruleId: `servicenow/${testCase.rule}`,
            severity: 2,
            messageId: testCase.messageId,
            message: testCase.message,
            line: testCase.start.line,
            column: testCase.start.column + 1,
            endLine: testCase.end.line,
            endColumn: testCase.end.column + 1,
            fatal: false,
          },
        );
      } finally {
        project.cleanup();
      }
    });
  }
});
