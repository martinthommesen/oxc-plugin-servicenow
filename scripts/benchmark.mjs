import { execFile, execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import {
  assertBenchmarkFixtureSet,
  checkBenchmarkRegression,
  classifySourceState,
  validateBenchmarkSummary,
  validateOxlintProcessResult,
} from "./benchmark-gate.mjs";
import { argValue } from "./lib/argv.mjs";
import { git } from "./lib/git.mjs";
import { readJson, writeJsonArtifact } from "./lib/json-artifact.mjs";
import { root } from "./lib/repo.mjs";

const oxlintBin = join(root, "node_modules", ".bin", "oxlint");
const writeBaseline = process.argv.includes("--write");
const warmup = 1;
const samples = 10;

/**
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
function argument(name, fallback) {
  const value = argValue(process.argv, name, () => {
    throw new Error(`missing value for ${name}`);
  });
  return value === undefined ? fallback : resolve(value);
}

/**
 * @param {number} index
 * @returns {string}
 */
function glideRecordBlock(index) {
  return `var rec${index} = new GlideRecord("incident");
rec${index}.addQuery("active", true);
rec${index}.query();
while (rec${index}.next()) {
  gs.info(rec${index}.getValue("number"));
}
`;
}

/**
 * @param {number} index
 * @returns {string}
 */
function branchHeavyBlock(index) {
  return `var rec${index} = new GlideRecord("incident");
var alias${index} = rec${index};
if (flag${index}) {
  alias${index}.addQuery("active", true);
} else {
  gs.info("keep identity");
}
try {
  alias${index}.query();
} catch (error${index}) {
  gs.error(error${index});
  throw error${index};
}
if (alias${index}.next()) {
  gs.info(alias${index}.getValue("number"));
}
`;
}

/**
 * @param {number} index
 * @returns {string}
 */
function aclAnalysisBlock(index) {
  return `var aclRec${index} = new GlideRecord("incident");
var aclAlias${index} = aclRec${index};
if (flag${index}) {
  aclAlias${index}.addQuery("active", true);
} else {
  gs.info("keep identity");
}
try {
  gs.info(aclAlias${index}.getValue("number"));
} catch (error${index}) {
  gs.error(error${index});
}
`;
}

/**
 * @param {number} count
 * @returns {string}
 */
function fluentRecords(count) {
  const records = Array.from(
    { length: count },
    (_, index) => `BusinessRule({
  $id: Now.ID["log-state-${index}"],
  table: "incident",
  name: "Log state ${index}",
  when: "after",
  action: ["update"],
});`,
  );
  return `import { BusinessRule } from "@servicenow/sdk/core";\n\n${records.join("\n\n")}\n`;
}

/**
 * Fluent factory calls through mutable aliases. Every call site resolves its
 * callee through the per-file write index (FINDINGS.md PER-005); removing a
 * `$id` must report once per call.
 *
 * @param {number} count
 * @returns {string}
 */
function fluentAliases(count) {
  const aliases = Array.from({ length: count }, (_, index) => `let br${index} = BusinessRule;`);
  const calls = Array.from(
    { length: count },
    (_, index) => `br${index}({
  $id: Now.ID["alias-${index}"],
  table: "incident",
  name: "Alias ${index}",
  when: "after",
  action: ["update"],
});`,
  );
  return `import { BusinessRule } from "@servicenow/sdk/core";\n\n${aliases.join("\n")}\n\n${calls.join("\n\n")}\n`;
}

/**
 * Cursor-count loops with a write after each loop. The trailing write keeps
 * the fixture diagnostic-free while the counter declaration and use scans
 * still run per loop (FINDINGS.md PER-005); removing it must report once per
 * loop.
 *
 * @param {number} count
 * @returns {string}
 */
function counterBlocks(count) {
  const blocks = [];
  for (let index = 0; index < count; index += 1) {
    blocks.push(`var rec${index} = new GlideRecord("incident");
rec${index}.addQuery("active", true);
rec${index}.query();
var count${index} = 0;
while (rec${index}.next()) {
  count${index} += 1;
}
count${index} += 1;
`);
  }
  return blocks.join("\n");
}

/**
 * @param {number} depth
 * @returns {string}
 */
function nestedScopes(depth) {
  let body = 'var rec = new GlideRecord("incident");\nrec.query();\nrec.next();\n';
  for (let index = 0; index < depth; index += 1) {
    body = `function nest${index}() {\n${body}}\nnest${index}();\n`;
  }
  return body;
}

/**
 * @param {string} directory
 * @param {Record<string, unknown>} rules
 * @param {boolean} jsPlugins
 * @returns {string}
 */
function writeConfig(directory, rules, jsPlugins) {
  mkdirSync(directory, { recursive: true });
  const config = {
    jsPlugins: jsPlugins ? [{ name: "servicenow", specifier: root }] : [],
    settings: { servicenow: { scopePrefix: "x_acme" } },
    rules,
  };
  const file = join(directory, ".oxlintrc.json");
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  return file;
}

/**
 * @param {string} directory
 * @returns {void}
 */
function generateFixtures(directory) {
  for (const child of ["classic", "fluent", "client", "mixed/src/server", "mixed/src/fluent"]) {
    mkdirSync(join(directory, child), { recursive: true });
  }
  const repeat = process.env["SN_BENCH_INJECT_REPEAT"] === "1" ? 3 : 1;
  writeFileSync(
    join(directory, "classic/small.br.js"),
    Array.from({ length: 20 }, (_, index) => glideRecordBlock(index)).join("\n"),
  );
  writeFileSync(
    join(directory, "classic/medium.br.js"),
    Array.from({ length: 80 }, (_, index) => glideRecordBlock(index)).join("\n"),
  );
  writeFileSync(
    join(directory, "classic/large.br.js"),
    Array.from({ length: 200 * repeat }, (_, index) => glideRecordBlock(index)).join("\n"),
  );
  writeFileSync(
    join(directory, "classic/branch-heavy.br.js"),
    Array.from({ length: 80 }, (_, index) => branchHeavyBlock(index)).join("\n"),
  );
  writeFileSync(
    join(directory, "classic/large.acl.js"),
    Array.from({ length: 200 * repeat }, (_, index) => aclAnalysisBlock(index)).join("\n"),
  );
  writeFileSync(join(directory, "classic/nested.br.js"), nestedScopes(12));
  writeFileSync(join(directory, "fluent/large.now.ts"), fluentRecords(80));
  writeFileSync(join(directory, "fluent/aliases.now.ts"), fluentAliases(120));
  writeFileSync(join(directory, "classic/counters.br.js"), counterBlocks(40));
  writeFileSync(join(directory, "client/skip.client.js"), 'g_form.setValue("priority", "1");\n');
  writeFileSync(join(directory, "mixed/src/server/list.br.js"), glideRecordBlock(1));
  writeFileSync(join(directory, "mixed/src/fluent/table.now.ts"), fluentRecords(1));
}

/**
 * Sample one process's resident memory without blocking the event loop: a
 * synchronous `ps` every poll interval delays the child's stdout and inflates
 * the elapsed time this run is measuring.
 *
 * @param {number} pid
 * @returns {Promise<number>}
 */
function readPeakRssKb(pid) {
  if (platform() === "linux") {
    try {
      const match = /^VmHWM:\s+(\d+)\s+kB$/m.exec(readFileSync(`/proc/${pid}/status`, "utf8"));
      return Promise.resolve(match ? Number(match[1]) : 0);
    } catch {
      return Promise.resolve(0);
    }
  }
  if (platform() !== "darwin") return Promise.resolve(0);
  return new Promise((resolveSample) => {
    execFile("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" }, (error, stdout) => {
      resolveSample(error ? 0 : Number(stdout.trim()) || 0);
    });
  });
}

/**
 * @param {string} configPath
 * @param {string[]} targets
 * @returns {Promise<{ elapsedMs: number, peakRssKb: number | null }>}
 */
function measure(configPath, targets) {
  const args = [oxlintBin, "--format", "json", "-c", configPath, ...targets];
  return new Promise((resolvePromise, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(process.execPath, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let peakRssKb = 0;
    let elapsedMs = 0;
    let sampling = false;
    const sampleRss = () => {
      if (sampling || !child.pid) return;
      sampling = true;
      void readPeakRssKb(child.pid).then((sample) => {
        peakRssKb = Math.max(peakRssKb, sample);
        sampling = false;
      });
    };
    sampleRss();
    child.once("spawn", sampleRss);
    const poll = setInterval(sampleRss, 10);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      clearInterval(poll);
      reject(error);
    });
    // The child is done working at "exit"; "close" waits for its stdio to
    // drain, which is this process reading, not oxlint running.
    child.on("exit", () => {
      clearInterval(poll);
      elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    });
    child.on("close", (status, signal) => {
      try {
        validateOxlintProcessResult({ status, signal, stdout, stderr });
        resolvePromise({ elapsedMs, peakRssKb: peakRssKb || null });
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * @param {number[]} values
 * @returns {number}
 */
function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * @param {string} fixture
 * @param {string} profile
 * @param {string} configPath
 * @param {string[]} targets
 */
async function runCase(fixture, profile, configPath, targets) {
  for (let index = 0; index < warmup; index += 1) await measure(configPath, targets);
  const rawSamples = [];
  for (let index = 0; index < samples; index += 1)
    rawSamples.push(await measure(configPath, targets));
  const rssSamples = rawSamples
    .map((sample) => sample.peakRssKb)
    .filter((peakRssKb) => peakRssKb !== null);
  if (rssSamples.length === 0)
    throw new Error(`required peak RSS metric is unavailable for ${fixture}`);
  return {
    fixture,
    profile,
    elapsedMs: Math.round(median(rawSamples.map((sample) => sample.elapsedMs))),
    peakRssKb: Math.round(median(rssSamples)),
    rawSamples,
  };
}

/**
 * `git status --porcelain` reports repository-relative POSIX paths, so the
 * run's own artifacts have to be named the same way to be excluded.
 *
 * @param {string} target
 * @returns {string}
 */
function repoRelative(target) {
  return relative(root, target).split(sep).join("/");
}

async function main() {
  const baselinePath = argument("--baseline", join(root, "docs/performance-baseline.json"));
  const outputPath = argument("--output", join(root, "artifacts/performance-current.json"));
  // Captured before the build and the measurements so the run's own outputs,
  // and a `dist` rebuild, cannot change the answer (FINDINGS.md DX-001).
  const source = classifySourceState(
    git(["status", "--porcelain", "-z", "--untracked-files=all"]),
    { ignorePaths: [repoRelative(outputPath), repoRelative(baselinePath)] },
  );
  const work = join(tmpdir(), `sn-oxc-bench-${process.pid}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  try {
    execFileSync("npm", ["run", "build"], { cwd: root, encoding: "utf8", stdio: "inherit" });
    generateFixtures(work);
    const recommended = readJson(
      join(root, "tests/integration/profiles/configs/recommended.oxlintrc.json"),
    ).rules;
    const strict = readJson(
      join(root, "tests/integration/profiles/configs/strict.oxlintrc.json"),
    ).rules;
    const configs = {
      disabled: writeConfig(join(work, "disabled"), {}, false),
      oneRule: writeConfig(
        join(work, "one-rule"),
        { "servicenow/require-query-before-next": "error" },
        true,
      ),
      recommended: writeConfig(join(work, "recommended"), recommended, true),
      all: writeConfig(join(work, "all"), strict, true),
    };
    /** @type {Array<[string, string, string, string[]]>} */
    const cases = [
      ["classic-small/disabled", "disabled", configs.disabled, [join(work, "classic/small.br.js")]],
      ["classic-small/one-rule", "one-rule", configs.oneRule, [join(work, "classic/small.br.js")]],
      [
        "classic-small/recommended",
        "recommended",
        configs.recommended,
        [join(work, "classic/small.br.js")],
      ],
      [
        "classic-medium/recommended",
        "recommended",
        configs.recommended,
        [join(work, "classic/medium.br.js")],
      ],
      [
        "classic-large/recommended",
        "recommended",
        configs.recommended,
        [join(work, "classic/large.br.js")],
      ],
      [
        "classic-large/all",
        "all",
        configs.all,
        [join(work, "classic/large.br.js"), join(work, "classic/large.acl.js")],
      ],
      [
        "branch-heavy/recommended",
        "recommended",
        configs.recommended,
        [join(work, "classic/branch-heavy.br.js")],
      ],
      [
        "nested-scopes/recommended",
        "recommended",
        configs.recommended,
        [join(work, "classic/nested.br.js")],
      ],
      [
        "fluent-large/recommended",
        "recommended",
        configs.recommended,
        [join(work, "fluent/large.now.ts")],
      ],
      [
        "fluent-aliases/recommended",
        "recommended",
        configs.recommended,
        [join(work, "fluent/aliases.now.ts")],
      ],
      ["classic-counters/all", "all", configs.all, [join(work, "classic/counters.br.js")]],
      [
        "skip-client/recommended",
        "recommended",
        configs.recommended,
        [join(work, "client/skip.client.js")],
      ],
      ["mixed/recommended", "recommended", configs.recommended, [join(work, "mixed")]],
    ];
    const results = [];
    for (const benchmarkCase of cases) results.push(await runCase(...benchmarkCase));
    const small = results.find((row) => row.fixture === "classic-small/recommended");
    const large = results.find((row) => row.fixture === "classic-large/recommended");
    if (!small || !large) {
      throw new Error("benchmark results lack the classic-small/classic-large pair");
    }
    const baseline = validateBenchmarkSummary(readJson(baselinePath));
    const summary = {
      date: new Date().toISOString().slice(0, 10),
      node: process.version,
      npm: execFileSync("npm", ["--version"], { cwd: root, encoding: "utf8" }).trim(),
      oxlint: readJson(join(root, "node_modules/oxlint/package.json")).version,
      plugin: readJson(join(root, "package.json")).version,
      cpu: cpus()[0]?.model ?? "unknown",
      platform: platform(),
      arch: arch(),
      commit: git(["rev-parse", "HEAD"]).trim(),
      ...source,
      command: `npm run bench -- --baseline ${repoRelative(baselinePath)} --output ${repoRelative(outputPath)}`,
      // Repo-relative: an absolute path records the author's home directory
      // in a reviewed, committed artifact and is meaningless on any other
      // machine.
      baseline: repoRelative(baselinePath),
      warmup,
      samples,
      statistic: "median",
      regression: baseline.regression,
      scale: Number((large.elapsedMs / small.elapsedMs).toFixed(2)),
      results,
    };
    validateBenchmarkSummary(summary, { requireRawSamples: true, requireSourceState: true });
    writeJsonArtifact(outputPath, summary);
    for (const row of results)
      console.log(`${row.fixture} ${row.profile} ${row.elapsedMs}ms rss=${row.peakRssKb}KB`);
    console.log(`scale small->large recommended: ${summary.scale}x`);
    console.log(`wrote current benchmark ${outputPath}`);
    for (const trend of checkBenchmarkRegression(results, baseline)) {
      console.warn(`performance trend: ${trend}`);
    }
    if (writeBaseline) {
      // Self-compare on purpose: dup-guard the reviewed baseline before
      // overwriting it. A two-set compare would be wrong here since baseline
      // updates legitimately change fixtures.
      assertBenchmarkFixtureSet(results, results);
      writeFileSync(
        join(root, "docs/performance-baseline.json"),
        `${JSON.stringify(summary, null, 2)}\n`,
      );
      console.log("wrote reviewed baseline docs/performance-baseline.json");
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  writeJsonArtifact(join(root, "artifacts/performance-failure.json"), {
    date: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
