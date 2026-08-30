import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { repoRoot } from "./helpers.js";

const oxfmtBin = path.join(repoRoot, "node_modules", ".bin", "oxfmt");
const configPath = path.join(repoRoot, "oxfmt.recommended.json");
const fixtures = [
  path.join(repoRoot, "tests/integration/profiles/oxfmt/sample.br.js"),
  path.join(repoRoot, "tests/integration/profiles/oxfmt/sample.now.ts"),
  path.join(repoRoot, "tests/integration/profiles/oxfmt/read.access.control.js"),
  path.join(repoRoot, "tests/integration/profiles/oxfmt/access_control/read.js"),
  path.join(repoRoot, "tests/integration/profiles/oxfmt/accesscontroller.js"),
  path.join(repoRoot, "tests/integration/profiles/oxfmt/sys_security_aclanything.js"),
];
const exampleProjects = Object.keys(
  (
    JSON.parse(readFileSync(path.join(repoRoot, "scripts/verify-projects.json"), "utf8")) as {
      projects: Record<string, unknown>;
    }
  ).projects,
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return entry.isFile() && (file.endsWith(".js") || file.endsWith(".ts")) ? [file] : [];
  });
}

describe("oxfmt host integration", () => {
  it("formats fixtures and every example valid tree with the shipped preset", () => {
    if (!existsSync(oxfmtBin)) {
      assert.fail("oxfmt is not installed. Add it as a devDependency so host formatting can run.");
    }
    const examples = exampleProjects.flatMap((project) =>
      sourceFiles(path.join(repoRoot, "examples", project, "valid")),
    );
    assert.ok(examples.some((file) => file.endsWith(".client.ui-action.js")));
    assert.ok(examples.some((file) => file.endsWith(".ui-action.js")));
    const stdout = execFileSync(oxfmtBin, ["-c", configPath, "--check", ...fixtures, ...examples], {
      encoding: "utf8",
      cwd: repoRoot,
    });
    assert.equal(typeof stdout, "string");
  });
});
