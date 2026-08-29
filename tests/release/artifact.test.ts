import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  changelogHasVersionHeading,
  changelogVersionHeadingPattern,
  inspectNpmPackRecord,
  inspectTarballEntryTypes,
  inspectTarballListing,
  isReleaseVersion,
  REQUIRED_TARBALL_PATHS,
  tarballIntegrity,
} from "../../scripts/check-release-artifact.mjs";
import { inspectPublishInput } from "../../scripts/publish-release-package.mjs";
import { repoRoot, TSX_CLI_EXECUTION_PATTERN } from "../integration/helpers.js";

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
    assert.equal(
      changelogHasVersionHeading("# Changelog\n\nSee 2.0.0 on 2026-08-20\n", "2.0.0"),
      false,
    );
    assert.match("## 2.0.0 — 2026-08-20", changelogVersionHeadingPattern("2.0.0"));
    assert.equal(
      changelogHasVersionHeading(
        "# Changelog\n\n## Unreleased\n\n## 2.0.0 — 2026-08-20\n\nReady.\n",
        "2.0.0",
      ),
      true,
    );
    assert.equal(
      changelogHasVersionHeading(
        "# Changelog\n\n## Unreleased\n\n## 1.9.0 — 2026-08-20\n\n## 2.0.0 — 2026-08-20\n",
        "2.0.0",
      ),
      false,
    );
    assert.equal(
      changelogHasVersionHeading(
        "# Changelog\n\n## Unreleased\n\n## 2.0.0 — 2099-01-01\n",
        "2.0.0",
      ),
      false,
    );
  });

  it("accepts only exact release semver", () => {
    assert.equal(isReleaseVersion("2.0.0"), true);
    assert.equal(isReleaseVersion("2.0.0-rc.1"), true);
    assert.equal(isReleaseVersion("2.0.0-01"), false);
    assert.equal(isReleaseVersion("2.0.0$(touch /tmp/pwned)"), false);
  });

  it("inspects required and forbidden tarball paths", () => {
    const valid = [...REQUIRED_TARBALL_PATHS, "package/dist/oxfmt/index.d.ts"];
    assert.deepEqual(inspectTarballListing(valid), []);
    assert.ok(
      inspectTarballListing(["package/package.json"]).some((error) => error.includes("missing")),
    );
    assert.ok(
      inspectTarballListing([...REQUIRED_TARBALL_PATHS, "package/src/index.ts"]).some((error) =>
        error.includes("forbidden package/src/index.ts"),
      ),
    );
    assert.ok(
      inspectTarballListing([...REQUIRED_TARBALL_PATHS, "package/tests/secret.test.ts"]).some(
        (error) => error.includes("forbidden package/tests/secret.test.ts"),
      ),
    );
    assert.ok(
      inspectTarballListing([...REQUIRED_TARBALL_PATHS, "package/.env"]).some((error) =>
        error.includes("forbidden secret path"),
      ),
    );
    assert.ok(
      inspectTarballListing([...REQUIRED_TARBALL_PATHS, "package/dist/stale.js.map"]).some(
        (error) => error.includes("unexpected source map"),
      ),
    );
    assert.ok(
      inspectTarballListing([...REQUIRED_TARBALL_PATHS, "package/../secret"]).some((error) =>
        error.includes("unsafe tarball path"),
      ),
    );
    assert.ok(
      inspectTarballListing([...REQUIRED_TARBALL_PATHS, "package/stale.txt"]).some((error) =>
        error.includes("unexpected package output"),
      ),
    );
    assert.deepEqual(inspectTarballEntryTypes(["-rw-r--r-- file"]), []);
    assert.ok(inspectTarballEntryTypes(["lrwxr-xr-x link -> target"])[0]?.includes("not allowed"));
  });

  it("validates npm pack file metadata", () => {
    const record = {
      files: [{ path: "package.json", size: 10, mode: 0o644 }],
    };
    assert.deepEqual(inspectNpmPackRecord(record, ["package/package.json"]), []);
    assert.ok(
      inspectNpmPackRecord(
        { files: [{ path: "dist/big.d.ts", size: 939_040, mode: 0o644 }] },
        ["package/dist/big.d.ts"],
      ).some((error) => error.includes("200 KB budget")),
    );
    assert.ok(
      inspectNpmPackRecord({ files: [{ path: "../secret", size: 1, mode: 0o644 }] }, [
        "package/../secret",
      ]).some((error) => error.includes("unsafe npm pack path")),
    );
    assert.ok(
      inspectNpmPackRecord({ files: [{ path: "tool.js", size: 1, mode: 0o755 }] }, [
        "package/tool.js",
      ]).some((error) => error.includes("unexpected executable")),
    );
    assert.ok(
      inspectNpmPackRecord({ files: [{ path: "link", size: 1, mode: 0o644, link: "target" }] }, [
        "package/link",
      ]).some((error) => error.includes("symlink is not allowed")),
    );
  });

  it("computes npm sha512 integrity for a tarball buffer", () => {
    const integrity = tarballIntegrity(Buffer.from("release-bytes"));
    assert.match(integrity, /^sha512-[A-Za-z0-9+/=]+$/);
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
    assert.match(workflow, /publish-release-package\.mjs/);
    assert.doesNotMatch(workflow, /continue-on-error/);
    assert.match(
      readFileSync(path.join(repoRoot, "scripts/publish-release-package.mjs"), "utf8"),
      /"--provenance"/,
    );
    assert.match(workflow, /environment: release/);
    assert.equal([...uncommented.matchAll(/id-token: write/g)].length, 1);
    assert.doesNotMatch(uncommented, /NPM_TOKEN/);
    assert.doesNotMatch(uncommented, /secrets\./);
    assert.match(workflow, /git rev-parse origin\/main/);
    assert.match(workflow, /test "\$GITHUB_SHA" = "\$\(git rev-parse origin\/main\)"/);
    assert.doesNotMatch(workflow, /merge-base --is-ancestor/);
    assert.doesNotMatch(workflow, /npm run compat -- --all/);
    assert.match(workflow, /compat-consumer\.mjs --cell .* --tarball/);
    assert.match(workflow, /--sha256 "\$SHA256"/);
    assert.doesNotMatch(workflow, TSX_CLI_EXECUTION_PATTERN);
    const artifactGate = readFileSync(
      path.join(repoRoot, "scripts/check-release-artifact.mjs"),
      "utf8",
    );
    assert.match(artifactGate, /execFileSync\(process\.execPath, args/);
    assert.doesNotMatch(artifactGate, /tsx\/cli/);
    assert.doesNotMatch(artifactGate, /execFileSync\("npx", \["tsx"/);
  });

  it("packs and inspects the current workspace tarball", () => {
    const staging = mkdtempSync(path.join(tmpdir(), "sn-oxc-release-check-"));
    const writePath = path.join(staging, "tarball-path");
    const inputDir = path.join(staging, "publish-input");
    try {
      const stdout = execFileSync(
        process.execPath,
        [
          path.join(repoRoot, "scripts/check-release-artifact.mjs"),
          "--pack-destination",
          staging,
          "--write-path",
          writePath,
          "--publish-input-dir",
          inputDir,
        ],
        { encoding: "utf8", cwd: repoRoot },
      );
      const result = JSON.parse(stdout) as {
        ok: boolean;
        version: string;
        tarball: string;
        sha256: string;
        integrity: string;
        npmPackManifest: {
          filename: string;
          sha256: string;
          integrity: string;
          files: Array<{ path: string; size: number; mode: number; link: null; sha256: string }>;
        };
      };
      assert.equal(result.ok, true);
      assert.equal(result.version, pkg.version);
      assert.equal(readFileSync(writePath, "utf8").trim(), result.tarball);
      assert.match(result.sha256, /^[a-f0-9]{64}$/);
      assert.match(result.integrity, /^sha512-/);
      const input = inspectPublishInput(inputDir);
      assert.equal(input.manifest.version, pkg.version);
      assert.equal(input.npmPackManifest.filename, path.basename(result.tarball));
      assert.equal(input.npmPackManifest.sha256, result.sha256);
      assert.equal(input.npmPackManifest.integrity, result.integrity);
      assert.ok(input.npmPackManifest.files.length > 0);
      assert.ok(input.npmPackManifest.files.every((file) => file.link === null));
      assert.ok(input.npmPackManifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
      assert.equal(path.basename(input.tarball), path.basename(result.tarball));
      const listing = execFileSync("tar", ["-tzf", result.tarball], { encoding: "utf8" })
        .split("\n")
        .filter(Boolean);
      assert.deepEqual(inspectTarballListing(listing), []);
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  });
});
