import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  changelogHasVersionHeading,
  changelogVersionHeadingPattern,
  isReleaseVersion,
} from "./check-release-artifact.mjs";
import { readJson } from "./lib/json-artifact.mjs";
import { isMainModule, root } from "./lib/repo.mjs";

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  const error = /** @type {Error & { kind?: string }} */ (new Error(message));
  error.kind = "prepare-release";
  throw error;
}

/**
 * Moves every note under `## Unreleased` beneath a new `## <version> — <date>`
 * heading and leaves `Unreleased` empty for the next cycle.
 * @param {string} text
 * @param {string} version
 * @param {string} date
 * @returns {string}
 */
export function releaseChangelog(text, version, date) {
  const unreleased = /^## Unreleased[ \t]*\n/m.exec(text);
  if (!unreleased) fail("CHANGELOG.md has no ## Unreleased heading");
  if (changelogVersionHeadingPattern(version).test(text)) {
    fail(`CHANGELOG.md already has a ${version} heading`);
  }
  const start = unreleased.index + unreleased[0].length;
  const rest = text.slice(start);
  const next = /^## /m.exec(rest);
  const notes = (next ? rest.slice(0, next.index) : rest).trim();
  if (!notes) fail("CHANGELOG.md has no Unreleased notes to release");
  const tail = next ? rest.slice(next.index) : "";
  const released = `${text.slice(0, start)}\n## ${version} — ${date}\n\n${notes}\n\n${tail}`;
  if (!changelogHasVersionHeading(released, version)) {
    fail("prepared changelog does not satisfy the release heading check");
  }
  return released;
}

/**
 * @typedef {object} PrepareReleaseOptions
 * @property {string} version
 * @property {string} [date] UTC calendar date; defaults to today.
 * @property {string} [cwd] Package directory; defaults to the repository root.
 */
/**
 * Sets the package and lockfile version and dates the changelog heading, which
 * is everything a release pull request has to change.
 * @param {PrepareReleaseOptions} options
 * @returns {{ version: string, date: string, files: string[] }}
 */
export function prepareRelease({
  version,
  date = new Date().toISOString().slice(0, 10),
  cwd = root,
}) {
  if (!isReleaseVersion(version)) fail(`invalid release version ${version}`);
  const pkg = readJson(join(cwd, "package.json"));
  if (version === pkg.version) fail(`package.json is already at ${version}`);
  const changelogPath = join(cwd, "CHANGELOG.md");
  const changelog = releaseChangelog(readFileSync(changelogPath, "utf8"), version, date);
  execFileSync("npm", ["version", version, "--no-git-tag-version", "--ignore-scripts"], {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
  const staged = `${changelogPath}.tmp`;
  writeFileSync(staged, changelog);
  renameSync(staged, changelogPath);
  return { version, date, files: ["package.json", "package-lock.json", "CHANGELOG.md"] };
}

/**
 * @param {readonly string[]} [argv]
 * @returns {{ version: string, date: string, files: string[] }}
 */
export function main(argv = process.argv.slice(2)) {
  const [version, extra] = argv;
  if (!version || extra !== undefined) fail("usage: npm run release:prepare -- <version>");
  const result = prepareRelease({ version });
  console.log(JSON.stringify(result));
  return result;
}

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
