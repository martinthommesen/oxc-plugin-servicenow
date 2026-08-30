#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyOxfmtProof,
  classifyOxlintProof,
  interpretGitStatus,
  parseOxlintStdout,
  runHostProcess,
} from "./lib/host-verifier.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_FROM_SCRIPT = path.resolve(SCRIPT_DIR, "..");
const PROJECTS_PATH = path.join(SCRIPT_DIR, "verify-projects.json");
const ARTIFACT_REL = path.join("artifacts", "verify-oxc-plugin-servicenow");
const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SOURCE_SUFFIXES = [".js", ".ts"];

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function jsonBody(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function parseRunId(value) {
  if (!value || !RUN_ID_RE.test(value) || value === "." || value === ".." || value.includes("..")) {
    throw new Error(`invalid run id: ${value ?? "(empty)"}`);
  }
  return value;
}

export function containedPath(base, dest) {
  const resolvedBase = path.resolve(base);
  const resolvedDest = path.resolve(dest);
  const rel = path.relative(resolvedBase, resolvedDest);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`${resolvedDest} escapes ${resolvedBase}`);
  }
  return resolvedDest;
}

function assertNotSymlink(target) {
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    throw new Error(`refusing symlink ${target}`);
  }
}

function mkdirExclusive(dir) {
  assertNotSymlink(dir);
  mkdirSync(dir, { recursive: false });
}

function listFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) listFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function hasSourceFile(dir) {
  return listFiles(dir).some((file) => SOURCE_SUFFIXES.some((suffix) => file.endsWith(suffix)));
}

function repoRelative(repoRoot, abs) {
  const rel = path.relative(repoRoot, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`${abs} is outside the repository`);
  }
  return rel.split(path.sep).join("/");
}

export function loadAndValidateProjects(repoRoot = REPO_FROM_SCRIPT) {
  const raw = readJson(PROJECTS_PATH);
  if (!raw?.projects || typeof raw.projects !== "object" || !raw.oxfmtConfig || !raw.skillDir) {
    throw new Error("verify-projects.json is missing projects, oxfmtConfig, or skillDir");
  }
  const errors = [];
  const oxfmtConfig = path.join(repoRoot, raw.oxfmtConfig);
  if (path.isAbsolute(raw.oxfmtConfig) || raw.oxfmtConfig.includes("..")) {
    errors.push(`oxfmtConfig must be a contained relative path: ${raw.oxfmtConfig}`);
  }
  if (!existsSync(oxfmtConfig)) errors.push(`missing ${raw.oxfmtConfig}`);
  const skillDir = path.join(repoRoot, raw.skillDir);
  const seenFeatures = new Set();
  const projects = {};
  for (const [name, spec] of Object.entries(raw.projects)) {
    if (!spec?.dir || !spec.feature || !Array.isArray(spec.invalidExpected)) {
      errors.push(`${name} needs dir, feature, and invalidExpected`);
      continue;
    }
    if (path.isAbsolute(spec.dir) || spec.dir.includes("..")) {
      errors.push(`${name}.dir must be a contained relative path`);
      continue;
    }
    const dir = path.join(repoRoot, spec.dir);
    const config = path.join(dir, ".oxlintrc.json");
    const valid = path.join(dir, "valid");
    const invalid = path.join(dir, "invalid");
    const featurePath = path.join(skillDir, "features", `${spec.feature}.md`);
    for (const [label, target] of [
      ["dir", dir],
      ["config", config],
      ["valid", valid],
      ["invalid", invalid],
      ["feature", featurePath],
    ]) {
      if (!existsSync(target)) errors.push(`${name} missing ${label}: ${target}`);
    }
    if (existsSync(valid) && !hasSourceFile(valid))
      errors.push(`${name} valid tree has no source files`);
    if (existsSync(invalid) && !hasSourceFile(invalid)) {
      errors.push(`${name} invalid tree has no source files`);
    }
    if (seenFeatures.has(spec.feature)) errors.push(`duplicate feature ${spec.feature}`);
    seenFeatures.add(spec.feature);
    const rules = new Set();
    for (const expectation of spec.invalidExpected) {
      if (!expectation?.rule?.startsWith("servicenow/")) {
        errors.push(`${name} expected rule must start with servicenow/`);
      }
      const key = `${expectation.rule}\0${expectation.file ?? ""}\0${expectation.minCount ?? 1}`;
      if (rules.has(key)) errors.push(`${name} has a duplicate expectation`);
      rules.add(key);
    }
    if (existsSync(config)) {
      const configJson = readJson(config);
      const plugins = Array.isArray(configJson.jsPlugins) ? configJson.jsPlugins : [];
      const matches = plugins.filter((plugin) => plugin?.name === "servicenow");
      if (matches.length !== 1) {
        errors.push(`${name} must have exactly one jsPlugins entry named servicenow`);
      }
    }
    projects[name] = {
      name,
      dir: spec.dir,
      feature: spec.feature,
      config: repoRelative(repoRoot, config),
      valid: repoRelative(repoRoot, valid),
      invalid: repoRelative(repoRoot, invalid),
      invalidExpected: spec.invalidExpected,
    };
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    oxfmtConfig: raw.oxfmtConfig,
    skillDir: raw.skillDir,
    projects,
    names: Object.keys(projects),
  };
}

export function findRepo(start = REPO_FROM_SCRIPT) {
  let dir = start;
  while (true) {
    const pkgPath = path.join(dir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = readJson(pkgPath);
      if (pkg.name === "oxc-plugin-servicenow") return { root: dir, pkg };
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("Run from the oxc-plugin-servicenow checkout.");
    dir = parent;
  }
}

function hashTree(repoRoot, relDir, suffixes) {
  const abs = path.join(repoRoot, relDir);
  const files = listFiles(abs)
    .filter((file) => suffixes.some((suffix) => file.endsWith(suffix)))
    .map((file) => repoRelative(repoRoot, file))
    .sort();
  const hash = createHash("sha256");
  for (const rel of files) {
    hash.update(rel);
    hash.update(readFileSync(path.join(repoRoot, rel)));
  }
  return hash.digest("hex");
}

export function sourceFingerprint(repoRoot) {
  return sha256(
    [
      hashTree(repoRoot, "src", [".ts"]),
      sha256(readFileSync(path.join(repoRoot, "package.json"))),
      sha256(readFileSync(PROJECTS_PATH)),
    ].join("\n"),
  );
}

export function distHash(repoRoot) {
  const distIndex = path.join(repoRoot, "dist", "index.js");
  if (!existsSync(distIndex)) throw new Error("dist/index.js is missing. Run npm run build.");
  return sha256(readFileSync(distIndex));
}

function gitCommit(repoRoot) {
  const result = runHostProcess({
    bin: "git",
    args: ["rev-parse", "HEAD"],
    cwd: repoRoot,
    timeoutMs: 15_000,
  });
  if (result.status !== 0 || result.error) {
    throw new Error(result.stderr || result.error?.message || "git rev-parse failed");
  }
  return result.stdout.trim();
}

export function examplesGit(repoRoot) {
  const result = runHostProcess({
    bin: "git",
    args: ["status", "--porcelain", "--", "examples"],
    cwd: repoRoot,
    timeoutMs: 15_000,
  });
  const state = interpretGitStatus(result);
  return { ...state, hash: sha256(state.detail) };
}

function artifactBase(repoRoot) {
  return path.join(repoRoot, ARTIFACT_REL);
}

export function runDirFor(repoRoot, runId) {
  return containedPath(
    artifactBase(repoRoot),
    path.join(artifactBase(repoRoot), parseRunId(runId)),
  );
}

function readManifest(runDir) {
  const manifestPath = path.join(runDir, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`missing run manifest: ${manifestPath}`);
  return readJson(manifestPath);
}

function writeJson(file, value) {
  writeFileSync(file, jsonBody(value));
}

function writeCompleted(dir) {
  writeFileSync(path.join(dir, "COMPLETED"), "1\n");
}

function servicenowPlugin(config) {
  const plugins = Array.isArray(config.jsPlugins) ? config.jsPlugins : [];
  const matches = plugins.filter((plugin) => plugin?.name === "servicenow");
  if (matches.length !== 1) {
    throw new Error("expected exactly one jsPlugins entry named servicenow");
  }
  return matches[0];
}

function rewriteConfig(sourceConfigPath, distIndex) {
  const config = readJson(sourceConfigPath);
  servicenowPlugin(config).specifier = distIndex;
  return config;
}

function installedVersion(repoRoot, name) {
  return readJson(path.join(repoRoot, "node_modules", name, "package.json")).version;
}

function meetsEngine(nodeVersion, engine) {
  const need = /^>=(\d+)\.(\d+)\.(\d+)$/.exec(engine);
  const have = /^v?(\d+)\.(\d+)\.(\d+)/.exec(nodeVersion);
  if (!need || !have) return false;
  const cmp = [1, 2, 3].map((index) => Number(have[index]) - Number(need[index]));
  return cmp[0] !== 0 ? cmp[0] > 0 : cmp[1] !== 0 ? cmp[1] > 0 : cmp[2] >= 0;
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function writeLivePid(runDir) {
  writeFileSync(path.join(runDir, "live.pid"), `${process.pid}\n`);
}

function clearLivePid(runDir) {
  const file = path.join(runDir, "live.pid");
  if (existsSync(file)) rmSync(file);
}

function requireFreshFingerprints(repoRoot, manifest) {
  const source = sourceFingerprint(repoRoot);
  const dist = distHash(repoRoot);
  if (source !== manifest.sourceFingerprint) {
    throw new Error("source fingerprint changed. Run prepare again.");
  }
  if (dist !== manifest.distHash) {
    throw new Error("dist/index.js hash changed. Run prepare again.");
  }
}

function requireDoctor(runDir, manifest) {
  if (!manifest.doctorCompleted || !existsSync(path.join(runDir, "doctor", "COMPLETED"))) {
    throw new Error("doctor has not completed for this run.");
  }
}

function requireGitMatch(repoRoot, manifest, noncanonical) {
  const commit = gitCommit(repoRoot);
  const git = examplesGit(repoRoot);
  if (commit !== manifest.gitCommit) {
    throw new Error("git commit changed. Run prepare again.");
  }
  if (git.kind === "error") throw new Error(`git status failed: ${git.detail}`);
  if (!noncanonical && git.kind === "dirty") {
    throw new Error(`examples/ is dirty:\n${git.detail}`);
  }
  if (!noncanonical && git.hash !== manifest.examplesGit.hash) {
    throw new Error("examples/ git state changed. Run prepare again.");
  }
  return git;
}

function requireReadyRun(repoRoot, runDir, manifest, noncanonical) {
  requireDoctor(runDir, manifest);
  requireFreshFingerprints(repoRoot, manifest);
  return requireGitMatch(repoRoot, manifest, noncanonical);
}

function recordExamplesMutation(repoRoot, before, proof, noncanonical) {
  if (!noncanonical && examplesGit(repoRoot).hash !== before.hash) {
    proof.ok = false;
    proof.reasons.push("examples/ changed during the drive");
  }
}

function persistAttempt(dir, files) {
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const target = path.join(dir, name);
    assertNotSymlink(target);
    writeFileSync(target, body);
  }
  writeCompleted(dir);
}

function persistHostAttempt(dir, argv, host, summary) {
  persistAttempt(dir, {
    "argv.json": jsonBody(argv),
    "stdout.txt": host.stdout,
    "stderr.txt": host.stderr,
    "execution.json": jsonBody({
      status: host.status,
      signal: host.signal,
      error: host.error,
      timedOut: host.timedOut,
      durationMs: host.durationMs,
      argv: host.argv,
    }),
    "summary.json": jsonBody(summary),
  });
}

function pluginLoadCheck(repoRoot, projects, doctorDir) {
  const spec = projects.projects.fluent;
  const effective = rewriteConfig(
    path.join(repoRoot, spec.config),
    path.join(repoRoot, "dist", "index.js"),
  );
  const configPath = path.join(doctorDir, "plugin-load.oxlintrc.json");
  writeJson(configPath, effective);
  const host = runHostProcess({
    bin: path.join(repoRoot, "node_modules", ".bin", "oxlint"),
    args: ["--format", "json", "-c", configPath, path.join(repoRoot, spec.valid)],
    cwd: repoRoot,
  });
  writeJson(path.join(doctorDir, "plugin-load.execution.json"), {
    status: host.status,
    signal: host.signal,
    error: host.error,
    stdout: host.stdout,
    stderr: host.stderr,
  });
  const parsed = parseOxlintStdout(host.stdout);
  return classifyOxlintProof({
    tree: "valid",
    status: host.status,
    report: parsed.report,
    parseError: parsed.parseError,
    host,
    expectations: [],
  });
}

function doctorChecks(repoRoot, pkg, manifest, projects, doctorDir) {
  const checks = [];
  const pass = (id, detail) => checks.push({ id, ok: true, detail });
  const fail = (id, detail) => checks.push({ id, ok: false, detail });
  if (!pkg.engines?.node || !meetsEngine(process.versions.node, pkg.engines.node)) {
    fail("node-engine", `Need Node ${pkg.engines?.node}. Have ${process.version}.`);
  } else {
    pass("node-engine", process.version);
  }
  try {
    pass("dist", distHash(repoRoot));
  } catch (error) {
    fail("dist", error instanceof Error ? error.message : String(error));
  }
  for (const tool of ["oxlint", "oxfmt"]) {
    const bin = path.join(repoRoot, "node_modules", ".bin", tool);
    if (!existsSync(bin)) {
      fail(tool, `${tool} is missing. Run npm install.`);
      continue;
    }
    const printed = runHostProcess({ bin, args: ["--version"], cwd: repoRoot, timeoutMs: 15_000 });
    const installed = installedVersion(repoRoot, tool);
    if (printed.status !== 0 || !printed.stdout.includes(installed)) {
      fail(tool, `Expected ${installed}. Got ${printed.stdout.trim() || printed.stderr}`);
    } else {
      pass(tool, printed.stdout.trim());
    }
  }
  const git = examplesGit(repoRoot);
  if (git.kind === "error") fail("examples-clean", git.detail);
  else if (git.kind === "dirty") fail("examples-clean", git.detail);
  else pass("examples-clean", "examples/ is clean");
  if (manifest) {
    try {
      requireFreshFingerprints(repoRoot, manifest);
      pass("fingerprint", "source and dist hashes match the run manifest");
    } catch (error) {
      fail("fingerprint", error instanceof Error ? error.message : String(error));
    }
  }
  if (projects.projects.fluent && existsSync(path.join(repoRoot, "dist", "index.js"))) {
    try {
      const proof = pluginLoadCheck(repoRoot, projects, doctorDir);
      if (!proof.ok) fail("plugin-load", proof.reasons.join("; "));
      else pass("plugin-load", "fluent valid has no plugin diagnostics");
    } catch (error) {
      fail("plugin-load", error instanceof Error ? error.message : String(error));
    }
  }
  return checks;
}

function formatDoctorLine(check) {
  return `${check.ok ? "OK" : "FAIL"} ${check.id}: ${check.detail}`;
}

function createAttemptDir(runDir, label) {
  const attemptId = `attempt-${randomUUID()}`;
  const dir = containedPath(runDir, path.join(runDir, attemptId));
  mkdirExclusive(dir);
  writeFileSync(path.join(dir, "label.txt"), `${label}\n`);
  return { attemptId, dir };
}

function driveLint(repoRoot, projects, project, tree, runDir, manifest, argv, noncanonical) {
  const spec = projects.projects[project];
  if (!spec) throw new Error(`Unknown project ${project}`);
  if (tree !== "valid" && tree !== "invalid") throw new Error(`Tree must be valid or invalid`);
  const initialExamplesGit = requireReadyRun(repoRoot, runDir, manifest, noncanonical);
  const { attemptId, dir } = createAttemptDir(runDir, `${project}-${tree}`);
  const host = {
    argv: [],
    status: null,
    signal: null,
    stdout: "",
    stderr: "",
    error: null,
    timedOut: false,
    durationMs: 0,
  };
  let report = null;
  let parseError = null;
  let effective = null;
  try {
    effective = rewriteConfig(
      path.join(repoRoot, spec.config),
      path.join(repoRoot, "dist", "index.js"),
    );
    writeJson(path.join(dir, "effective.oxlintrc.json"), effective);
    const spawned = runHostProcess({
      bin: path.join(repoRoot, "node_modules", ".bin", "oxlint"),
      args: [
        "--format",
        "json",
        "-c",
        path.join(dir, "effective.oxlintrc.json"),
        path.join(repoRoot, spec[tree]),
      ],
      cwd: repoRoot,
    });
    Object.assign(host, spawned);
    const parsed = parseOxlintStdout(host.stdout);
    report = parsed.report;
    parseError = parsed.parseError;
  } catch (error) {
    host.error = { message: error instanceof Error ? error.message : String(error) };
  }
  const proof = classifyOxlintProof({
    tree,
    status: host.status,
    report,
    parseError,
    host,
    expectations: tree === "invalid" ? spec.invalidExpected : [],
  });
  recordExamplesMutation(repoRoot, initialExamplesGit, proof, noncanonical);
  persistHostAttempt(dir, argv, host, {
    project,
    tree,
    feature: spec.feature,
    attemptId,
    ok: proof.ok,
    reasons: proof.reasons,
    pluginRules: proof.pluginRules,
    expectations: tree === "invalid" ? spec.invalidExpected : [],
    noncanonical,
    gitCommit: manifest.gitCommit,
    distHash: manifest.distHash,
    invocation: argv,
  });
  if (report) {
    writeFileSync(
      path.join(dir, "stdout.json"),
      host.stdout.endsWith("\n") ? host.stdout : `${host.stdout}\n`,
    );
  }
  return { ok: proof.ok, dir, attemptId, proof };
}

function driveOxfmt(repoRoot, projects, project, runDir, manifest, argv, noncanonical) {
  const initialExamplesGit = requireReadyRun(repoRoot, runDir, manifest, noncanonical);
  if (project !== "all" && !projects.projects[project])
    throw new Error(`Unknown project ${project}`);
  const { attemptId, dir } = createAttemptDir(runDir, `${project}-oxfmt`);
  const targets =
    project === "all"
      ? projects.names.map((name) => path.join(repoRoot, projects.projects[name].valid))
      : [path.join(repoRoot, projects.projects[project].valid)];
  const host = runHostProcess({
    bin: path.join(repoRoot, "node_modules", ".bin", "oxfmt"),
    args: ["-c", path.join(repoRoot, projects.oxfmtConfig), "--check", ...targets],
    cwd: repoRoot,
  });
  const proof = classifyOxfmtProof(host);
  recordExamplesMutation(repoRoot, initialExamplesGit, proof, noncanonical);
  persistHostAttempt(dir, argv, host, {
    project,
    tree: "oxfmt",
    feature: "oxfmt-recommended",
    attemptId,
    ok: proof.ok,
    reasons: proof.reasons,
    noncanonical,
    invocation: argv,
  });
  return { ok: proof.ok, dir, attemptId, proof };
}

function prepareRun(repoRoot, runId) {
  const base = artifactBase(repoRoot);
  mkdirSync(base, { recursive: true });
  const runDir = runDirFor(repoRoot, runId);
  mkdirExclusive(runDir);
  writeLivePid(runDir);
  try {
    const build = runHostProcess({
      bin: "npm",
      args: ["run", "build"],
      cwd: repoRoot,
      timeoutMs: 120_000,
    });
    writeJson(path.join(runDir, "build.execution.json"), {
      status: build.status,
      signal: build.signal,
      error: build.error,
      stdout: build.stdout,
      stderr: build.stderr,
    });
    if (build.status !== 0 || build.error) {
      throw new Error(build.stderr || build.error?.message || "npm run build failed");
    }
    const git = examplesGit(repoRoot);
    if (git.kind === "error") throw new Error(`git status failed: ${git.detail}`);
    if (git.kind === "dirty") throw new Error(`examples/ is dirty:\n${git.detail}`);
    const manifest = {
      runId,
      repoRoot,
      gitCommit: gitCommit(repoRoot),
      examplesGit: git,
      sourceFingerprint: sourceFingerprint(repoRoot),
      distHash: distHash(repoRoot),
      versions: {
        node: process.version,
        oxlint: installedVersion(repoRoot, "oxlint"),
        oxfmt: installedVersion(repoRoot, "oxfmt"),
      },
      doctorCompleted: false,
      createdAt: new Date().toISOString(),
    };
    writeJson(path.join(runDir, "manifest.json"), manifest);
    return { runDir, manifest };
  } catch (error) {
    clearLivePid(runDir);
    throw error;
  }
}

function runDoctor(repoRoot, pkg, projects, runDir, manifest) {
  const doctorDir = path.join(runDir, "doctor");
  mkdirSync(doctorDir, { recursive: true });
  const checks = doctorChecks(repoRoot, pkg, manifest, projects, doctorDir);
  writeFileSync(path.join(doctorDir, "doctor.txt"), `${checks.map(formatDoctorLine).join("\n")}\n`);
  writeJson(path.join(doctorDir, "doctor.json"), checks);
  const ok = checks.every((check) => check.ok);
  if (ok) {
    manifest.doctorCompleted = true;
    writeJson(path.join(runDir, "manifest.json"), manifest);
    writeCompleted(doctorDir);
  }
  return { ok, checks };
}

function usage() {
  console.error(`Usage:
  npm run verify:examples -- --all
  npm run verify:examples -- prepare [--run-id <id>]
  npm run verify:examples -- doctor --run-id <id>
  npm run verify:examples -- --project <name> --tree <valid|invalid|oxfmt> [--run-id <id>]
  npm run verify:examples -- validate
  npm run verify:examples -- cleanup --run-id <id>`);
}

function parseArgs(argv) {
  const options = {
    all: false,
    command: null,
    project: null,
    tree: null,
    runId: process.env.VERIFY_RUN_ID ?? null,
    noncanonical: false,
    argv,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    switch (part) {
      case "--all":
        options.all = true;
        break;
      case "--project":
        options.project = argv[++index];
        break;
      case "--tree":
        options.tree = argv[++index];
        break;
      case "--run-id":
        options.runId = argv[++index];
        break;
      case "--noncanonical":
        options.noncanonical = true;
        break;
      case "prepare":
      case "doctor":
      case "validate":
      case "cleanup":
        options.command = part;
        break;
      default:
        throw new Error(`unknown argument: ${part}`);
    }
  }
  return options;
}

export function main(argv) {
  const { root, pkg } = findRepo();
  const options = parseArgs(argv);
  if (options.command === "validate") {
    const projects = loadAndValidateProjects(root);
    const skillPath = path.join(root, projects.skillDir, "SKILL.md");
    const markdown = readFileSync(skillPath, "utf8");
    if (!/^name:\s*verify-oxc-plugin-servicenow\s*$/m.test(markdown)) {
      throw new Error("SKILL.md is missing name verify-oxc-plugin-servicenow");
    }
    console.log(JSON.stringify({ ok: true, projects: projects.names }, null, 2));
    return 0;
  }
  const projects = loadAndValidateProjects(root);
  if (options.command === "cleanup") {
    const runDir = runDirFor(root, parseRunId(options.runId));
    const pidFile = path.join(runDir, "live.pid");
    if (existsSync(pidFile)) {
      const pid = Number(readFileSync(pidFile, "utf8").trim());
      if (Number.isInteger(pid) && processAlive(pid)) {
        throw new Error(`run ${options.runId} has a live process ${pid}`);
      }
      rmSync(pidFile);
    }
    console.log(JSON.stringify({ ok: true, cleared: pidFile, evidenceKept: runDir }, null, 2));
    return 0;
  }

  if (options.command === "prepare" || options.all) {
    const runId = parseRunId(options.runId ?? `run-${Date.now()}`);
    const { runDir, manifest } = prepareRun(root, runId);
    try {
      const doctor = runDoctor(root, pkg, projects, runDir, manifest);
      for (const check of doctor.checks) console.error(formatDoctorLine(check));
      if (!doctor.ok) return 1;
      if (options.command === "prepare") {
        console.log(JSON.stringify({ ok: true, runId, runDir }, null, 2));
        return 0;
      }
      const results = [];
      for (const name of projects.names) {
        results.push(
          driveLint(root, projects, name, "valid", runDir, manifest, argv, options.noncanonical),
        );
        results.push(
          driveLint(root, projects, name, "invalid", runDir, manifest, argv, options.noncanonical),
        );
        results.push(
          driveOxfmt(root, projects, name, runDir, manifest, argv, options.noncanonical),
        );
      }
      results.push(driveOxfmt(root, projects, "all", runDir, manifest, argv, options.noncanonical));
      const ok = results.every((result) => result.ok);
      writeJson(path.join(runDir, "run-summary.json"), {
        runId,
        ok,
        attempts: results.map((result) => ({
          dir: result.dir,
          ok: result.ok,
          reasons: result.proof.reasons,
        })),
      });
      writeCompleted(runDir);
      console.log(
        JSON.stringify(
          { ok, runId, runDir, failed: results.filter((result) => !result.ok).length },
          null,
          2,
        ),
      );
      return ok ? 0 : 1;
    } finally {
      clearLivePid(runDir);
    }
  }

  if (options.command === "doctor") {
    const runDir = runDirFor(root, parseRunId(options.runId));
    const manifest = readManifest(runDir);
    const doctor = runDoctor(root, pkg, projects, runDir, manifest);
    for (const check of doctor.checks) console.error(formatDoctorLine(check));
    return doctor.ok ? 0 : 1;
  }

  if (options.project && options.tree) {
    const runId = parseRunId(options.runId ?? `run-${Date.now()}`);
    let runDir;
    let manifest;
    let ownsLivePid = false;
    if (existsSync(path.join(runDirFor(root, runId), "manifest.json"))) {
      runDir = runDirFor(root, runId);
      manifest = readManifest(runDir);
    } else {
      ({ runDir, manifest } = prepareRun(root, runId));
      ownsLivePid = true;
      const doctor = runDoctor(root, pkg, projects, runDir, manifest);
      for (const check of doctor.checks) console.error(formatDoctorLine(check));
      if (!doctor.ok) {
        clearLivePid(runDir);
        return 1;
      }
    }
    try {
      const result =
        options.tree === "oxfmt"
          ? driveOxfmt(
              root,
              projects,
              options.project,
              runDir,
              manifest,
              argv,
              options.noncanonical,
            )
          : driveLint(
              root,
              projects,
              options.project,
              options.tree,
              runDir,
              manifest,
              argv,
              options.noncanonical,
            );
      console.log(
        JSON.stringify(
          { ok: result.ok, evidence: result.dir, reasons: result.proof.reasons },
          null,
          2,
        ),
      );
      return result.ok ? 0 : 1;
    } finally {
      if (ownsLivePid) clearLivePid(runDir);
    }
  }

  usage();
  return 2;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
