import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const oxlintBin = join(root, "node_modules", ".bin", "oxlint");
const writeBaseline = process.argv.includes("--write");
const warmup = 1;
const samples = 3;

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
}
if (alias${index}.next()) {
  gs.info(alias${index}.getValue("number"));
}
`;
}

function fluentRecord(index) {
  return `import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-state-${index}"],
  table: "incident",
  name: "Log state ${index}",
  when: "after",
  action: ["update"],
});
`;
}

function nestedScopes(depth) {
  let body = 'var rec = new GlideRecord("incident");\nrec.query();\nrec.next();\n';
  for (let i = 0; i < depth; i += 1) {
    body = `function nest${i}() {\n${body}}\nnest${i}();\n`;
  }
  return body;
}

function writeConfig(dir, rules, jsPlugins) {
  mkdirSync(dir, { recursive: true });
  const config = {
    jsPlugins: jsPlugins
      ? [{ name: "servicenow", specifier: root }]
      : [],
    settings: { servicenow: { scopePrefix: "x_acme" } },
    rules,
  };
  const path = join(dir, ".oxlintrc.json");
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  return path;
}

function generateFixtures(dir) {
  mkdirSync(join(dir, "classic"), { recursive: true });
  mkdirSync(join(dir, "fluent"), { recursive: true });
  mkdirSync(join(dir, "client"), { recursive: true });
  mkdirSync(join(dir, "mixed", "src", "server"), { recursive: true });
  mkdirSync(join(dir, "mixed", "src", "fluent"), { recursive: true });
  writeFileSync(join(dir, "classic", "small.br.js"), Array.from({ length: 20 }, (_, i) => glideRecordBlock(i)).join("\n"));
  writeFileSync(join(dir, "classic", "medium.br.js"), Array.from({ length: 80 }, (_, i) => glideRecordBlock(i)).join("\n"));
  writeFileSync(join(dir, "classic", "large.br.js"), Array.from({ length: 200 }, (_, i) => glideRecordBlock(i)).join("\n"));
  writeFileSync(join(dir, "classic", "branch-heavy.br.js"), Array.from({ length: 80 }, (_, i) => branchHeavyBlock(i)).join("\n"));
  writeFileSync(join(dir, "classic", "nested.br.js"), nestedScopes(12));
  writeFileSync(join(dir, "fluent", "large.now.ts"), Array.from({ length: 80 }, (_, i) => fluentRecord(i)).join("\n"));
  writeFileSync(join(dir, "client", "skip.client.js"), 'g_form.setValue("priority", "1");\n');
  writeFileSync(join(dir, "mixed", "src", "server", "list.br.js"), glideRecordBlock(1));
  writeFileSync(join(dir, "mixed", "src", "fluent", "table.now.ts"), fluentRecord(1));
}

function readPeakRssKb(pid) {
  try {
    const status = readFileSync(`/proc/${pid}/status`, "utf8");
    const match = /^VmHWM:\s+(\d+)\s+kB$/m.exec(status);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

function measure(configPath, targets) {
  const args = [oxlintBin, "--format", "json", "-c", configPath, ...targets];
  return new Promise((resolve, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let peakRssKb = 0;
    const poll = setInterval(() => {
      if (child.pid) {
        peakRssKb = Math.max(peakRssKb, readPeakRssKb(child.pid));
      }
    }, 10);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearInterval(poll);
      reject(error);
    });
    child.on("close", (status) => {
      clearInterval(poll);
      if (child.pid) {
        peakRssKb = Math.max(peakRssKb, readPeakRssKb(child.pid));
      }
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      if (!stdout.includes("{") && status !== 0) {
        reject(new Error(`oxlint failed (${status}): ${stderr || stdout}`));
        return;
      }
      resolve({ elapsedMs, peakRssKb });
    });
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function runCase(name, configPath, targets) {
  for (let i = 0; i < warmup; i += 1) await measure(configPath, targets);
  const runs = [];
  for (let i = 0; i < samples; i += 1) {
    runs.push(await measure(configPath, targets));
  }
  return {
    fixture: name,
    elapsedMs: Math.round(median(runs.map((run) => run.elapsedMs))),
    peakRssKb: Math.round(median(runs.map((run) => run.peakRssKb))),
  };
}

function ensureBuilt() {
  try {
    readFileSync(join(root, "dist/index.js"));
  } catch {
    execFileSync("npm", ["run", "build"], { cwd: root, encoding: "utf8", stdio: "inherit" });
  }
}

ensureBuilt();
const work = join(tmpdir(), `sn-oxc-bench-${process.pid}`);
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
generateFixtures(work);

const recommended = JSON.parse(
  readFileSync(join(root, "tests/integration/profiles/configs/recommended.oxlintrc.json"), "utf8"),
).rules;
const strict = JSON.parse(
  readFileSync(join(root, "tests/integration/profiles/configs/strict.oxlintrc.json"), "utf8"),
).rules;
const oneRule = { "servicenow/require-query-before-next": "error" };

const disabledConfig = writeConfig(join(work, "disabled"), {}, false);
const oneRuleConfig = writeConfig(join(work, "one-rule"), oneRule, true);
const recommendedConfig = writeConfig(join(work, "recommended"), recommended, true);
const allConfig = writeConfig(join(work, "all"), strict, true);

const results = [
  { ...(await runCase("classic-small/disabled", disabledConfig, [join(work, "classic/small.br.js")])), profile: "disabled" },
  { ...(await runCase("classic-small/one-rule", oneRuleConfig, [join(work, "classic/small.br.js")])), profile: "one-rule" },
  { ...(await runCase("classic-small/recommended", recommendedConfig, [join(work, "classic/small.br.js")])), profile: "recommended" },
  { ...(await runCase("classic-medium/recommended", recommendedConfig, [join(work, "classic/medium.br.js")])), profile: "recommended" },
  { ...(await runCase("classic-large/recommended", recommendedConfig, [join(work, "classic/large.br.js")])), profile: "recommended" },
  { ...(await runCase("classic-large/all", allConfig, [join(work, "classic/large.br.js")])), profile: "all" },
  { ...(await runCase("branch-heavy/recommended", recommendedConfig, [join(work, "classic/branch-heavy.br.js")])), profile: "recommended" },
  { ...(await runCase("nested-scopes/recommended", recommendedConfig, [join(work, "classic/nested.br.js")])), profile: "recommended" },
  { ...(await runCase("fluent-large/recommended", recommendedConfig, [join(work, "fluent/large.now.ts")])), profile: "recommended" },
  { ...(await runCase("skip-client/recommended", recommendedConfig, [join(work, "client/skip.client.js")])), profile: "recommended" },
  { ...(await runCase("mixed/recommended", recommendedConfig, [join(work, "mixed")])), profile: "recommended" },
];

const small = results.find((row) => row.fixture === "classic-small/recommended");
const large = results.find((row) => row.fixture === "classic-large/recommended");
const scale = small && large && small.elapsedMs > 0 ? large.elapsedMs / small.elapsedMs : 0;

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const oxlintPkg = JSON.parse(readFileSync(join(root, "node_modules/oxlint/package.json"), "utf8"));
const summary = {
  date: new Date().toISOString().slice(0, 10),
  node: process.version,
  oxlint: oxlintPkg.version,
  plugin: pkg.version,
  cpu: cpus()[0]?.model ?? "unknown",
  command: "npm run bench",
  warmup,
  samples,
  statistic: "median",
  regression: {
    elapsedMultiplier: 2.5,
    elapsedFloorMs: 500,
    rssMultiplier: 2,
    rssFloorKb: 50000,
    maxScale: 20,
    maxRecommendedLargeMs: 15000,
  },
  scale: Number(scale.toFixed(2)),
  results,
};

for (const row of results) {
  console.log(`${row.fixture} ${row.profile} ${row.elapsedMs}ms rss=${row.peakRssKb}KB`);
}
console.log(`scale small->large recommended: ${summary.scale}x`);

if (large && large.elapsedMs >= summary.regression.maxRecommendedLargeMs) {
  throw new Error(`classic-large/recommended exceeded ${summary.regression.maxRecommendedLargeMs}ms (${large.elapsedMs}ms)`);
}
if (summary.scale > summary.regression.maxScale) {
  throw new Error(`recommended scale ${summary.scale} exceeded ${summary.regression.maxScale}`);
}

const baselinePath = join(root, "docs/performance-baseline.json");
if (writeBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log("wrote", baselinePath);
} else {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  for (const row of results) {
    const previous = (baseline.results ?? []).find((item) => item.fixture === row.fixture);
    if (!previous) continue;
    const elapsedLimit =
      Math.max(previous.elapsedMs * baseline.regression.elapsedMultiplier, previous.elapsedMs) +
      baseline.regression.elapsedFloorMs;
    if (row.elapsedMs > elapsedLimit) {
      throw new Error(`${row.fixture} elapsed ${row.elapsedMs}ms exceeded ${elapsedLimit}ms`);
    }
    if (previous.peakRssKb > 0 && row.peakRssKb > 0) {
      const rssLimit = Math.max(previous.peakRssKb * baseline.regression.rssMultiplier, previous.peakRssKb) +
        baseline.regression.rssFloorKb;
      if (row.peakRssKb > rssLimit) {
        throw new Error(`${row.fixture} RSS ${row.peakRssKb}KB exceeded ${rssLimit}KB`);
      }
    }
  }
}

rmSync(work, { recursive: true, force: true });
