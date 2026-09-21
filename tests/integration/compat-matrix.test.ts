import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parseNpmPackJson } from "../../scripts/parse-npm-pack.mjs";
import { repoRoot, TSX_CLI_EXECUTION_PATTERN } from "./helpers.js";
import { checkCompatibilityMatrix } from "../../scripts/check-compat-matrix.mjs";
import { SUPPORTED_SERVICENOW_RELEASES } from "../../src/settings/index.js";

function mustParseVersion(value: string): [number, number, number] {
  // Ceilings may be partial ("<11"); missing parts compare as zero.
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(value);
  assert.ok(match, `not a version: ${value}`);
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function compareVersions(left: string, right: string): number {
  const parsedLeft = mustParseVersion(left);
  const parsedRight = mustParseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (parsedLeft[index] !== parsedRight[index]) {
      return (parsedLeft[index] ?? 0) - (parsedRight[index] ?? 0);
    }
  }
  return 0;
}

// Supports the conjunction shapes this package declares: a ">=" floor with an
// optional "<" ceiling.
function satisfiesDeclaredRange(version: string, range: string): boolean {
  const match = /^>=(\S+)(?:\s+<(\S+))?$/.exec(range);
  assert.ok(match, `unsupported range shape: ${range}`);
  if (compareVersions(version, match[1]!) < 0) return false;
  const ceiling = match[2];
  if (ceiling !== undefined && compareVersions(version, ceiling) >= 0) return false;
  return true;
}

function rangeFloor(range: string): string {
  const match = /^>=(\S+)/.exec(range);
  assert.ok(match, `unsupported range shape: ${range}`);
  return match[1]!;
}

describe("compatibility matrix", () => {
  it("keeps CI and release consumer cells sourced from the matrix", () => {
    const result = checkCompatibilityMatrix();
    assert.equal(result.cells, 5);
    assert.deepEqual(
      result.matrix.include.map((cell) => cell.node),
      ["22.12.0", "22.14.0", "24.16.0", "26.7.0", "24.16.0"],
    );
    const workflow = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
    assert.match(workflow, /node scripts\/run-tests\.mjs tests\/utils\/ast\.test\.ts/);
    assert.match(workflow, /node scripts\/compat-consumer\.mjs --cell/);
    assert.doesNotMatch(workflow, TSX_CLI_EXECUTION_PATTERN);
    assert.match(workflow, /compat-advisory:/);
    assert.match(workflow, /node scripts\/compat-consumer\.mjs --top/);
    const advisoryBlock = workflow.slice(
      workflow.indexOf("compat-advisory:"),
      workflow.indexOf("manifest-drift:"),
    );
    assert.ok(
      advisoryBlock.includes("github.event_name == 'schedule'"),
      "the networked advisory job must stay schedule-only",
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
      serviceNowReleases: string[];
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
    assert.equal(matrix.oxlint.peer, pkg.peerDependencies["oxlint"]);
    assert.equal(matrix.eslint.peer, pkg.peerDependencies["eslint"]);
    assert.equal(matrix.oxfmt.peer, pkg.peerDependencies["oxfmt"]);
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
    assert.deepEqual(matrix.serviceNowReleases, SUPPORTED_SERVICENOW_RELEASES);
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
    assert.ok(docs.includes("8.56.0"), "the ESLint 10 parser floor must be documented");
    assert.ok(docs.includes("compat-consumer.mjs --top"), "the advisory job must be documented");
    const releaseRow = docs
      .split("\n")
      .find((line) => line.startsWith("| ServiceNow release knowledge |"));
    assert.ok(releaseRow, "compatibility table is missing the ServiceNow release row");
    const documentedReleases = new Set(releaseRow.split("|")[3]!.trim().split(", "));
    for (const release of matrix.serviceNowReleases) {
      assert.ok(documentedReleases.has(release), `compatibility table is missing ${release}`);
    }
  });

  it("covers every declared range endpoint with a cell (FINDINGS.md OPS-011)", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      engines: { node: string };
      peerDependencies: Record<string, string>;
    };
    const matrix = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts/compat-matrix.json"), "utf8"),
    ) as {
      node: { engines: string; minimum: string };
      oxlint: { peer: string; minimum: string; highestCompatible: string };
      eslint: { peer: string; minimum: string; currentV9: string; current: string };
      oxfmt: { peer: string; minimum: string; highestCompatible: string };
      typescriptEslint: { peer: string; minimum: string; current: string };
      cells: Array<{
        id: string;
        node: string;
        oxlint: string;
        eslint: string;
        oxfmt: string;
        typescriptEslint?: string;
      }>;
    };
    const peers = {
      node: pkg.engines.node,
      oxlint: pkg.peerDependencies["oxlint"]!,
      eslint: pkg.peerDependencies["eslint"]!,
      oxfmt: pkg.peerDependencies["oxfmt"]!,
      typescriptEslint: pkg.peerDependencies["typescript-eslint"]!,
    };
    assert.equal(rangeFloor(peers.node), matrix.node.minimum);
    assert.equal(rangeFloor(peers.oxlint), matrix.oxlint.minimum);
    assert.equal(rangeFloor(peers.eslint), matrix.eslint.minimum);
    assert.equal(rangeFloor(peers.oxfmt), matrix.oxfmt.minimum);
    assert.equal(rangeFloor(peers.typescriptEslint), matrix.typescriptEslint.minimum);
    for (const cell of matrix.cells) {
      assert.ok(
        satisfiesDeclaredRange(cell.node, peers.node),
        `${cell.id} node ${cell.node} escapes ${peers.node}`,
      );
      assert.ok(
        satisfiesDeclaredRange(cell.oxlint, peers.oxlint),
        `${cell.id} oxlint ${cell.oxlint} escapes ${peers.oxlint}`,
      );
      assert.ok(
        satisfiesDeclaredRange(cell.eslint, peers.eslint),
        `${cell.id} eslint ${cell.eslint} escapes ${peers.eslint}`,
      );
      assert.ok(
        satisfiesDeclaredRange(cell.oxfmt, peers.oxfmt),
        `${cell.id} oxfmt ${cell.oxfmt} escapes ${peers.oxfmt}`,
      );
      if (cell.typescriptEslint !== undefined) {
        assert.ok(
          satisfiesDeclaredRange(cell.typescriptEslint, peers.typescriptEslint),
          `${cell.id} typescript-eslint ${cell.typescriptEslint} escapes ${peers.typescriptEslint}`,
        );
      }
    }
    assert.ok(satisfiesDeclaredRange(matrix.oxlint.highestCompatible, peers.oxlint));
    assert.ok(satisfiesDeclaredRange(matrix.oxfmt.highestCompatible, peers.oxfmt));
    assert.ok(satisfiesDeclaredRange(matrix.eslint.currentV9, peers.eslint));
    assert.ok(satisfiesDeclaredRange(matrix.eslint.current, peers.eslint));
    assert.ok(satisfiesDeclaredRange(matrix.typescriptEslint.current, peers.typescriptEslint));
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
