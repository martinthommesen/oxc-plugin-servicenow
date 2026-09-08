import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parseNpmPackJson } from "../../scripts/parse-npm-pack.mjs";
import { repoRoot, TSX_CLI_EXECUTION_PATTERN } from "./helpers.js";
import {
  checkCompatibilityMatrix,
  checkSupportPolicy,
} from "../../scripts/check-compat-matrix.mjs";
import { rangeFloor, rangeTopMajor, satisfiesRange } from "../../scripts/lib/semver-range.mjs";
import { SUPPORTED_SERVICENOW_RELEASES } from "../../src/settings/index.js";

describe("compatibility matrix", () => {
  it("keeps CI and release consumer cells sourced from the matrix", () => {
    const result = checkCompatibilityMatrix();
    assert.equal(result.cells, 5);
    assert.deepEqual(
      result.matrix.include.map((cell) => cell.node),
      ["20.19.0", "22.14.0", "24.16.0", "26.7.0", "24.16.0"],
    );
    const workflow = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
    assert.match(workflow, /node scripts\/run-tests\.mjs tests\/utils\/ast\.test\.ts/);
    assert.match(workflow, /node scripts\/compat-consumer\.mjs --cell/);
    assert.doesNotMatch(workflow, TSX_CLI_EXECUTION_PATTERN);
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
    const releaseRow = docs
      .split("\n")
      .find((line) => line.startsWith("| ServiceNow release knowledge |"));
    assert.ok(releaseRow, "compatibility table is missing the ServiceNow release row");
    const documentedReleases = new Set(releaseRow.split("|")[3]!.trim().split(", "));
    for (const release of matrix.serviceNowReleases) {
      assert.ok(documentedReleases.has(release), `compatibility table is missing ${release}`);
    }
  });

  it("evaluates only the npm range forms the support policy declares", () => {
    assert.equal(satisfiesRange("9.39.5", ">=9.0.0 <11"), true);
    assert.equal(satisfiesRange("11.0.0", ">=9.0.0 <11"), false);
    assert.equal(satisfiesRange("8.57.0", "^8.57.0 || ^9.0.0"), true);
    assert.equal(satisfiesRange("10.8.1", "^8.57.0 || ^9.0.0"), false);
    // ^0.x is minor-bounded in npm, unlike ^1.x and above.
    assert.equal(satisfiesRange("0.64.9", "^0.64.0"), true);
    assert.equal(satisfiesRange("0.65.0", "^0.64.0"), false);
    assert.equal(rangeFloor(">=0.64.0 <1"), "0.64.0");
    assert.equal(rangeTopMajor(">=9.0.0 <11"), 10);
    assert.equal(rangeTopMajor(">=0.64.0 <1"), 0);
    assert.throws(() => satisfiesRange("1.0.0", "~1.0.0"), /unsupported range comparator/);
    assert.throws(() => rangeFloor("<11"), /no >= floor/);
    assert.throws(() => rangeTopMajor(">=9.0.0"), /no < ceiling/);
  });

  it("keeps declared peer support equal to tested support (FINDINGS.md OPS-011)", () => {
    const matrix = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts/compat-matrix.json"), "utf8"),
    );
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    assert.deepEqual(checkSupportPolicy(matrix, pkg), []);

    // ESLint 10 is advertised by the peer range, so a cell must run it with the
    // optional parser rather than leaving the pairing declared but untested.
    const eslint10Parser = matrix.cells.filter(
      (cell: any) => cell.eslint.startsWith("10.") && cell.typescriptEslint !== undefined,
    );
    assert.equal(eslint10Parser.length, 1, "no cell exercises ESLint 10 with typescript-eslint");

    const clonePolicy = () => JSON.parse(JSON.stringify({ matrix, pkg }));
    const expectError = (
      mutate: (value: { matrix: any; pkg: any }) => void,
      pattern: RegExp,
      label: string,
    ) => {
      const value = clonePolicy();
      mutate(value);
      const errors = checkSupportPolicy(value.matrix, value.pkg);
      assert.ok(
        errors.some((error: string) => pattern.test(error)),
        `${label}: expected ${pattern} in ${JSON.stringify(errors)}`,
      );
    };

    expectError(
      (value) => (value.pkg.peerDependencies.eslint = ">=9.0.0 <12"),
      /peer is >=9\.0\.0 <12; support policy declares/,
      "a peer range widened past the policy",
    );
    expectError(
      (value) => {
        value.matrix.supportPolicy.components.eslint.peer = ">=9.0.0 <12";
        value.pkg.peerDependencies.eslint = ">=9.0.0 <12";
      },
      /advertises 11\.x but no cell tests it/,
      "an advertised major nothing tests",
    );
    expectError(
      (value) => (value.matrix.eslint.minimum = "9.1.0"),
      /is not the peer floor 9\.0\.0/,
      "a tested floor above the advertised floor",
    );
    expectError(
      (value) => (value.matrix.oxfmt.highestCompatible = "0.99.0"),
      /has no compatibility cell/,
      "a tested version no cell runs",
    );
    expectError(
      (value) => (value.matrix.supportPolicy.incompatibleCombinations[0].witness.eslint = "9.39.5"),
      /accepts it/,
      "a rejected pairing that upstream peers actually allow",
    );
    expectError(
      (value) => delete value.matrix.supportPolicy.incompatibleCombinations[0].blockedBy,
      /does not record the upstream peer range that blocks it/,
      "a rejected pairing with no upstream enforcement",
    );
    expectError(
      (value) =>
        (value.matrix.supportPolicy.incompatibleCombinations[0].components.typescriptEslint =
          ">=8.0.0 <9"),
      /exercises the rejected combination/,
      "a cell running a rejected pairing",
    );
    expectError(
      (value) => (value.matrix.supportPolicy.components = {}),
      /has no supportPolicy\.components/,
      "a matrix with no declared support policy",
    );
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
