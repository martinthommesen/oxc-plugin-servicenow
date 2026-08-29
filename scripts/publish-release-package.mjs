import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { assertTrustedPublishingNpm } from "./check-trusted-publishing-npm.mjs";

const TRANSPORT_CODES = new Set(["EAI_AGAIN", "ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"]);

function fail(message, kind = "publish") {
  const error = new Error(message);
  error.kind = kind;
  throw error;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function filesBelow(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(root, path) : [relative(root, path)];
  });
}

export function releaseDistTag(version) {
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    fail(`invalid release version ${version}`, "version");
  }
  return version.includes("-") ? "next" : "latest";
}

function parsedVersion(version) {
  releaseDistTag(version);
  // The prerelease is everything after the first hyphen. split("-", 2) would
  // truncate hyphenated identifiers such as rc-2 (FINDINGS.md REL-001).
  const separator = version.indexOf("-");
  const core = separator < 0 ? version : version.slice(0, separator);
  const prerelease = separator < 0 ? undefined : version.slice(separator + 1);
  return {
    core: core.split(".").map(Number),
    prerelease: prerelease?.split(".") ?? [],
  };
}

export function compareReleaseVersions(left, right) {
  const a = parsedVersion(left);
  const b = parsedVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] - b.core[index];
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length === 0 ? 1 : -1;
  }
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = a.prerelease[index];
    const rightPart = b.prerelease[index];
    if (leftPart === undefined || rightPart === undefined)
      return leftPart === rightPart ? 0 : leftPart === undefined ? -1 : 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart);
    const rightNumber = /^\d+$/.test(rightPart);
    if (leftNumber && rightNumber) return Number(leftPart) - Number(rightPart);
    if (leftNumber !== rightNumber) return leftNumber ? -1 : 1;
    // SemVer 11.4.3: alphanumeric identifiers compare in ASCII order.
    // localeCompare orders across case by ICU collation, which diverges and
    // varies between Node builds (FINDINGS.md REL-003).
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

export function validateRegistryVersionOrder(metadata, candidate) {
  const versions = metadata?.versions;
  const tags = metadata?.["dist-tags"];
  if (!Array.isArray(versions) || !tags || typeof tags !== "object" || Array.isArray(tags)) {
    fail("registry package index is incomplete", "registry-schema");
  }
  for (const version of versions) {
    if (typeof version !== "string") fail("registry version is not a string", "registry-schema");
    parsedVersion(version);
  }
  for (const [tag, version] of Object.entries(tags)) {
    if (typeof version !== "string" || !versions.includes(version)) {
      fail(`registry dist-tag ${tag} does not resolve to a published version`, "registry-schema");
    }
  }
  if (versions.includes(candidate)) return { existing: true };
  const highest = [...versions].sort(compareReleaseVersions).at(-1);
  if (highest && compareReleaseVersions(candidate, highest) <= 0) {
    fail(`release version ${candidate} is not greater than published ${highest}`, "version");
  }
  return { existing: false, highest: highest ?? null };
}

export function parseNpmJson(text, label) {
  const trimmed = String(text).trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      fail(`${label} is not a JSON object`, "npm-output");
    return parsed;
  } catch (error) {
    if (error?.kind === "npm-output") throw error;
    fail(`${label} is not valid JSON`, "npm-output");
  }
}

export function classifyPublishResult(result) {
  if (result.signal) fail(`npm publish terminated by signal ${result.signal}`, "signal");
  if (result.status === 0) return { outcome: "published" };
  const parsed = parseNpmJson(result.stdout || result.stderr, "npm publish output");
  const code =
    typeof parsed?.error?.code === "string"
      ? parsed.error.code
      : typeof parsed?.code === "string"
        ? parsed.code
        : "";
  const summary = typeof parsed?.error?.summary === "string" ? parsed.error.summary : "";
  if (TRANSPORT_CODES.has(code)) return { outcome: "ambiguous", code };
  if (
    code === "EPUBLISHCONFLICT" ||
    (code === "E403" && /cannot publish over|previously published/i.test(summary))
  ) {
    return { outcome: "verify-existing", code };
  }
  fail(
    `npm publish failed permanently${code ? ` (${code})` : ""}${summary ? `: ${summary}` : ""}`,
    "permanent",
  );
}

export function inspectPublishInput(inputDir) {
  const manifestPath = join(inputDir, "release-publish-input.json");
  const manifest = parseNpmJson(readFileSync(manifestPath, "utf8"), "release publish manifest");
  if (
    manifest.schemaVersion !== 1 ||
    typeof manifest.version !== "string" ||
    typeof manifest.name !== "string"
  ) {
    fail("release publish manifest metadata is invalid", "manifest");
  }
  if (!Array.isArray(manifest.files) || manifest.files.length !== 4)
    fail("release publish manifest must list exactly four files", "manifest");
  const listed = manifest.files.map((item) => item?.path).sort();
  const actual = filesBelow(inputDir)
    .filter((path) => path !== "release-publish-input.json")
    .sort();
  if (JSON.stringify(listed) !== JSON.stringify(actual))
    fail(`release publish input files differ: ${actual.join(", ")}`, "manifest");
  for (const item of manifest.files) {
    if (
      !item ||
      typeof item.path !== "string" ||
      !/^[a-f0-9]{64}$/.test(item.sha256) ||
      sha256(join(inputDir, item.path)) !== item.sha256
    ) {
      fail(`release publish input digest mismatch for ${item?.path ?? "unknown"}`, "manifest");
    }
  }
  const tarballs = actual.filter((path) => path.endsWith(".tgz"));
  if (tarballs.length !== 1) fail("release publish input must contain one tarball", "manifest");
  if (
    !actual.includes("scripts/check-trusted-publishing-npm.mjs") ||
    !actual.includes("scripts/publish-release-package.mjs") ||
    !actual.includes("package/npm-pack-manifest.json")
  ) {
    fail("release publish input is missing reviewed helpers or artifact manifest", "manifest");
  }
  const tarball = join(inputDir, tarballs[0]);
  const npmPackManifest = parseNpmJson(
    readFileSync(join(inputDir, "package/npm-pack-manifest.json"), "utf8"),
    "npm pack manifest",
  );
  const tarballBytes = readFileSync(tarball);
  if (
    npmPackManifest.schemaVersion !== 1 ||
    npmPackManifest.name !== manifest.name ||
    npmPackManifest.version !== manifest.version ||
    npmPackManifest.filename !== basename(tarball) ||
    npmPackManifest.size !== tarballBytes.byteLength ||
    npmPackManifest.sha256 !== createHash("sha256").update(tarballBytes).digest("hex") ||
    npmPackManifest.integrity !==
      `sha512-${createHash("sha512").update(tarballBytes).digest("base64")}`
  ) {
    fail("npm pack manifest does not match the exact tarball", "manifest");
  }
  return { manifest, npmPackManifest, tarball };
}

export function publicationStateResult(result, name, version) {
  if (result.signal) fail(`npm view terminated by signal ${result.signal}`, "signal");
  if (result.status === 0) {
    const view = parseNpmJson(result.stdout, "npm view output");
    if (
      view.name !== name ||
      view.version !== version ||
      typeof view.dist?.integrity !== "string"
    ) {
      fail(`registry metadata for ${name}@${version} is incomplete`, "registry-schema");
    }
    return { state: "existing", integrity: view.dist.integrity };
  }
  const parsed = parseNpmJson(result.stdout || result.stderr, "npm view output");
  const code = parsed?.error?.code ?? parsed?.code;
  if (code === "E404") return { state: "absent" };
  fail(`npm view failed permanently${code ? ` (${code})` : ""}`, "permanent");
}

export function runPublicationState(name, version, npmCommand = "npm") {
  releaseDistTag(version);
  const indexResult = spawnSync(npmCommand, ["view", name, "--json"], { encoding: "utf8" });
  if (indexResult.error) throw indexResult.error;
  if (indexResult.signal) fail(`npm view terminated by signal ${indexResult.signal}`, "signal");
  let index;
  if (indexResult.status === 0) {
    index = parseNpmJson(indexResult.stdout, "npm package index");
  } else {
    const parsed = parseNpmJson(indexResult.stdout || indexResult.stderr, "npm package index");
    const code = parsed?.error?.code ?? parsed?.code;
    if (code !== "E404")
      fail(`npm package index failed permanently${code ? ` (${code})` : ""}`, "permanent");
    index = { versions: [], "dist-tags": {} };
  }
  validateRegistryVersionOrder(index, version);
  const result = spawnSync(npmCommand, ["view", `${name}@${version}`, "--json"], {
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return publicationStateResult(result, name, version);
}

export function publishReleasePackage({
  inputDir,
  expectedVersion,
  npmCommand = "npm",
  spawn = spawnSync,
}) {
  const { manifest, tarball } = inspectPublishInput(inputDir);
  if (manifest.version !== expectedVersion)
    fail(`manifest version ${manifest.version} does not match ${expectedVersion}`, "manifest");
  const npmVersion = spawn(npmCommand, ["--version"], { encoding: "utf8" });
  if (npmVersion.error) throw npmVersion.error;
  if (npmVersion.status !== 0 || npmVersion.signal) fail("npm --version failed", "npm-version");
  assertTrustedPublishingNpm(npmVersion.stdout);
  const tag = releaseDistTag(expectedVersion);
  const args = [
    "publish",
    tarball,
    "--ignore-scripts",
    "--provenance",
    "--access",
    "public",
    "--tag",
    tag,
    "--json",
  ];
  const result = spawn(npmCommand, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  return { ...classifyPublishResult(result), tag, tarball: basename(tarball), args };
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) fail(`${name} requires a value`, "arguments");
  return value;
}

export function main(argv = process.argv) {
  const name = argValue(argv, "--name") ?? "oxc-plugin-servicenow";
  const version = argValue(argv, "--version");
  if (!version) fail("--version is required", "arguments");
  const result = argv.includes("--state-only")
    ? runPublicationState(name, version)
    : publishReleasePackage({
        inputDir: argValue(argv, "--input-dir") ?? process.cwd(),
        expectedVersion: version,
      });
  console.log(JSON.stringify({ ok: true, name, version, ...result }));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
