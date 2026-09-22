import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { changelogHasVersionHeading } from "../../scripts/check-release-artifact.mjs";
import { prepareRelease, releaseChangelog } from "../../scripts/prepare-release.mjs";
import { repoRoot } from "../integration/helpers.js";

const CHANGELOG = `# Changelog

## Unreleased

### Added

- a feature

## 1.0.0 — 2026-01-01

- first
`;

describe("release preparation", () => {
  // @lat: [[tests#Release governance#One command prepares a release pull request]]
  it("moves the Unreleased notes under a dated heading and empties Unreleased", () => {
    const released = releaseChangelog(CHANGELOG, "1.1.0", "2026-02-02");
    assert.equal(
      released,
      `# Changelog

## Unreleased

## 1.1.0 — 2026-02-02

### Added

- a feature

## 1.0.0 — 2026-01-01

- first
`,
    );
    assert.ok(changelogHasVersionHeading(released, "1.1.0"));
  });

  it("refuses an empty Unreleased section or an existing heading", () => {
    assert.throws(
      () =>
        releaseChangelog(
          "# Changelog\n\n## Unreleased\n\n## 1.0.0 — 2026-01-01\n",
          "1.1.0",
          "2026-02-02",
        ),
      /no Unreleased notes/,
    );
    assert.throws(() => releaseChangelog(CHANGELOG, "1.0.0", "2026-02-02"), /already has a 1.0.0/);
    assert.throws(
      () => releaseChangelog("# Changelog\n", "1.1.0", "2026-02-02"),
      /no ## Unreleased/,
    );
  });

  it("prepares the repository changelog for the next version", () => {
    const text = readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8");
    assert.ok(changelogHasVersionHeading(releaseChangelog(text, "99.0.0", "2026-02-02"), "99.0.0"));
  });

  it("sets the package and lockfile version alongside the changelog", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "prepare-release-"));
    try {
      const manifest = { name: "fixture", version: "1.0.0", lockfileVersion: 3 };
      writeFileSync(path.join(dir, "package.json"), JSON.stringify(manifest));
      writeFileSync(
        path.join(dir, "package-lock.json"),
        JSON.stringify({ ...manifest, packages: { "": { name: "fixture", version: "1.0.0" } } }),
      );
      writeFileSync(path.join(dir, "CHANGELOG.md"), CHANGELOG);
      assert.throws(() => prepareRelease({ version: "1.0.0", cwd: dir }), /already at 1.0.0/);
      assert.throws(() => prepareRelease({ version: "not-a-version", cwd: dir }), /invalid/);

      const result = prepareRelease({ version: "1.1.0", date: "2026-02-02", cwd: dir });
      assert.deepEqual(result, {
        version: "1.1.0",
        date: "2026-02-02",
        files: ["package.json", "package-lock.json", "CHANGELOG.md"],
      });
      const read = (file: string) => JSON.parse(readFileSync(path.join(dir, file), "utf8"));
      assert.equal(read("package.json").version, "1.1.0");
      assert.equal(read("package-lock.json").version, "1.1.0");
      assert.equal(read("package-lock.json").packages[""].version, "1.1.0");
      assert.ok(
        changelogHasVersionHeading(readFileSync(path.join(dir, "CHANGELOG.md"), "utf8"), "1.1.0"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
