import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  classifyOxfmtProof,
  classifyOxlintProof,
  interpretGitStatus,
  isErrorSeverity,
  hostFaultCodeFor,
  hostFaultCodeForStdout,
  isHostFaultCode,
  isHostFaultDiagnostic,
  parseOxlintStdout,
  pluginRuleIds,
  runHostProcess,
  unwrapServicenowRuleId,
} from "../scripts/lib/host-verifier.mjs";
import {
  containedPath,
  distHash,
  loadAndValidateProjects,
  parseRunId,
  runDirFor,
  sha256,
  sourceFingerprint,
} from "../scripts/verify-examples.mjs";
import { pluginRulesFor, repoRoot } from "./integration/helpers.js";

const cli = path.join(repoRoot, "scripts", "verify-examples.mjs");

const createdRunIds: string[] = [];

function trackRunId(runId: string) {
  createdRunIds.push(runId);
  return runId;
}

function runCli(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd: repoRoot,
    env: { ...process.env, ...env },
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}

describe("verify-examples host classification", () => {
  it("runs a host process and captures both output streams", () => {
    const args = ["-e", "process.stdout.write('out'); process.stderr.write('err')"];
    const result = runHostProcess({
      bin: process.execPath,
      args,
      cwd: repoRoot,
    });

    assert.equal(result.status, 0);
    assert.equal(result.signal, null);
    assert.equal(result.stdout, "out");
    assert.equal(result.stderr, "err");
    assert.equal(result.error, null);
    assert.equal(result.timedOut, false);
    assert.deepEqual(result.argv, [process.execPath, ...args]);
    assert.ok(result.durationMs >= 0);
  });

  it("normalizes process launch failures without throwing", () => {
    const result = runHostProcess({
      bin: path.join(repoRoot, "does-not-exist"),
      args: [],
      cwd: repoRoot,
    });

    assert.equal(result.status, null);
    assert.equal(result.error?.code, "ENOENT");
    assert.equal(result.timedOut, false);
  });

  it("parses only Oxlint reports with a diagnostics array", () => {
    assert.deepEqual(parseOxlintStdout('{"diagnostics":[]}'), {
      report: { diagnostics: [] },
      parseError: null,
    });
    assert.deepEqual(parseOxlintStdout('{"diagnostics":null}'), {
      report: null,
      parseError: "oxlint JSON has no diagnostics array",
    });
    assert.deepEqual(parseOxlintStdout("null"), {
      report: null,
      parseError: "oxlint JSON has no diagnostics array",
    });
  });

  it("normalizes and deduplicates ServiceNow rule ids", () => {
    assert.equal(
      unwrapServicenowRuleId("servicenow(require-fluent-id)"),
      "servicenow/require-fluent-id",
    );
    assert.equal(
      unwrapServicenowRuleId("servicenow/require-business-rule-wrapper"),
      "servicenow/require-business-rule-wrapper",
    );
    assert.equal(unwrapServicenowRuleId("eslint(no-unused-vars)"), undefined);
    assert.equal(unwrapServicenowRuleId(undefined), undefined);

    assert.deepEqual(
      pluginRuleIds({
        diagnostics: [
          { code: "servicenow/z-rule", filename: "first.js" },
          { code: "servicenow(a-rule)", filename: "second.js" },
          { code: "servicenow/z-rule", filename: "first.js" },
          { code: "eslint(no-unused-vars)", filename: "first.js" },
        ],
      }),
      ["servicenow/a-rule", "servicenow/z-rule"],
    );
  });

  it("filters plugin rule ids by filename", () => {
    const report = {
      diagnostics: [
        { code: "servicenow/first", filename: "/valid/one.js" },
        { code: "servicenow/second", filename: "/invalid/two.js" },
        { code: "servicenow/third" },
      ],
    };

    assert.deepEqual(pluginRuleIds(report, "/invalid/"), ["servicenow/second"]);
    assert.deepEqual(pluginRuleIds(report, "missing"), []);
    assert.deepEqual(pluginRuleIds(undefined), []);
  });

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
    assert.equal(
      isHostFaultDiagnostic({ message: "Syntax Error", severity: "error", filename: "a.js" }),
      true,
    );
  });

  it("treats an uncoded error diagnostic as a host fault", () => {
    const proof = classifyOxlintProof({
      tree: "valid",
      status: 1,
      report: {
        diagnostics: [{ message: "Syntax Error", severity: "error", filename: "a.js" }],
      },
      parseError: null,
      expectations: [],
    });
    assert.equal(proof.ok, false);
    assert.equal(proof.hostFaults.length, 1);
    assert.equal(proof.hostFaults[0]?.code, undefined);
    assert.ok(proof.reasons.some((reason) => /host fault: Syntax Error/.test(reason)));
  });

  it("labels stdout plugin-load failures as plugin-load", () => {
    assert.equal(hostFaultCodeFor({ message: "Expected `}`", severity: "error" }), undefined);
    assert.equal(hostFaultCodeFor({ code: "parser", severity: "error" }), "parser");
    assert.equal(
      hostFaultCodeForStdout("Failed to load JS plugin: oxc-plugin-servicenow"),
      "plugin-load",
    );
    assert.equal(hostFaultCodeForStdout("Failed to parse oxlint configuration file."), undefined);
    assert.equal(hostFaultCodeForStdout("ok"), undefined);
    const proof = classifyOxlintProof({
      tree: "valid",
      status: 1,
      report: null,
      parseError: "oxlint did not emit JSON",
      host: {
        argv: ["oxlint"],
        status: 1,
        signal: null,
        stdout:
          "Failed to parse oxlint configuration file.\n\n  x Failed to load JS plugin: missing\n",
        stderr: "",
        error: null,
        timedOut: false,
        durationMs: 10,
      },
      expectations: [],
    });
    assert.equal(proof.hostFaults[0]?.code, "plugin-load");
  });

  it("fails when number_of_files does not match the tree", () => {
    const mismatch = classifyOxlintProof({
      tree: "valid",
      status: 0,
      report: { diagnostics: [], number_of_files: 1 },
      parseError: null,
      expectations: [],
      expectedFileCount: 6,
    });
    assert.equal(mismatch.ok, false);
    assert.ok(mismatch.reasons.some((reason) => /number_of_files 1, expected 6/.test(reason)));
    const missing = classifyOxlintProof({
      tree: "valid",
      status: 0,
      report: { diagnostics: [] },
      parseError: null,
      expectations: [],
      expectedFileCount: 1,
    });
    assert.ok(missing.reasons.some((reason) => /missing number_of_files/.test(reason)));
    const match = classifyOxlintProof({
      tree: "valid",
      status: 0,
      report: { diagnostics: [], number_of_files: 6 },
      parseError: null,
      expectations: [],
      expectedFileCount: 6,
    });
    assert.equal(match.ok, true);
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

  it("accepts warning diagnostics on a valid tree", () => {
    const proof = classifyOxlintProof({
      tree: "valid",
      status: 0,
      report: { diagnostics: [{ code: "eslint(no-console)", severity: "warning" }] },
      parseError: null,
      expectations: [],
    });

    assert.equal(proof.ok, true);
    assert.deepEqual(proof.unexpectedErrors, []);
  });

  it("accepts an invalid tree only when rule, file, and minimum count match", () => {
    const proof = classifyOxlintProof({
      tree: "invalid",
      status: 1,
      report: {
        diagnostics: [
          {
            code: "servicenow(no-unsupported-syntax)",
            filename: "/examples/optional.server.js",
            severity: "error",
          },
          {
            code: "servicenow/no-unsupported-syntax",
            filename: "/examples/optional.server.js",
            severity: "error",
          },
        ],
      },
      parseError: null,
      expectations: [
        {
          rule: "servicenow/no-unsupported-syntax",
          file: "optional.server.js",
          minCount: 2,
        },
      ],
    });

    assert.equal(proof.ok, true);
    assert.deepEqual(proof.pluginRules, ["servicenow/no-unsupported-syntax"]);
  });

  it("reports missing, misplaced, and unexpected plugin diagnostics", () => {
    const proof = classifyOxlintProof({
      tree: "invalid",
      status: 1,
      report: {
        diagnostics: [
          {
            code: "servicenow/expected-rule",
            filename: "/examples/wrong.js",
            severity: "error",
          },
          {
            code: "servicenow/unexpected-rule",
            filename: "/examples/target.js",
            severity: "error",
          },
        ],
      },
      parseError: null,
      expectations: [
        { rule: "servicenow/expected-rule", file: "target.js", minCount: 2 },
        { rule: "servicenow/missing-rule" },
      ],
    });

    assert.equal(proof.ok, false);
    assert.ok(proof.reasons.some((reason) => /expected-rule.*at least 2, got 0/.test(reason)));
    assert.ok(proof.reasons.some((reason) => /missing-rule.*at least 1, got 0/.test(reason)));
    assert.ok(
      proof.reasons.some((reason) => /unexpected plugin rules.*unexpected-rule/.test(reason)),
    );
  });

  it("fails when an expected rule also fires on an unexpected file", () => {
    const proof = classifyOxlintProof({
      tree: "invalid",
      status: 1,
      report: {
        diagnostics: [
          {
            code: "servicenow/no-async-iterators",
            filename: "/examples/async-iter.server.js",
            severity: "error",
          },
          {
            code: "servicenow/no-async-iterators",
            filename: "/examples/other.server.js",
            severity: "error",
          },
        ],
      },
      parseError: null,
      expectations: [{ rule: "servicenow/no-async-iterators", file: "async-iter.server.js" }],
    });
    assert.equal(proof.ok, false);
    assert.ok(
      proof.reasons.some((reason) => /unexpected servicenow\/no-async-iterators/.test(reason)),
    );
  });

  it("rejects a zero minCount", () => {
    const proof = classifyOxlintProof({
      tree: "invalid",
      status: 1,
      report: { diagnostics: [] },
      parseError: null,
      expectations: [{ rule: "servicenow/require-fluent-id", minCount: 0 }],
    });
    assert.equal(proof.ok, false);
    assert.ok(proof.reasons.some((reason) => /invalid minCount/.test(reason)));
  });

  it("keeps duplicate plugin rule ids in integration summaries", () => {
    assert.deepEqual(
      pluginRulesFor({
        diagnostics: [
          { message: "a", code: "servicenow/no-promise", filename: "one.js" },
          { message: "b", code: "servicenow/no-promise", filename: "one.js" },
        ],
      }),
      ["servicenow/no-promise", "servicenow/no-promise"],
    );
    assert.deepEqual(
      pluginRuleIds({
        diagnostics: [
          { code: "servicenow/no-promise", filename: "one.js" },
          { code: "servicenow/no-promise", filename: "one.js" },
        ],
      }),
      ["servicenow/no-promise"],
    );
  });

  it("rejects invalid drives without expectations and unknown tree names", () => {
    const noExpectations = classifyOxlintProof({
      tree: "invalid",
      status: 1,
      report: { diagnostics: [{ code: "servicenow/a-rule", severity: "error" }] },
      parseError: null,
      expectations: [],
    });
    const unknownTree = classifyOxlintProof({
      tree: "other",
      status: 0,
      report: { diagnostics: [] },
      parseError: null,
      expectations: [],
    });

    assert.ok(noExpectations.reasons.includes("invalid drive has no expectations"));
    assert.ok(unknownTree.reasons.includes("unknown tree other"));
  });

  it("propagates host execution and parse failures into proof reasons", () => {
    const proof = classifyOxlintProof({
      tree: "valid",
      status: null,
      report: null,
      parseError: "oxlint did not emit JSON",
      host: {
        argv: ["oxlint"],
        status: null,
        signal: "SIGTERM",
        stdout: "",
        stderr: "",
        error: { code: "ETIMEDOUT", message: "timed out" },
        timedOut: true,
        durationMs: 60_000,
      },
      expectations: [],
    });

    assert.equal(proof.ok, false);
    assert.deepEqual(proof.reasons, [
      "spawn: timed out",
      "signal: SIGTERM",
      "timed out",
      "oxlint did not emit JSON",
    ]);
    const withStdout = classifyOxlintProof({
      tree: "valid",
      status: 1,
      report: null,
      parseError: "oxlint did not emit JSON",
      host: {
        argv: ["oxlint"],
        status: 1,
        signal: null,
        stdout: "Cannot find module 'oxc-plugin-servicenow'\n",
        stderr: "",
        error: null,
        timedOut: false,
        durationMs: 10,
      },
      expectations: [],
    });
    assert.ok(
      withStdout.reasons.some((reason) =>
        /oxlint did not emit JSON: Cannot find module/.test(reason),
      ),
    );
  });

  it("classifies formatter status and host failures", () => {
    const success = classifyOxfmtProof({
      argv: ["oxfmt"],
      status: 0,
      signal: null,
      stdout: "",
      stderr: "",
      error: null,
      timedOut: false,
      durationMs: 1,
    });
    const failure = classifyOxfmtProof({
      argv: ["oxfmt"],
      status: null,
      signal: "SIGTERM",
      stdout: "",
      stderr: "",
      error: { code: "ETIMEDOUT", message: "execution timed out" },
      timedOut: true,
      durationMs: 60_000,
    });

    assert.deepEqual(success, { ok: true, reasons: [] });
    assert.deepEqual(failure, {
      ok: false,
      reasons: ["spawn: execution timed out", "signal: SIGTERM", "timed out", "oxfmt status null"],
    });
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

  it("distinguishes clean and dirty successful git status output", () => {
    assert.deepEqual(interpretGitStatus({ status: 0, stdout: "\n", stderr: "" }), {
      kind: "clean",
      detail: "",
    });
    assert.deepEqual(
      interpretGitStatus({ status: 0, stdout: " M examples/file.js\n", stderr: "" }),
      { kind: "dirty", detail: "M examples/file.js" },
    );
  });

  it("rejects run ids that escape the artifact root", () => {
    assert.throws(() => parseRunId("../escape"));
    assert.throws(() => parseRunId("bad/id"));
    assert.throws(() => parseRunId("."));
    assert.throws(() => runDirFor(repoRoot, "ok/../nope"));
  });

  it("enforces run id length and character boundaries", () => {
    const longestValid = `a${"-".repeat(127)}`;
    assert.equal(parseRunId("run_2026-08.30"), "run_2026-08.30");
    assert.equal(parseRunId(longestValid), longestValid);
    assert.throws(() => parseRunId(`a${"-".repeat(128)}`), /invalid run id/);
    assert.throws(() => parseRunId("run..child"), /invalid run id/);
    assert.throws(() => parseRunId("-starts-with-dash"), /invalid run id/);
  });

  it("contains artifact paths without allowing sibling-prefix escapes", () => {
    const base = path.join(repoRoot, "artifacts", "base");
    assert.equal(containedPath(base, path.join(base, "child")), path.join(base, "child"));
    assert.equal(containedPath(base, base), base);
    assert.throws(() => containedPath(base, path.join(repoRoot, "artifacts", "base-sibling")));
  });

  it("computes stable SHA-256 digests for strings and buffers", () => {
    const expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    assert.equal(sha256("abc"), expected);
    assert.equal(sha256(Buffer.from("abc")), expected);
  });
});

describe("verify-examples CLI", { concurrency: 1 }, () => {
  after(() => {
    for (const runId of createdRunIds) {
      rmSync(path.join(repoRoot, "artifacts", "verify-oxc-plugin-servicenow", runId), {
        recursive: true,
        force: true,
      });
    }
  });

  it("validates the skill and project manifest", () => {
    const result = runCli(["validate"]);
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout) as { ok: boolean; projects: string[] };
    assert.equal(body.ok, true);
    assert.equal(body.projects.length, 8);
    const projects = loadAndValidateProjects(repoRoot);
    assert.equal(projects.skillDir, ".agents/skills/verify-oxc-plugin-servicenow");
    const claudeSkill = path.join(repoRoot, ".claude", "skills", "verify-oxc-plugin-servicenow");
    assert.equal(
      readFileSync(path.join(claudeSkill, "SKILL.md"), "utf8").includes("doctor --run-id"),
      true,
    );
    const skill = readFileSync(path.join(repoRoot, projects.skillDir, "SKILL.md"), "utf8");
    assert.match(skill, /doctor --run-id/);
    assert.doesNotMatch(skill, /To re-check an existing run:[\s\S]*prepare --run-id/);
  });

  it("runs the fluent invalid drive and keeps evidence", () => {
    const runId = trackRunId(`test-fluent-${Date.now()}`);
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
    const runId = trackRunId(`test-stale-${Date.now()}`);
    const prepare = runCli(["prepare", "--run-id", runId]);
    assert.equal(prepare.status, 0, `${prepare.stdout}\n${prepare.stderr}`);
    const manifestPath = path.join(
      repoRoot,
      "artifacts",
      "verify-oxc-plugin-servicenow",
      runId,
      "manifest.json",
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { distHash: string };
    manifest.distHash = "0".repeat(64);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const drive = runCli(["--project", "fluent", "--tree", "valid", "--run-id", runId]);
    assert.notEqual(drive.status, 0);
    assert.match(`${drive.stdout}\n${drive.stderr}`, /hash changed|fingerprint/);
  });

  it("refuses to reuse an existing run id for prepare", () => {
    const runId = trackRunId(`test-reuse-${Date.now()}`);
    assert.equal(runCli(["prepare", "--run-id", runId]).status, 0);
    const second = runCli(["prepare", "--run-id", runId]);
    assert.notEqual(second.status, 0);
    assert.match(`${second.stdout}\n${second.stderr}`, /exists|EEXIST|file already exists/i);
  });

  it("cleanup refuses a live pid and does not delete evidence", () => {
    const runId = trackRunId(`test-clean-${Date.now()}`);
    assert.equal(runCli(["prepare", "--run-id", runId]).status, 0);
    const runDir = path.join(repoRoot, "artifacts", "verify-oxc-plugin-servicenow", runId);
    writeFileSync(path.join(runDir, "live.pid"), `${process.pid}\n`);
    const cleanup = runCli(["cleanup", "--run-id", runId]);
    assert.notEqual(cleanup.status, 0);
    assert.ok(existsSync(path.join(runDir, "manifest.json")));
    const dead = spawnSync(process.execPath, ["-e", ""]);
    assert.equal(dead.status, 0);
    assert.ok(Number.isInteger(dead.pid));
    writeFileSync(path.join(runDir, "live.pid"), `${dead.pid}\n`);
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

  it("clears doctor success when a later doctor run fails", () => {
    const runId = trackRunId(`test-doctor-stale-${Date.now()}`);
    assert.equal(runCli(["prepare", "--run-id", runId]).status, 0);
    const runDir = path.join(repoRoot, "artifacts", "verify-oxc-plugin-servicenow", runId);
    const dirt = path.join(repoRoot, "examples", "fluent", "valid", ".review-dirt");
    writeFileSync(dirt, "x\n");
    try {
      const doctor = runCli(["doctor", "--run-id", runId]);
      assert.notEqual(doctor.status, 0);
      assert.ok(!existsSync(path.join(runDir, "doctor", "COMPLETED")));
      const manifest = JSON.parse(readFileSync(path.join(runDir, "manifest.json"), "utf8")) as {
        doctorCompleted: boolean;
      };
      assert.equal(manifest.doctorCompleted, false);
    } finally {
      rmSync(dirt, { force: true });
    }
  });

  it("lets prepare retry a run id that never wrote a manifest", () => {
    const runId = trackRunId(`test-prepare-retry-${Date.now()}`);
    const dirt = path.join(repoRoot, "examples", "fluent", "valid", ".review-dirt");
    writeFileSync(dirt, "x\n");
    try {
      assert.notEqual(runCli(["prepare", "--run-id", runId]).status, 0);
    } finally {
      rmSync(dirt, { force: true });
    }
    assert.equal(runCli(["prepare", "--run-id", runId]).status, 0);
  });

  it("cleanup removes a run directory that has no manifest", () => {
    const runId = trackRunId(`test-cleanup-incomplete-${Date.now()}`);
    const runDir = path.join(repoRoot, "artifacts", "verify-oxc-plugin-servicenow", runId);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(path.join(runDir, "build.execution.json"), "{}\n");
    const cleanup = runCli(["cleanup", "--run-id", runId]);
    assert.equal(cleanup.status, 0, cleanup.stderr);
    const body = JSON.parse(cleanup.stdout) as { removed?: string };
    assert.ok(body.removed);
    assert.ok(!existsSync(runDir));
  });

  it("cleanup does not claim it cleared a missing live.pid", () => {
    const runId = trackRunId(`test-cleanup-honest-${Date.now()}`);
    assert.equal(runCli(["prepare", "--run-id", runId]).status, 0);
    const cleanup = runCli(["cleanup", "--run-id", runId]);
    assert.equal(cleanup.status, 0, cleanup.stderr);
    const body = JSON.parse(cleanup.stdout) as { cleared: string | null };
    assert.equal(body.cleared, null);
  });

  it("hashes the dist tree and verifier inputs", () => {
    const distIndex = path.join(repoRoot, "dist", "index.js");
    if (existsSync(distIndex)) {
      assert.notEqual(distHash(repoRoot), sha256(readFileSync(distIndex)));
    }
    assert.equal(sourceFingerprint(repoRoot).length, 64);
  });
});
