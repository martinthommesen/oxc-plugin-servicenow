// Asserts that every file a package.json script references is tracked by
// git, so a clean checkout can run its own quality gates. Added after three
// required configuration files were left untracked (FINDINGS.md OPS-001).
// Zero dependencies: the workflow CI job runs this without `npm ci`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

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

const missing = [...referenced].filter((path) => !tracked.has(path));
if (missing.length > 0) {
  console.error("package.json scripts reference untracked paths:");
  for (const path of missing) console.error(`  ${path}`);
  process.exit(1);
}
console.log(`script paths: ${referenced.size} referenced, all tracked`);
