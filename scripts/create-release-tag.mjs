import { join } from "node:path";
import { checkChangelog, isReleaseVersion } from "./check-release-artifact.mjs";
import { readJson } from "./lib/json-artifact.mjs";
import { isMainModule, root } from "./lib/repo.mjs";

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  const error = /** @type {Error & { kind?: string }} */ (new Error(message));
  error.kind = "release-tag";
  throw error;
}

/**
 * @param {any} fetchImpl
 * @param {string} token
 * @param {string} repository
 * @param {string} path
 * @param {{ method?: string, headers?: Record<string, string>, body?: string, allowNotFound?: boolean }} [init]
 * @returns {Promise<any>}
 */
async function githubRequest(fetchImpl, token, repository, path, init = {}) {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
    ...init,
    redirect: "error",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  if (init.allowNotFound && response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    fail(
      `GitHub ${init.method ?? "GET"} ${path} failed with ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ""}`,
    );
  }
  return response.json();
}

/**
 * @typedef {object} CreateReleaseTagOptions
 * @property {string | undefined} [version] Must equal the `package.json` version when given.
 * @property {string} expectedCommit
 * @property {string} repository
 * @property {string} token
 * @property {string} [changelog] Changelog text; defaults to the repository `CHANGELOG.md`.
 * @property {typeof fetch} [fetchImpl]
 */
/**
 * @typedef {object} ReleaseTagResult
 * @property {string} tag
 * @property {string} commit The commit the tag points at, whether created now or earlier.
 * @property {string} repository
 */
/**
 * Every precondition the release workflow would later reject is checked before
 * the immutable tag is pushed, so a failed check never leaves a version number
 * unusable.
 * @param {CreateReleaseTagOptions} options
 * @returns {Promise<ReleaseTagResult>}
 */
export async function createReleaseTag({
  version,
  expectedCommit,
  repository,
  token,
  changelog,
  fetchImpl = fetch,
}) {
  if (!/^[0-9a-f]{40}$/.test(expectedCommit)) fail("expected commit must be a full SHA-1");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) fail("repository is invalid");
  if (!token) fail("release tag token is missing");

  const pkg = readJson(join(root, "package.json"));
  if (!isReleaseVersion(pkg.version)) fail(`invalid release version ${pkg.version}`);
  if (version && version !== pkg.version) {
    fail(`requested version ${version} does not match ${pkg.version}`);
  }
  if (pkg.repository?.url !== `git+https://github.com/${repository}.git`) {
    fail("repository does not match package.json");
  }

  const tag = `v${pkg.version}`;
  const existing = await githubRequest(fetchImpl, token, repository, `/git/ref/tags/${tag}`, {
    allowNotFound: true,
  });
  if (existing) {
    const commit = existing?.object?.sha;
    if (typeof commit !== "string") fail(`GitHub returned an unexpected reference for ${tag}`);
    return { tag, commit, repository };
  }

  checkChangelog(pkg.version, changelog);

  const main = await githubRequest(fetchImpl, token, repository, "/git/ref/heads/main");
  if (main?.object?.sha !== expectedCommit) {
    fail(`main is ${main?.object?.sha ?? "unknown"}; expected ${expectedCommit}`);
  }

  const created = await githubRequest(fetchImpl, token, repository, "/git/refs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/tags/${tag}`, sha: expectedCommit }),
  });
  if (created?.ref !== `refs/tags/${tag}` || created?.object?.sha !== expectedCommit) {
    fail("GitHub returned an unexpected tag reference");
  }
  return { tag, commit: expectedCommit, repository };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<ReleaseTagResult>}
 */
export async function main(env = process.env) {
  const result = await createReleaseTag({
    version: env["RELEASE_VERSION"],
    expectedCommit: /** @type {string} */ (env["EXPECTED_COMMIT"]),
    repository: /** @type {string} */ (env["GITHUB_REPOSITORY"]),
    token: /** @type {string} */ (env["RELEASE_SENTINEL_TOKEN"]),
  });
  console.log(JSON.stringify(result));
  return result;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
