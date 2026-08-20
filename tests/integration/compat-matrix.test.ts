import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parseNpmPackJson } from "../../scripts/parse-npm-pack.mjs";
import { repoRoot } from "./helpers.js";

describe("compatibility matrix", () => {
  it("matches declared package ranges", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      engines: { node: string };
      peerDependencies: Record<string, string>;
      dependencies: Record<string, string>;
    };
    const matrix = JSON.parse(readFileSync(path.join(repoRoot, "scripts/compat-matrix.json"), "utf8")) as {
      node: { engines: string; minimum: string; currentLts: string; current: string };
      oxlint: { peer: string; minimum: string; latestCompatible: string };
      eslint: { peer: string; minimum: string };
      oxfmt: { peer: string; minimum: string; latest: string };
      oxlintPlugins: { dependency: string };
      cells: Array<{ id: string; node: string; oxlint: string; eslint: string; oxfmt: string }>;
    };
    assert.equal(matrix.node.engines, pkg.engines.node);
    assert.equal(matrix.oxlint.peer, pkg.peerDependencies.oxlint);
    assert.equal(matrix.eslint.peer, pkg.peerDependencies.eslint);
    assert.equal(matrix.oxfmt.peer, pkg.peerDependencies.oxfmt);
    assert.equal(matrix.oxlintPlugins.dependency, pkg.dependencies["@oxlint/plugins"]);
    assert.ok(matrix.cells.some((cell) => cell.oxlint === matrix.oxlint.minimum));
    assert.ok(matrix.cells.some((cell) => cell.eslint === matrix.eslint.minimum));
    assert.ok(matrix.cells.some((cell) => cell.oxfmt === matrix.oxfmt.minimum));
    assert.notEqual(matrix.node.currentLts, matrix.node.minimum);
    assert.notEqual(matrix.node.current, matrix.node.currentLts);
    assert.ok(matrix.cells.some((cell) => cell.node === matrix.node.current));
    assert.ok(matrix.cells.some((cell) => cell.oxlint === matrix.oxlint.latestCompatible));
    assert.ok(matrix.cells.some((cell) => cell.oxfmt === matrix.oxfmt.latest));
    const docs = readFileSync(path.join(repoRoot, "docs/compatibility.md"), "utf8");
    assert.ok(docs.includes(matrix.oxlint.minimum));
    assert.ok(docs.includes(matrix.eslint.minimum));
    assert.ok(docs.includes(matrix.oxfmt.latest ?? ""));
  });

  it("parses legacy npm pack arrays and npm 12 package-keyed output", () => {
    const record = { filename: "oxc-plugin-servicenow-2.0.0.tgz", name: "oxc-plugin-servicenow" };
    assert.deepEqual(parseNpmPackJson(JSON.stringify([record])), record);
    assert.deepEqual(
      parseNpmPackJson(JSON.stringify({ "oxc-plugin-servicenow": record })),
      record,
    );
  });

  it("rejects malformed or ambiguous npm pack output", () => {
    assert.throws(() => parseNpmPackJson("not json"), /invalid npm pack JSON/);
    assert.throws(() => parseNpmPackJson(JSON.stringify([])), /exactly one/);
    assert.throws(
      () => parseNpmPackJson(JSON.stringify({ a: { filename: "a.tgz" }, b: { filename: "b.tgz" } })),
      /exactly one/,
    );
    assert.throws(() => parseNpmPackJson(JSON.stringify([{ name: "missing filename" }])), /exactly one/);
  });
});
