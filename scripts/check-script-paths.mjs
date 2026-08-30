// Asserts that every file a package.json script references is tracked by
// git, so a clean checkout can run its own quality gates. Added after three
// required configuration files were left untracked (FINDINGS.md OPS-001).
// Zero dependencies: the workflow CI job runs this without `npm ci`.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tracked = new Set(
  execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean),
);

// lint:check relies on oxlint's automatic discovery of .oxlintrc.json, so
// the file never appears as a script argument.
const referenced = new Set([".oxlintrc.json"]);
for (const command of Object.values(pkg.scripts)) {
  const parts = command.split(/\s+/).map((part) => part.replace(/^['"]|['"]$/g, ""));
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if ((part === "-c" || part === "-p") && parts[i + 1]) {
      referenced.add(parts[i + 1].replace(/^['"]|['"]$/g, ""));
    } else if (/\.(mjs|json|ts)$/.test(part) && !part.includes("*") && !part.startsWith("-")) {
      referenced.add(part);
    }
  }
}

// Workflow-only helpers (publish, verify, benchmark gate) never appear in a
// package.json script, so an untracked file under scripts/ would pass the
// reference check and fail only at tag push, after the immutable tag exists.
// Assert the whole directory is tracked instead of deriving the workflow
// reference graph (FINDINGS.md OPS-010).
const scriptsDir = fileURLToPath(new URL(".", import.meta.url));
const untracked = [];
for (const entry of readdirSync(scriptsDir, { withFileTypes: true, recursive: true })) {
  if (!entry.isFile()) continue;
  const absolute = join(entry.parentPath, entry.name);
  const relative = absolute.slice(scriptsDir.length - "scripts/".length);
  if (!tracked.has(relative)) untracked.push(relative);
}
if (untracked.length > 0) {
  console.error("scripts/ contains untracked files:");
  for (const path of untracked) console.error(`  ${path}`);
  process.exit(1);
}

const missing = [...referenced]
  .map((path) => path.replace(/^\.\//, ""))
  .filter((path) => !tracked.has(path));
if (missing.length > 0) {
  console.error("package.json scripts reference untracked paths:");
  for (const path of missing) console.error(`  ${path}`);
  process.exit(1);
}
console.log(`script paths: ${referenced.size} referenced, all tracked`);
