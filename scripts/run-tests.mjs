import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const searchArgs = process.argv.slice(2);
const searchRoots =
  searchArgs.length > 0
    ? searchArgs.map((entry) => join(root, entry))
    : [join(root, "tests")];

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

const child = spawn(process.execPath, [tsxCli, "--test", ...files], {
  stdio: "inherit",
  cwd: root,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
