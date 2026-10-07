import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { configs } from "../../src/index.js";
import { eslintRuleIds } from "./helpers.js";
import { compatibilityOxlintReport } from "../../scripts/compat-consumer.mjs";
import { emptyHostResult } from "../../scripts/lib/host-verifier.mjs";

describe("negative host validation", () => {
  it("rejects fatal ESLint parsing before projecting rule ids", () => {
    assert.throws(
      () => eslintRuleIds(configs.flat.recommended, "var = ;", "invalid.server.js"),
      /parser|parsing/i,
    );
    assert.deepEqual(
      eslintRuleIds(configs.flat.recommended, "var count = 1;", "valid.server.js"),
      [],
    );
  });

  // @lat: [[tests#Scripts and tooling#Compatibility reports reject raw host failures]]
  it("rejects host faults even when compatibility stdout contains JSON", () => {
    const clean = { ...emptyHostResult(), status: 0, stdout: '{"diagnostics":[]}' };
    assert.deepEqual(compatibilityOxlintReport(clean, "runtime", "consumer lint"), {
      diagnostics: [],
    });
    const diagnostic = {
      code: "servicenow(no-promise)",
      message: "Promise unavailable",
      severity: "error",
      filename: "sample.server.js",
    };
    assert.deepEqual(
      compatibilityOxlintReport(
        { ...clean, status: 1, stdout: JSON.stringify({ diagnostics: [diagnostic] }) },
        "runtime",
        "consumer lint",
      ),
      { diagnostics: [diagnostic] },
    );
    const failures: import("../../scripts/lib/host-verifier.mjs").HostResult[] = [
      {
        ...clean,
        status: 1,
        stdout:
          '{"diagnostics":[{"code":"parser-error","message":"bad syntax","severity":"error"}]}',
      },
      {
        ...clean,
        status: 1,
        stdout:
          '{"diagnostics":[{"code":"plugin-load-error","message":"load failed","severity":"error"}]}',
      },
      { ...clean, status: 1 },
      { ...clean, status: 2 },
      { ...clean, status: null },
      { ...clean, signal: "SIGKILL" },
      { ...clean, error: { message: "spawn failed", code: "ENOENT" } },
      { ...clean, timedOut: true },
    ];
    for (const host of failures) {
      assert.throws(
        () => compatibilityOxlintReport(host, "runtime", "consumer lint"),
        /consumer lint/,
      );
    }
  });
});
