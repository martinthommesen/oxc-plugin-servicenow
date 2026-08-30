import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  classifyOxlintProof,
  interpretGitStatus,
  isErrorSeverity,
  isHostFaultCode,
  parseOxlintStdout,
} from "../scripts/lib/host-verifier.mjs";
import { parseRunId, runDirFor } from "../scripts/verify-examples.mjs";
import { repoRoot } from "./integration/helpers.js";

const cli = path.join(repoRoot, "scripts", "verify-examples.mjs");

function runCli(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd: repoRoot,
    env: { ...process.env, ...env },
  });
}

describe("verify-examples host classification", () => {
  it("fails status 1 with zero diagnostics", () => {
    const proof = classifyOxlintProof({
      tree: "valid",
      status: 1,
      report: { diagnostics: [] },
      parseError: null,
      expectations: [],
    });
    assert.equal(proof.ok, false);
    assert.ok(proof.reasons.some((reason) => /zero diagnostics/.test(reason)));
  });

  it("fails a valid tree with status 1", () => {
    const proof = classifyOxlintProof({
      tree: "valid",
      status: 1,
      report: { diagnostics: [{ code: "eslint(no-unused-vars)", severity: "error" }] },
      parseError: null,
      expectations: [],
    });
    assert.equal(proof.ok, false);
    assert.ok(proof.reasons.some((reason) => /status 0/.test(reason)));
  });

  it("fails host-fault diagnostics", () => {
    const proof = classifyOxlintProof({
      tree: "invalid",
      status: 1,
      report: { diagnostics: [{ code: "plugin-load", message: "nope", severity: "error" }] },
      parseError: null,
      expectations: [{ rule: "servicenow/require-fluent-id", file: "missing-id.now.ts" }],
    });
    assert.equal(proof.ok, false);
    assert.ok(proof.reasons.some((reason) => /host fault/.test(reason)));
  });

  it("does not treat a rule id that contains parser as a host fault", () => {
    assert.equal(isHostFaultCode("eslint(no-parser-return)"), false);
    assert.equal(isHostFaultCode("parser"), true);
    assert.equal(isHostFaultCode("plugin-load"), true);
    assert.equal(isHostFaultCode(undefined), false);
  });

  it("does not invent error severity when the host omitted it", () => {
    assert.equal(isErrorSeverity({ code: "eslint(no-unused-vars)" }), false);
    const proof = classifyOxlintProof({
      tree: "invalid",
      status: 1,
      report: { diagnostics: [{ code: "eslint(no-unused-vars)" }] },
      parseError: null,
      expectations: [{ rule: "servicenow/require-fluent-id" }],
    });
    assert.equal(proof.ok, false);
    assert.ok(proof.reasons.some((reason) => /non-plugin error/.test(reason)));
  });

  it("rejects malformed JSON", () => {
    const parsed = parseOxlintStdout("not json");
    assert.equal(parsed.report, null);
    assert.match(parsed.parseError ?? "", /did not emit JSON/);
  });

  it("treats git status 128 as an error", () => {
    const state = interpretGitStatus({ status: 128, stdout: "", stderr: "not a git repo" });
    assert.equal(state.kind, "error");
  });

  it("rejects run ids that escape the artifact root", () => {
    assert.throws(() => parseRunId("../escape"));
    assert.throws(() => parseRunId("bad/id"));
    assert.throws(() => parseRunId("."));
    assert.throws(() => runDirFor(repoRoot, "ok/../nope"));
  });
});

describe("verify-examples CLI", () => {
  it("validates the skill and project manifest", () => {
    const result = runCli(["validate"]);
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout) as { ok: boolean; projects: string[] };
    assert.equal(body.ok, true);
    assert.equal(body.projects.length, 8);
  });

  it("runs the fluent invalid drive and keeps evidence", () => {
    const runId = `test-fluent-${Date.now()}`;
    const result = runCli(["--project", "fluent", "--tree", "invalid", "--run-id", runId]);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const runDir = path.join(repoRoot, "artifacts", "verify-oxc-plugin-servicenow", runId);
    assert.ok(existsSync(path.join(runDir, "manifest.json")));
    assert.ok(existsSync(path.join(runDir, "doctor", "COMPLETED")));
    const attempts = JSON.parse(result.stdout) as { evidence: string };
    assert.ok(existsSync(path.join(attempts.evidence, "COMPLETED")));
    assert.ok(existsSync(path.join(attempts.evidence, "effective.oxlintrc.json")));
    assert.ok(existsSync(path.join(attempts.evidence, "summary.json")));
    const summary = JSON.parse(
      readFileSync(path.join(attempts.evidence, "summary.json"), "utf8"),
    ) as {
      ok: boolean;
      pluginRules: string[];
    };
    assert.equal(summary.ok, true);
    assert.deepEqual(summary.pluginRules, ["servicenow/require-fluent-id"]);
  });

  it("fails when dist no longer matches the run fingerprint", () => {
    const runId = `test-stale-${Date.now()}`;
    const prepare = runCli(["prepare", "--run-id", runId]);
    assert.equal(prepare.status, 0, `${prepare.stdout}\n${prepare.stderr}`);
    const dist = path.join(repoRoot, "dist", "index.js");
    const original = readFileSync(dist);
    writeFileSync(dist, Buffer.concat([original, Buffer.from("\n")]));
    try {
      const drive = runCli(["--project", "fluent", "--tree", "valid", "--run-id", runId]);
      assert.notEqual(drive.status, 0);
      assert.match(`${drive.stdout}\n${drive.stderr}`, /hash changed|fingerprint/);
    } finally {
      writeFileSync(dist, original);
    }
  });

  it("refuses to reuse an existing run id for prepare", () => {
    const runId = `test-reuse-${Date.now()}`;
    assert.equal(runCli(["prepare", "--run-id", runId]).status, 0);
    const second = runCli(["prepare", "--run-id", runId]);
    assert.notEqual(second.status, 0);
    assert.match(`${second.stdout}\n${second.stderr}`, /exists|EEXIST|file already exists/i);
  });

  it("cleanup refuses a live pid and does not delete evidence", () => {
    const runId = `test-clean-${Date.now()}`;
    assert.equal(runCli(["prepare", "--run-id", runId]).status, 0);
    const runDir = path.join(repoRoot, "artifacts", "verify-oxc-plugin-servicenow", runId);
    writeFileSync(path.join(runDir, "live.pid"), `${process.pid}\n`);
    const cleanup = runCli(["cleanup", "--run-id", runId]);
    assert.notEqual(cleanup.status, 0);
    assert.ok(existsSync(path.join(runDir, "manifest.json")));
    writeFileSync(path.join(runDir, "live.pid"), "2147483647\n");
    const stale = runCli(["cleanup", "--run-id", runId]);
    assert.equal(stale.status, 0, stale.stderr);
    assert.ok(existsSync(path.join(runDir, "manifest.json")));
  });

  it("checks the documented JSON oxfmt consumer path", () => {
    const oxfmt = path.join(repoRoot, "node_modules", ".bin", "oxfmt");
    const result = spawnSync(
      oxfmt,
      [
        "-c",
        path.join(repoRoot, "oxfmt.recommended.json"),
        "--check",
        path.join(repoRoot, "examples/fluent/valid"),
      ],
      { encoding: "utf8", cwd: repoRoot },
    );
    assert.equal(result.status, 0, result.stderr);
  });
});
