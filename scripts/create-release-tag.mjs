import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isReleaseVersion } from "./check-release-artifact.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
 * @param {{ method?: string, headers?: Record<string, string>, body?: string }} [init]
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
 * @property {string} version
 * @property {string} expectedCommit
 * @property {string} repository
 * @property {string} token
 * @property {typeof fetch} [fetchImpl]
 */
/**
 * @param {CreateReleaseTagOptions} options
 * @returns {Promise<{ tag: string, commit: string, repository: string }>}
 */
export async function createReleaseTag({
  version,
  expectedCommit,
  repository,
  token,
  fetchImpl = fetch,
}) {
  if (!isReleaseVersion(version)) fail(`invalid release version ${version}`);
  if (!/^[0-9a-f]{40}$/.test(expectedCommit)) fail("expected commit must be a full SHA-1");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) fail("repository is invalid");
  if (!token) fail("release tag token is missing");

  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (version !== pkg.version) fail(`requested version ${version} does not match ${pkg.version}`);
  if (pkg.repository?.url !== `git+https://github.com/${repository}.git`) {
    fail("repository does not match package.json");
  }

  const main = await githubRequest(fetchImpl, token, repository, "/git/ref/heads/main");
  if (main?.object?.sha !== expectedCommit) {
    fail(`main is ${main?.object?.sha ?? "unknown"}; expected ${expectedCommit}`);
  }

  const tag = `v${version}`;
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
 * @returns {Promise<Record<string, string>>}
 */
export async function main(env = process.env) {
  const result = await createReleaseTag({
    version: /** @type {string} */ (env["RELEASE_VERSION"]),
    expectedCommit: /** @type {string} */ (env["EXPECTED_COMMIT"]),
    repository: /** @type {string} */ (env["GITHUB_REPOSITORY"]),
    token: /** @type {string} */ (env["RELEASE_SENTINEL_TOKEN"]),
  });
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
