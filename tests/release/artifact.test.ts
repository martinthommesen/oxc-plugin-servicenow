import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  changelogHasVersionHeading,
  changelogVersionHeadingPattern,
  inspectTarballListing,
  REQUIRED_TARBALL_PATHS,
  tarballIntegrity,
} from "../../scripts/check-release-artifact.mjs";
import { hasProvenanceAttestation } from "../../scripts/verify-published-package.mjs";
import { repoRoot } from "../integration/helpers.js";

const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
  name: string;
  version: string;
  scripts: Record<string, string>;
};

describe("release artifact gates", () => {
  it("requires an exact changelog version heading", () => {
    const changelog = readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8");
    assert.equal(changelogHasVersionHeading(changelog, pkg.version), true);
    assert.equal(changelogHasVersionHeading("# Changelog\n\n## Unreleased\n", "2.0.0"), false);
    assert.equal(changelogHasVersionHeading("# Changelog\n\n## 2.0.0\n", "2.0.0"), false);
    assert.equal(changelogHasVersionHeading("# Changelog\n\nSee 2.0.0 on 2026-08-20\n", "2.0.0"), false);
    assert.match("## 2.0.0 — 2026-08-20", changelogVersionHeadingPattern("2.0.0"));
  });

  it("inspects required and forbidden tarball paths", () => {
    const valid = [
      ...REQUIRED_TARBALL_PATHS,
      "package/dist/oxfmt/index.d.ts",
      "package/package.json",
    ];
    assert.deepEqual(inspectTarballListing(valid), []);
    assert.ok(inspectTarballListing(["package/package.json"]).some((error) => error.includes("missing")));
    assert.ok(
      inspectTarballListing([...REQUIRED_TARBALL_PATHS, "package/src/index.ts"]).some((error) =>
        error.includes("forbidden package/src/index.ts"),
      ),
    );
    assert.ok(
      inspectTarballListing([...REQUIRED_TARBALL_PATHS, "package/tests/secret.test.ts"]).some((error) =>
        error.includes("forbidden package/tests/secret.test.ts"),
      ),
    );
    assert.ok(
      inspectTarballListing([...REQUIRED_TARBALL_PATHS, "package/.env"]).some((error) =>
        error.includes("forbidden secret path"),
      ),
    );
  });

  it("computes npm sha512 integrity for a tarball buffer", () => {
    const integrity = tarballIntegrity(Buffer.from("release-bytes"));
    assert.match(integrity, /^sha512-[A-Za-z0-9+/=]+$/);
  });

  it("accepts npm provenance attestations and rejects a bare dist record", () => {
    assert.equal(
      hasProvenanceAttestation({
        dist: { attestations: { url: "https://registry.npmjs.org/-/npm/v1/attestations/oxc-plugin-servicenow@2.0.0" } },
      }),
      true,
    );
    assert.equal(
      hasProvenanceAttestation({
        dist: { attestations: { provenance: { predicateType: "https://slsa.dev/provenance/v1" } } },
      }),
      true,
    );
    assert.equal(hasProvenanceAttestation({ dist: { tarball: "https://example.test/pkg.tgz" } }), false);
    assert.equal(hasProvenanceAttestation({ dist: { attestations: {} } }), false);
  });

  it("wires validate and release scripts to one inspected tarball", () => {
    const releaseCheck = pkg.scripts["release:check"];
    const validate = pkg.scripts.validate;
    assert.equal(releaseCheck, "node scripts/check-release-artifact.mjs");
    assert.ok(validate, "package.json is missing the validate script");
    assert.match(validate, /release:check -- --consumer/);
    assert.doesNotMatch(validate, /(?:^| )compat(?: |$)/);

    const workflow = readFileSync(path.join(repoRoot, ".github/workflows/release.yml"), "utf8");
    const uncommented = workflow.replace(/^\s*#.*$/gm, "");
    assert.match(workflow, /scripts\/check-release-artifact\.mjs/);
    assert.match(workflow, /scripts\/verify-published-package\.mjs/);
    assert.match(workflow, /npm publish .*--ignore-scripts/);
    assert.match(workflow, /--provenance/);
    assert.match(workflow, /environment: release/);
    assert.equal([...uncommented.matchAll(/id-token: write/g)].length, 1);
    assert.doesNotMatch(uncommented, /NPM_TOKEN/);
    assert.doesNotMatch(uncommented, /secrets\./);
    assert.match(workflow, /merge-base --is-ancestor/);
    assert.doesNotMatch(workflow, /npm run compat -- --all/);
    assert.match(workflow, /compat-consumer\.mjs --all --tarball/);
  });

  it("packs and inspects the current workspace tarball", () => {
    const staging = mkdtempSync(path.join(tmpdir(), "sn-oxc-release-check-"));
    const writePath = path.join(staging, "tarball-path");
    try {
      const stdout = execFileSync(
        process.execPath,
        [
          path.join(repoRoot, "scripts/check-release-artifact.mjs"),
          "--pack-destination",
          staging,
          "--write-path",
          writePath,
        ],
        { encoding: "utf8", cwd: repoRoot },
      );
      const result = JSON.parse(stdout) as {
        ok: boolean;
        version: string;
        tarball: string;
        sha256: string;
        integrity: string;
      };
      assert.equal(result.ok, true);
      assert.equal(result.version, pkg.version);
      assert.equal(readFileSync(writePath, "utf8").trim(), result.tarball);
      assert.match(result.sha256, /^[a-f0-9]{64}$/);
      assert.match(result.integrity, /^sha512-/);
      const listing = execFileSync("tar", ["-tzf", result.tarball], { encoding: "utf8" }).split("\n").filter(Boolean);
      assert.deepEqual(inspectTarballListing(listing), []);
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  });

});
