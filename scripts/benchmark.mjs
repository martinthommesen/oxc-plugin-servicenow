import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertBenchmarkFixtureSet,
  checkBenchmarkRegression,
  validateBenchmarkSummary,
  validateOxlintProcessResult,
} from "./benchmark-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const oxlintBin = join(root, "node_modules", ".bin", "oxlint");
const writeBaseline = process.argv.includes("--write");
const warmup = 1;
const samples = 10;

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? resolve(process.argv[index + 1]) : fallback;
}

function glideRecordBlock(index) {
  return `var rec${index} = new GlideRecord("incident");
rec${index}.addQuery("active", true);
rec${index}.query();
while (rec${index}.next()) {
  gs.info(rec${index}.getValue("number"));
}
`;
}

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

function nestedDoWhile(depth) {
  // The PER-002 reproduction shape: nesting once doubled the cursor-loop
  // walkers' traversals per level, so this fixture keeps the exponential
  // visible to the gate (FINDINGS.md PER-002).
  let body = glideRecordBlock(0);
  for (let index = 0; index < depth; index += 1) {
    body = `do {\n${body}} while (flag${index});\n`;
  }
  return body;
}

function nestedScopes(depth) {
  let body = 'var rec = new GlideRecord("incident");\nrec.query();\nrec.next();\n';
  for (let index = 0; index < depth; index += 1) {
    body = `function nest${index}() {\n${body}}\nnest${index}();\n`;
  }
  return body;
}

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

function generateFixtures(directory) {
  for (const child of ["classic", "fluent", "client", "mixed/src/server", "mixed/src/fluent"]) {
    mkdirSync(join(directory, child), { recursive: true });
  }
  const repeat = process.env.SN_BENCH_INJECT_REPEAT === "1" ? 3 : 1;
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
  writeFileSync(join(directory, "classic/nested.br.js"), nestedScopes(12));
  writeFileSync(join(directory, "classic/nested-do-while.br.js"), nestedDoWhile(30));
  writeFileSync(join(directory, "fluent/large.now.ts"), fluentRecords(80));
  writeFileSync(join(directory, "client/skip.client.js"), 'g_form.setValue("priority", "1");\n');
  writeFileSync(join(directory, "mixed/src/server/list.br.js"), glideRecordBlock(1));
  writeFileSync(join(directory, "mixed/src/fluent/table.now.ts"), fluentRecords(1));
}

function readPeakRssKb(pid) {
  try {
    if (platform() === "linux") {
      const match = /^VmHWM:\s+(\d+)\s+kB$/m.exec(readFileSync(`/proc/${pid}/status`, "utf8"));
      return match ? Number(match[1]) : 0;
    }
    if (platform() === "darwin") {
      return (
        Number(
          execFileSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" }).trim(),
        ) || 0
      );
    }
  } catch {
    return 0;
  }
  return 0;
}

function measure(configPath, targets) {
  const args = [oxlintBin, "--format", "json", "-c", configPath, ...targets];
  return new Promise((resolvePromise, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(process.execPath, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let peakRssKb = 0;
    const poll = setInterval(() => {
      if (child.pid) peakRssKb = Math.max(peakRssKb, readPeakRssKb(child.pid));
    }, 10);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      clearInterval(poll);
      reject(error);
    });
    child.on("close", (status, signal) => {
      clearInterval(poll);
      if (child.pid) peakRssKb = Math.max(peakRssKb, readPeakRssKb(child.pid));
      try {
        validateOxlintProcessResult({ status, signal, stdout, stderr });
        if (peakRssKb <= 0) throw new Error("required peak RSS metric is unavailable");
        resolvePromise({
          elapsedMs: Number(process.hrtime.bigint() - started) / 1e6,
          peakRssKb,
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function runCase(fixture, profile, configPath, targets) {
  for (let index = 0; index < warmup; index += 1) await measure(configPath, targets);
  const rawSamples = [];
  for (let index = 0; index < samples; index += 1)
    rawSamples.push(await measure(configPath, targets));
  return {
    fixture,
    profile,
    elapsedMs: Math.round(median(rawSamples.map((sample) => sample.elapsedMs))),
    peakRssKb: Math.round(median(rawSamples.map((sample) => sample.peakRssKb))),
    rawSamples,
  };
}

async function main() {
  const baselinePath = argument("--baseline", join(root, "docs/performance-baseline.json"));
  const outputPath = argument("--output", join(root, "artifacts/performance-current.json"));
  const work = join(tmpdir(), `sn-oxc-bench-${process.pid}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  try {
    execFileSync("npm", ["run", "build"], { cwd: root, encoding: "utf8", stdio: "inherit" });
    generateFixtures(work);
    const recommended = JSON.parse(
      readFileSync(
        join(root, "tests/integration/profiles/configs/recommended.oxlintrc.json"),
        "utf8",
      ),
    ).rules;
    const strict = JSON.parse(
      readFileSync(join(root, "tests/integration/profiles/configs/strict.oxlintrc.json"), "utf8"),
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
      ["classic-large/all", "all", configs.all, [join(work, "classic/large.br.js")]],
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
        "nested-do-while/recommended",
        "recommended",
        configs.recommended,
        [join(work, "classic/nested-do-while.br.js")],
      ],
      [
        "fluent-large/recommended",
        "recommended",
        configs.recommended,
        [join(work, "fluent/large.now.ts")],
      ],
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
    const baseline = validateBenchmarkSummary(JSON.parse(readFileSync(baselinePath, "utf8")));
    const summary = {
      date: new Date().toISOString().slice(0, 10),
      node: process.version,
      npm: execFileSync("npm", ["--version"], { cwd: root, encoding: "utf8" }).trim(),
      oxlint: JSON.parse(readFileSync(join(root, "node_modules/oxlint/package.json"), "utf8"))
        .version,
      plugin: JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version,
      cpu: cpus()[0]?.model ?? "unknown",
      platform: platform(),
      arch: arch(),
      commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
      command: `npm run bench -- --baseline ${baselinePath} --output ${outputPath}`,
      baseline: baselinePath,
      warmup,
      samples,
      statistic: "median",
      regression: baseline.regression,
      scale: Number((large.elapsedMs / small.elapsedMs).toFixed(2)),
      results,
    };
    validateBenchmarkSummary(summary, { requireRawSamples: true });
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
    for (const row of results)
      console.log(`${row.fixture} ${row.profile} ${row.elapsedMs}ms rss=${row.peakRssKb}KB`);
    console.log(`scale small->large recommended: ${summary.scale}x`);
    console.log(`wrote current benchmark ${outputPath}`);
    checkBenchmarkRegression(results, baseline);
    if (writeBaseline) {
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
  const failurePath = join(root, "artifacts/performance-failure.json");
  mkdirSync(dirname(failurePath), { recursive: true });
  writeFileSync(
    failurePath,
    `${JSON.stringify({ date: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`,
  );
  throw error;
}
