import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsxRegistration = new URL("./register-tsx.mjs", import.meta.url).href;
const args = process.argv.slice(2);
const reportIndex = args.indexOf("--report-json");
let reportJson;
if (reportIndex !== -1) {
  const value = args[reportIndex + 1];
  if (!value || value.startsWith("-")) {
    console.error("--report-json requires a path");
    process.exit(1);
  }
  reportJson = isAbsolute(value) ? value : join(process.cwd(), value);
  mkdirSync(dirname(reportJson), { recursive: true });
  args.splice(reportIndex, 2);
}
const searchArgs = args;
const searchRoots =
  searchArgs.length > 0 ? searchArgs.map((entry) => join(root, entry)) : [join(root, "tests")];

/**
 * Collect `*.test.ts` files without relying on Node 22 glob expansion.
 * Node 20's test runner treats a quoted `**` path as a literal filename.
 */
async function collectTestFiles(dir, out, named = false) {
  let info;
  try {
    info = await stat(dir);
  } catch {
    // A path named on the command line that does not resolve must fail the
    // run: silently skipping it lets a script report green while testing
    // less than it names (FINDINGS.md TST-003).
    if (named) {
      console.error(`Named test path does not exist: ${dir}`);
      process.exit(1);
    }
    return;
  }
  if (info.isFile()) {
    if (dir.endsWith(".test.ts")) out.push(dir);
    return;
  }
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectTestFiles(path, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      out.push(path);
    }
  }
}

const collected = [];
for (const searchRoot of searchRoots) {
  await collectTestFiles(searchRoot, collected, searchArgs.length > 0);
}
// A file can be collected twice when it is both inside a directory argument
// and named explicitly to opt back into the networked run.
const files = [...new Set(collected)].sort();

// The packed-consumer test resolves and installs packages from the live npm
// registry, so the default suite excludes it to stay hermetic and offline
// (FINDINGS.md OPS-004). Run it with `npm run test:consumer`; CI and the
// release workflow run it as their own jobs.
const NETWORKED_TESTS = [join(root, "tests/integration/packed-consumer.test.ts")];
// The exclusion applies to the default suite and to directory arguments
// alike, so `test:integration` stays offline as documented; only naming the
// networked file itself opts in (FINDINGS.md TST-003).
const explicitlyNamed = new Set(searchRoots);
for (const networked of NETWORKED_TESTS) {
  if (explicitlyNamed.has(networked)) continue;
  const index = files.indexOf(networked);
  if (index !== -1) files.splice(index, 1);
}

if (files.length === 0) {
  console.error(`No *.test.ts files found under ${searchRoots.join(", ")}`);
  process.exit(1);
}

// Release/packed integration tests build and inspect the ignored dist tree. Keep
// test files serial so a test-side build cannot race an Oxlint subprocess in
// another file and expose a half-written module graph.
const reporterArgs = reportJson
  ? [
      "--test-reporter=spec",
      "--test-reporter-destination=stdout",
      `--test-reporter=${join(root, "scripts/test-json-reporter.mjs")}`,
      `--test-reporter-destination=${reportJson}`,
    ]
  : [];
const child = spawn(
  process.execPath,
  ["--import", tsxRegistration, "--test", "--test-concurrency=1", ...reporterArgs, ...files],
  {
    stdio: "inherit",
    cwd: root,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
