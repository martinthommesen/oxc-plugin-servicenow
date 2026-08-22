import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { repoRoot } from "./helpers.js";

describe("compatibility matrix", () => {
  it("matches declared package ranges", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      engines: { node: string };
      peerDependencies: Record<string, string>;
      dependencies: Record<string, string>;
    };
    const matrix = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts/compat-matrix.json"), "utf8"),
    ) as {
      node: { engines: string; minimum: string; supported: string[] };
      oxlint: { peer: string; minimum: string; highestCompatible: string };
      eslint: { peer: string; minimum: string };
      oxfmt: { peer: string; minimum: string; highestCompatible: string };
      oxlintPlugins: { dependency: string };
      typescriptEslint: { minimum: string; current: string };
      typescript: { minimum: string; current: string };
      fluentSdk: string[];
      localSmokeCell: string;
      cells: Array<{
        id: string;
        node: string;
        npm: string;
        oxlint: string;
        eslint: string;
        oxfmt: string;
        typescriptEslint?: string;
        typescript?: string;
      }>;
    };
    assert.equal(matrix.node.engines, pkg.engines.node);
    assert.equal(matrix.oxlint.peer, pkg.peerDependencies.oxlint);
    assert.equal(matrix.eslint.peer, pkg.peerDependencies.eslint);
    assert.equal(matrix.oxfmt.peer, pkg.peerDependencies.oxfmt);
    assert.equal(matrix.oxlintPlugins.dependency, pkg.dependencies["@oxlint/plugins"]);
    assert.ok(matrix.cells.some((cell) => cell.oxlint === matrix.oxlint.minimum));
    assert.ok(matrix.cells.some((cell) => cell.eslint === matrix.eslint.minimum));
    assert.ok(matrix.cells.some((cell) => cell.oxfmt === matrix.oxfmt.minimum));
    assert.deepEqual(
      new Set(matrix.cells.map((cell) => cell.node)),
      new Set(matrix.node.supported),
    );
    assert.ok(matrix.cells.some((cell) => cell.oxlint === matrix.oxlint.highestCompatible));
    assert.ok(matrix.cells.some((cell) => cell.oxfmt === matrix.oxfmt.highestCompatible));
    assert.ok(
      matrix.cells.some((cell) => cell.typescriptEslint === matrix.typescriptEslint.minimum),
    );
    assert.ok(
      matrix.cells.some((cell) => cell.typescriptEslint === matrix.typescriptEslint.current),
    );
    assert.ok(matrix.cells.some((cell) => cell.typescript === matrix.typescript.minimum));
    assert.ok(matrix.cells.some((cell) => cell.typescript === matrix.typescript.current));
    assert.equal(matrix.fluentSdk.length, 27);
    assert.equal(matrix.localSmokeCell, "node24-host");
    assert.ok(matrix.fluentSdk.includes("4.10.1"));
    assert.ok(
      matrix.cells.every((cell) =>
        Object.values(cell).every((value) => value !== "latest" && value !== "current"),
      ),
    );
    const docs = readFileSync(path.join(repoRoot, "docs/compatibility.md"), "utf8");
    assert.ok(docs.includes(matrix.oxlint.minimum));
    assert.ok(docs.includes(matrix.eslint.minimum));
    assert.ok(docs.includes(matrix.oxfmt.highestCompatible));
  });
});
