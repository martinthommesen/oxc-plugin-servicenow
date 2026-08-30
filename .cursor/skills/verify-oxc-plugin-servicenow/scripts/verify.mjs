#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEMP_PREFIX = "sn-verify-oxlint-";
const SKILL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS_PATH = path.join(SKILL_DIR, "projects.json");

function findRepo() {
  let dir = SKILL_DIR;
  while (true) {
    const pkgPath = path.join(dir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (pkg.name === "oxc-plugin-servicenow") return { root: dir, pkg };
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("Run from the oxc-plugin-servicenow checkout.");
    }
    dir = parent;
  }
}

function loadProjects() {
  const raw = JSON.parse(readFileSync(PROJECTS_PATH, "utf8"));
  if (!raw || typeof raw !== "object" || !raw.lintProjects || !raw.oxfmt) {
    throw new Error("projects.json is missing lintProjects or oxfmt.");
  }
  return raw;
}

function pluginRuleId(code) {
  const wrapped = /^servicenow\((.+)\)$/.exec(code);
  if (wrapped) return `servicenow/${wrapped[1]}`;
  if (code.startsWith("servicenow/")) return code;
  return undefined;
}

function pluginRules(report) {
  const ids = new Set();
  for (const diagnostic of report.diagnostics ?? []) {
    const id = pluginRuleId(diagnostic.code);
    if (id) ids.add(id);
  }
  return [...ids].sort();
}

function parseSemver(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(value));
  if (!match) throw new Error(`Not a semver: ${value}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function meetsEngine(nodeVersion, engine) {
  const need = /^>=(\d+)\.(\d+)\.(\d+)$/.exec(engine);
  if (!need) throw new Error(`Unsupported engines.node: ${engine}`);
  const have = parseSemver(nodeVersion);
  const major = Number(need[1]);
  const minor = Number(need[2]);
  const patch = Number(need[3]);
  if (have.major !== major) return have.major > major;
  if (have.minor !== minor) return have.minor > minor;
  return have.patch >= patch;
}

function runId() {
  return process.env.VERIFY_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
}

function evidenceRoot(repoRoot, id) {
  return path.join(repoRoot, "artifacts", "verify-oxc-plugin-servicenow", id);
}

function writeEvidence(dir, files) {
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), body);
  }
}

function rewriteConfig(sourceConfigPath, distIndex) {
  const config = JSON.parse(readFileSync(sourceConfigPath, "utf8"));
  delete config.$schema;
  const plugin = config.jsPlugins?.[0];
  if (!plugin) throw new Error(`${sourceConfigPath} has no jsPlugins[0].`);
  plugin.specifier = distIndex;
  const directory = mkdtempSync(path.join(tmpdir(), TEMP_PREFIX));
  const configPath = path.join(directory, ".oxlintrc.json");
  writeFileSync(configPath, JSON.stringify(config));
  return { directory, configPath };
}

function spawnTool(bin, args, cwd) {
  return spawnSync(bin, args, { encoding: "utf8", cwd });
}

function runOxlint(repoRoot, configPath, target) {
  const bin = path.join(repoRoot, "node_modules", ".bin", "oxlint");
  const result = spawnTool(bin, ["--format", "json", "-c", configPath, target], repoRoot);
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`oxlint terminated by ${result.signal}`);
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`oxlint exited ${result.status}: ${stderr || stdout}`);
  }
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new Error(`oxlint did not emit JSON.\n${stdout}\n${stderr}`);
  }
  if (!report || !Array.isArray(report.diagnostics)) {
    throw new Error("oxlint JSON has no diagnostics array.");
  }
  const hostFailure = report.diagnostics.find((diagnostic) =>
    /parse|parser|configuration|plugin-load/i.test(diagnostic.code),
  );
  if (hostFailure) {
    throw new Error(`oxlint host diagnostic: ${hostFailure.code}: ${hostFailure.message}`);
  }
  return {
    status: result.status,
    stdout,
    stderr,
    report,
    command: [bin, "--format", "json", "-c", configPath, target].join(" "),
  };
}

function runOxfmt(repoRoot, configPath, targets) {
  const bin = path.join(repoRoot, "node_modules", ".bin", "oxfmt");
  const result = spawnTool(bin, ["-c", configPath, "--check", ...targets], repoRoot);
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`oxfmt terminated by ${result.signal}`);
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    command: [bin, "-c", configPath, "--check", ...targets].join(" "),
  };
}

function sameSet(actual, expected) {
  if (actual.length !== expected.length) return false;
  return actual.every((id, index) => id === expected[index]);
}

function lintProject(repoRoot, projects, name, tree) {
  const spec = projects.lintProjects[name];
  if (!spec) {
    throw new Error(`Unknown project ${name}. Known: ${Object.keys(projects.lintProjects).join(", ")}`);
  }
  if (tree !== "valid" && tree !== "invalid") {
    throw new Error(`Tree must be valid or invalid, got ${tree}`);
  }
  const distIndex = path.join(repoRoot, "dist", "index.js");
  const rewritten = rewriteConfig(path.join(repoRoot, spec.config), distIndex);
  try {
    const result = runOxlint(repoRoot, rewritten.configPath, path.join(repoRoot, spec[tree]));
    const rules = pluginRules(result.report);
    const expected = tree === "valid" ? [] : [...spec.invalidExpectedRules].sort();
    const ok = sameSet(rules, expected);
    return {
      ...result,
      pluginRules: rules,
      expectedRules: expected,
      ok,
    };
  } finally {
    rmSync(rewritten.directory, { recursive: true, force: true });
  }
}

function doctor(repoRoot, pkg, projects) {
  const checks = [];
  const fail = (id, detail) => {
    checks.push({ id, ok: false, detail });
  };
  const pass = (id, detail) => {
    checks.push({ id, ok: true, detail });
  };

  const engine = pkg.engines?.node;
  if (!engine) {
    fail("node-engine", "package.json has no engines.node");
  } else if (!meetsEngine(process.versions.node, engine)) {
    fail("node-engine", `Need Node ${engine}. Have ${process.version}.`);
  } else {
    pass("node-engine", process.version);
  }

  const distIndex = path.join(repoRoot, "dist", "index.js");
  if (!existsSync(distIndex)) {
    fail("dist", "dist/index.js is missing. Run npm run build.");
  } else {
    pass("dist", distIndex);
  }

  const oxlintPkg = path.join(repoRoot, "node_modules", "oxlint", "package.json");
  const oxfmtPkg = path.join(repoRoot, "node_modules", "oxfmt", "package.json");
  const oxlintBin = path.join(repoRoot, "node_modules", ".bin", "oxlint");
  const oxfmtBin = path.join(repoRoot, "node_modules", ".bin", "oxfmt");
  if (!existsSync(oxlintBin) || !existsSync(oxlintPkg)) {
    fail("oxlint", "oxlint is missing. Run npm install.");
  } else {
    const installed = JSON.parse(readFileSync(oxlintPkg, "utf8")).version;
    const printed = spawnTool(oxlintBin, ["--version"], repoRoot).stdout.trim();
    if (!printed.includes(installed)) {
      fail("oxlint", `Expected ${installed}. oxlint --version printed ${printed}.`);
    } else {
      pass("oxlint", printed);
    }
  }
  if (!existsSync(oxfmtBin) || !existsSync(oxfmtPkg)) {
    fail("oxfmt", "oxfmt is missing. Run npm install.");
  } else {
    const installed = JSON.parse(readFileSync(oxfmtPkg, "utf8")).version;
    const printed = spawnTool(oxfmtBin, ["--version"], repoRoot).stdout.trim();
    if (!printed.includes(installed)) {
      fail("oxfmt", `Expected ${installed}. oxfmt --version printed ${printed}.`);
    } else {
      pass("oxfmt", printed);
    }
  }

  if (existsSync(distIndex) && existsSync(oxlintBin)) {
    try {
      const result = lintProject(repoRoot, projects, "fluent", "valid");
      if (!result.ok) {
        fail("plugin-load", `fluent valid reported ${result.pluginRules.join(", ") || "(none)"}`);
      } else {
        pass("plugin-load", "fluent valid has no plugin diagnostics");
      }
    } catch (error) {
      fail("plugin-load", error instanceof Error ? error.message : String(error));
    }
  }

  const dirty = spawnTool("git", ["status", "--porcelain", "--", "examples"], repoRoot);
  if (dirty.status === 0 && dirty.stdout.trim()) {
    checks.push({
      id: "examples-clean",
      ok: true,
      warning: true,
      detail: `examples/ has local changes:\n${dirty.stdout.trim()}`,
    });
  } else {
    pass("examples-clean", "examples/ is clean");
  }

  return checks;
}

function readFrontmatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown);
  if (!match) throw new Error("SKILL.md is missing YAML frontmatter.");
  const name = /^name:\s*(.+)$/m.exec(match[1]);
  const description = /^description:\s*(.+)$/m.exec(match[1]);
  if (!name || !description) throw new Error("SKILL.md frontmatter needs name and description.");
  return { name: name[1].trim(), description: description[1].trim() };
}

function validateSkill(projects) {
  const skillPath = path.join(SKILL_DIR, "SKILL.md");
  const meta = readFrontmatter(readFileSync(skillPath, "utf8"));
  if (meta.name !== "verify-oxc-plugin-servicenow") {
    throw new Error(`SKILL.md name is ${meta.name}`);
  }
  if (!meta.description) throw new Error("SKILL.md description is empty.");
  const required = [
    "SKILL.md",
    "projects.json",
    "scripts/verify.mjs",
    "features/README.md",
    ...projects.mappedFeatures.map((id) => `features/${id}.md`),
  ];
  const missing = required.filter((rel) => !existsSync(path.join(SKILL_DIR, rel)));
  if (missing.length) throw new Error(`Missing ${missing.join(", ")}`);
  return { name: meta.name, files: required };
}

function cleanupTemps() {
  const removed = [];
  for (const name of readdirSync(tmpdir())) {
    if (!name.startsWith(TEMP_PREFIX)) continue;
    const full = path.join(tmpdir(), name);
    rmSync(full, { recursive: true, force: true });
    removed.push(full);
  }
  return removed;
}

function checkMark(check) {
  if (!check.ok) return "FAIL";
  if (check.warning) return "WARN";
  return "OK";
}

function formatDoctorLine(check) {
  return `${checkMark(check)} ${check.id}: ${check.detail}`;
}

function printDoctor(checks) {
  for (const check of checks) {
    console.log(formatDoctorLine(check));
  }
}

function usage() {
  console.error(`Usage:
  node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs doctor
  node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive <project> <valid|invalid|oxfmt>
  node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive all oxfmt
  node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs cleanup
  node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs validate-skill`);
}

function main(argv) {
  const command = argv[0];
  if (!command) {
    usage();
    process.exit(2);
  }

  switch (command) {
    case "doctor": {
      const { root, pkg } = findRepo();
      const projects = loadProjects();
      const checks = doctor(root, pkg, projects);
      printDoctor(checks);
      const id = runId();
      writeEvidence(path.join(evidenceRoot(root, id), "doctor"), {
        "doctor.txt": `${checks.map(formatDoctorLine).join("\n")}\n`,
      });
      process.exit(checks.every((check) => check.ok) ? 0 : 1);
      break;
    }
    case "drive": {
      const project = argv[1];
      const tree = argv[2];
      if (!project || !tree) {
        usage();
        process.exit(2);
      }
      const { root } = findRepo();
      const projects = loadProjects();
      const id = runId();
      if (tree === "oxfmt") {
        if (project !== "all" && !projects.lintProjects[project]) {
          throw new Error(`Unknown project ${project}`);
        }
        const targets =
          project === "all"
            ? projects.oxfmt.targets.map((rel) => path.join(root, rel))
            : [path.join(root, projects.lintProjects[project].valid)];
        const result = runOxfmt(root, path.join(root, projects.oxfmt.config), targets);
        const ok = result.status === 0 && /All matched files use the correct format/.test(result.stdout);
        const dir = path.join(evidenceRoot(root, id), `${project}-oxfmt`);
        writeEvidence(dir, {
          "command.txt": `${result.command}\n`,
          "stdout.txt": result.stdout,
          "stderr.txt": result.stderr,
          "summary.json": `${JSON.stringify({ project, tree, status: result.status, ok }, null, 2)}\n`,
        });
        console.log(JSON.stringify({ project, tree, status: result.status, ok, evidence: dir }, null, 2));
        process.exit(ok ? 0 : 1);
        break;
      }
      const result = lintProject(root, projects, project, tree);
      const dir = path.join(evidenceRoot(root, id), `${project}-${tree}`);
      writeEvidence(dir, {
        "command.txt": `${result.command}\n`,
        "stdout.json": result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`,
        "stderr.txt": result.stderr,
        "summary.json": `${JSON.stringify(
          {
            project,
            tree,
            status: result.status,
            pluginRules: result.pluginRules,
            expectedRules: result.expectedRules,
            ok: result.ok,
          },
          null,
          2,
        )}\n`,
      });
      console.log(
        JSON.stringify(
          {
            project,
            tree,
            status: result.status,
            pluginRules: result.pluginRules,
            expectedRules: result.expectedRules,
            ok: result.ok,
            evidence: dir,
          },
          null,
          2,
        ),
      );
      process.exit(result.ok ? 0 : 1);
      break;
    }
    case "cleanup": {
      const removed = cleanupTemps();
      console.log(JSON.stringify({ removed, evidenceKept: "artifacts/verify-oxc-plugin-servicenow/" }, null, 2));
      process.exit(0);
      break;
    }
    case "validate-skill": {
      const projects = loadProjects();
      const result = validateSkill(projects);
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
      break;
    }
    default: {
      usage();
      process.exit(2);
    }
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
