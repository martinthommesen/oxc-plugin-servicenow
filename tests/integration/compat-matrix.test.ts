import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parseNpmPackJson } from "../../scripts/parse-npm-pack.mjs";
import { repoRoot } from "./helpers.js";
import { checkCompatibilityMatrix } from "../../scripts/check-compat-matrix.mjs";

describe("compatibility matrix", () => {
  it("keeps CI and release consumer cells sourced from the matrix", () => {
    const result = checkCompatibilityMatrix();
    assert.equal(result.cells, 5);
    assert.deepEqual(
      result.matrix.include.map((cell) => cell.node),
      ["20.19.0", "22.14.0", "24.16.0", "26.7.0", "24.16.0"],
    );
  });

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

  it("parses legacy npm pack arrays and npm 12 package-keyed output", () => {
    const record = { filename: "oxc-plugin-servicenow-2.0.0.tgz", name: "oxc-plugin-servicenow" };
    assert.deepEqual(parseNpmPackJson(JSON.stringify([record])), record);
    assert.deepEqual(parseNpmPackJson(JSON.stringify({ "oxc-plugin-servicenow": record })), record);
  });

  it("rejects malformed or ambiguous npm pack output", () => {
    assert.throws(() => parseNpmPackJson("not json"), /invalid npm pack JSON/);
    assert.throws(() => parseNpmPackJson(JSON.stringify([])), /exactly one/);
    assert.throws(
      () =>
        parseNpmPackJson(JSON.stringify({ a: { filename: "a.tgz" }, b: { filename: "b.tgz" } })),
      /exactly one/,
    );
    assert.throws(
      () => parseNpmPackJson(JSON.stringify([{ name: "missing filename" }])),
      /exactly one/,
    );
    for (const filename of ["../outside.tgz", "/tmp/outside.tgz", "-option.tgz", "bad name.tgz"]) {
      assert.throws(() => parseNpmPackJson(JSON.stringify([{ filename }])), /unsafe/);
    }
  });
});
