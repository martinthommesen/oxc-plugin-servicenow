import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { readPackageJson, repoRoot } from "./integration/helpers.js";

function declarationFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...declarationFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".d.mts")) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

// @lat: [[tests#Scripts and tooling#Scripts are checked JavaScript with no separate declarations]]
describe("scripts type gate (FINDINGS.md MNT-005)", () => {
  it("keeps JSDoc-typed scripts as the single source of truth", () => {
    const pkg = readPackageJson();
    assert.ok(
      pkg.scripts["validate"]?.includes("npm run typecheck:scripts"),
      "validate must run the scripts type gate",
    );
    assert.match(pkg.scripts["typecheck:scripts"] ?? "", /tsc --noEmit -p tsconfig\.scripts\.json/);
    const project = JSON.parse(
      readFileSync(path.join(repoRoot, "tsconfig.scripts.json"), "utf8"),
    ) as { compilerOptions: { checkJs: boolean }; include: string[] };
    assert.equal(project.compilerOptions.checkJs, true);
    assert.ok(project.include.some((pattern) => pattern.includes("scripts/")));
  });

  it("has no separate declaration files under scripts/", () => {
    assert.deepEqual(declarationFiles(path.join(repoRoot, "scripts")), []);
  });
});
