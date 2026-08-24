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
async function collectTestFiles(dir, out) {
  let info;
  try {
    info = await stat(dir);
  } catch {
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

const files = [];
for (const searchRoot of searchRoots) {
  await collectTestFiles(searchRoot, files);
}
files.sort();

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
