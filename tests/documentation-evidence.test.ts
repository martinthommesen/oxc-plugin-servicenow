import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import {
  evidenceTestReportPath,
  runEvidenceTests,
  writeJsonArtifact,
} from "../scripts/verify-doc-evidence.mjs";

// @lat: [[tests#Scripts and tooling#Evidence captures use private reports and atomic artifacts]]
describe("documentation evidence artifacts", () => {
  it("uses unique report directories and removes them after the test run", () => {
    const base = mkdtempSync(path.join(tmpdir(), "documentation-evidence-path-test-"));
    try {
      const first = evidenceTestReportPath(base);
      const second = evidenceTestReportPath(base);
      assert.notEqual(path.dirname(first), path.dirname(second));
      rmSync(path.dirname(first), { recursive: true, force: true });
      rmSync(path.dirname(second), { recursive: true, force: true });
      assert.deepEqual(readdirSync(base), []);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("cleans the private report directory after running evidence tests", () => {
    const base = mkdtempSync(path.join(tmpdir(), "documentation-evidence-run-test-"));
    try {
      const report = runEvidenceTests(base) as { tests: readonly unknown[] };
      assert.equal(report.tests.length, 95);
      assert.deepEqual(readdirSync(base), []);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("leaves a complete JSON artifact after replacing an earlier version", () => {
    const base = mkdtempSync(path.join(tmpdir(), "documentation-evidence-artifact-test-"));
    const artifactPath = path.join(base, "doc-evidence.json");
    try {
      writeJsonArtifact(artifactPath, { version: 1 });
      writeJsonArtifact(artifactPath, { version: 2, records: ["complete"] });
      assert.deepEqual(JSON.parse(readFileSync(artifactPath, "utf8")), {
        version: 2,
        records: ["complete"],
      });
      assert.deepEqual(readdirSync(base), ["doc-evidence.json"]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
