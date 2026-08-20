import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { repoRoot } from "./helpers.js";

const oxfmtBin = path.join(repoRoot, "node_modules", ".bin", "oxfmt");
const configPath = path.join(repoRoot, "oxfmt.recommended.json");
const fixtures = [
  path.join(repoRoot, "tests/integration/profiles/oxfmt/sample.br.js"),
  path.join(repoRoot, "tests/integration/profiles/oxfmt/sample.now.ts"),
];

describe("oxfmt host integration", () => {
  it("formats classic and Fluent fixtures with the shipped preset", () => {
    if (!existsSync(oxfmtBin)) {
      assert.fail("oxfmt is not installed. Add it as a devDependency so host formatting can run.");
    }
    const stdout = execFileSync(oxfmtBin, ["-c", configPath, "--check", ...fixtures], {
      encoding: "utf8",
      cwd: repoRoot,
    });
    assert.equal(typeof stdout, "string");
  });
});
