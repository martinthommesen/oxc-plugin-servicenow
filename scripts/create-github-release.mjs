import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sha256File, tarballIntegrity } from "./check-release-artifact.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function parseReleaseView(raw) {
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (error) {
    throw new Error(
      `gh release view returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("gh release view returned no release object");
  }
  return parsed;
}

/** Decide the idempotent action before touching GitHub. */
export function releaseAction(existing, assetName) {
  if (!existing) return "create";
  if (existing.tagName && typeof existing.tagName !== "string")
    throw new Error("release tagName is malformed");
  const assets = Array.isArray(existing.assets) ? existing.assets : [];
  return assets.some((asset) => asset && asset.name === assetName)
    ? "verify-asset"
    : "upload-asset";
}

export function releaseAssetNames(view) {
  return (Array.isArray(view?.assets) ? view.assets : [])
    .filter((asset) => asset && typeof asset.name === "string")
    .map((asset) => asset.name);
}

export function changelogReleaseNotes(source, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(`^## ${escaped} — \\d{4}-\\d{2}-\\d{2}$`, "m").exec(source);
  if (!heading) fail(`CHANGELOG.md has no release notes for ${version}`);
  const start = heading.index + heading[0].length;
  const next = source.indexOf("\n## ", start);
  const notes = source.slice(start, next === -1 ? source.length : next).trim();
  if (!notes) fail(`CHANGELOG.md has no release notes for ${version}`);
  return notes;
}

export function validateExistingRelease(existing, expected) {
  const errors = [];
  if (existing?.tagName !== expected.tag)
    errors.push(`tag ${existing?.tagName} does not match ${expected.tag}`);
  if (existing?.name !== `v${expected.version}`)
    errors.push(`title ${existing?.name} does not match v${expected.version}`);
  if (existing?.isDraft !== false) errors.push("release must not be a draft");
  if (existing?.isPrerelease !== expected.prerelease)
    errors.push("release prerelease state does not match the version");
  if (existing?.body?.trim() !== expected.notes)
    errors.push("release notes do not match the exact changelog section");
  const names = releaseAssetNames(existing);
  if (names.some((name) => name !== expected.assetName))
    errors.push(`release has conflicting assets: ${names.join(", ")}`);
  if (new Set(names).size !== names.length) errors.push("release has duplicate asset names");
  if (errors.length > 0) fail(`existing GitHub release metadata mismatch:\n${errors.join("\n")}`);
  return existing;
}

export function resolveTagCommit({ tag, expectedCommit, readRef, readTag, maxDepth = 8 }) {
  if (!/^[a-f0-9]{40}$/i.test(expectedCommit)) fail(`invalid expected commit ${expectedCommit}`);
  const ref = readRef(tag);
  let object = ref?.object;
  const seen = new Set();
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    if (!object || typeof object.type !== "string" || !/^[a-f0-9]{40}$/i.test(object.sha ?? "")) {
      fail(`release tag ${tag} resolved to a malformed Git object`);
    }
    if (object.type === "commit") {
      if (object.sha.toLowerCase() !== expectedCommit.toLowerCase()) {
        fail(`release tag ${tag} targets ${object.sha}, expected ${expectedCommit}`);
      }
      return object.sha.toLowerCase();
    }
    if (object.type !== "tag")
      fail(`release tag ${tag} resolves to unsupported object type ${object.type}`);
    if (seen.has(object.sha)) fail(`release tag ${tag} contains an annotated-tag cycle`);
    seen.add(object.sha);
    if (depth === maxDepth) fail(`release tag ${tag} exceeds annotated-tag depth ${maxDepth}`);
    object = readTag(object.sha)?.object;
  }
  fail(`release tag ${tag} did not resolve to a commit`);
}

export function githubReleaseCreateArgs(tag, version, tarball, notesFile) {
  const args = [
    "release",
    "create",
    tag,
    tarball,
    "--verify-tag",
    "--title",
    `v${version}`,
    "--notes-file",
    notesFile,
  ];
  if (version.includes("-")) args.push("--prerelease");
  return args;
}

function fail(message) {
  const error = new Error(message);
  error.kind = "github-release";
  throw error;
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) fail(`${name} requires a value`);
  return value;
}

function gh(args, options = {}) {
  return execFileSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

function readGitObject(endpoint) {
  const raw = gh(["api", endpoint]);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      fail(`GitHub API ${endpoint} returned no object`);
    return parsed;
  } catch (error) {
    if (error?.kind === "github-release") throw error;
    fail(`GitHub API ${endpoint} returned invalid JSON`);
  }
}

function verifyRemoteTag(tag, expectedCommit) {
  const repository = process.env.GITHUB_REPOSITORY ?? "martinthommesen/oxc-plugin-servicenow";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    fail(`invalid GitHub repository ${repository}`);
  return resolveTagCommit({
    tag,
    expectedCommit,
    readRef: (value) =>
      readGitObject(`repos/${repository}/git/ref/tags/${encodeURIComponent(value)}`),
    readTag: (sha) => readGitObject(`repos/${repository}/git/tags/${sha}`),
  });
}

function viewRelease(tag) {
  try {
    return parseReleaseView(
      gh([
        "release",
        "view",
        tag,
        "--json",
        "tagName,name,isDraft,isPrerelease,body,targetCommitish,assets",
      ]),
    );
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    // gh uses status 1 for both 404 and auth failures; only treat explicit
    // not-found output as an absent release so auth/network errors fail closed.
    if (/not found|HTTP 404|release .*does not exist/i.test(stderr)) return undefined;
    throw error;
  }
}

function downloadAsset(tag, assetName, destination) {
  gh(["release", "download", tag, "--pattern", assetName, "--dir", destination, "--clobber"], {
    inherit: true,
  });
  const downloaded = join(destination, assetName);
  try {
    return readFileSync(downloaded);
  } catch {
    fail(`gh release download did not produce ${assetName}`);
  }
}

function verifyExistingAsset(tag, asset, tarball) {
  const expectedSha256 = sha256File(tarball);
  if (typeof asset.digest === "string" && /^sha256:[a-f0-9]{64}$/i.test(asset.digest)) {
    if (asset.digest.slice("sha256:".length).toLowerCase() === expectedSha256) return "digest";
  }
  const temporary = mkdtempSync(join(tmpdir(), "sn-gh-release-"));
  try {
    const downloaded = downloadAsset(tag, basename(tarball), temporary);
    const expectedIntegrity = tarballIntegrity(readFileSync(tarball));
    const actualIntegrity = tarballIntegrity(downloaded);
    if (actualIntegrity !== expectedIntegrity) {
      fail(
        `existing GitHub release asset ${basename(tarball)} does not match inspected tarball (${actualIntegrity} != ${expectedIntegrity})`,
      );
    }
    return "bytes";
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function uploadAsset(tag, tarball) {
  try {
    gh(["release", "upload", tag, tarball]);
  } catch (error) {
    // A concurrent retry may have uploaded the same name between view/upload.
    // Re-read and compare bytes instead of blindly overwriting an asset.
    const refreshed = viewRelease(tag);
    const asset = refreshed?.assets?.find((item) => item?.name === basename(tarball));
    if (asset) return verifyExistingAsset(tag, asset, tarball);
    throw error;
  }
  return "uploaded";
}

export function main(argv = process.argv) {
  const tag = argValue(argv, "--tag") ?? process.env.GITHUB_REF_NAME;
  const tarballArg = argValue(argv, "--tarball");
  if (!tag) fail("--tag or GITHUB_REF_NAME is required");
  if (!tarballArg) fail("--tarball is required");
  if (tag.includes("/") || !/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)) {
    fail(`invalid release tag ${tag}`);
  }
  const tarball = isAbsolute(tarballArg) ? tarballArg : join(process.cwd(), tarballArg);
  const assetName = basename(tarball);
  if (!assetName.endsWith(".tgz") || (assetName !== tarballArg && tarballArg.endsWith("/")))
    fail(`invalid tarball path ${tarballArg}`);
  const version = argValue(argv, "--version") ?? tag.slice(1);
  if (version !== tag.slice(1)) fail(`release version ${version} does not match tag ${tag}`);
  const expectedCommit = argValue(argv, "--expected-commit") ?? process.env.GITHUB_SHA;
  if (!expectedCommit) fail("--expected-commit or GITHUB_SHA is required");
  const notes = changelogReleaseNotes(readFileSync(join(root, "CHANGELOG.md"), "utf8"), version);
  const expected = { tag, version, assetName, prerelease: version.includes("-"), notes };
  const existing = viewRelease(tag);
  if (existing) validateExistingRelease(existing, expected);
  const action = releaseAction(existing, assetName);
  let result;
  const resolvedCommit = verifyRemoteTag(tag, expectedCommit);
  if (action === "create") {
    const temporary = mkdtempSync(join(tmpdir(), "sn-gh-release-notes-"));
    try {
      const notesFile = join(temporary, "release-notes.md");
      writeFileSync(notesFile, `${notes}\n`);
      gh(githubReleaseCreateArgs(tag, version, tarball, notesFile), { inherit: true });
      result = { action: "created" };
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  } else {
    const asset = existing.assets.find((item) => item?.name === assetName);
    if (action === "verify-asset") {
      result = { action: "reused", verification: verifyExistingAsset(tag, asset, tarball) };
    } else {
      result = { action: "uploaded", verification: uploadAsset(tag, tarball) };
    }
  }
  const finalRelease = validateExistingRelease(viewRelease(tag), expected);
  const finalAsset = finalRelease.assets.find((item) => item?.name === assetName);
  if (!finalAsset) fail(`GitHub release is missing ${assetName}`);
  const finalVerification = verifyExistingAsset(tag, finalAsset, tarball);
  const output = {
    ok: true,
    tag,
    resolvedCommit,
    asset: assetName,
    prerelease: version.includes("-"),
    notes: "CHANGELOG.md",
    assetVerification: finalVerification,
    ...result,
  };
  console.log(JSON.stringify(output, null, 2));
  return output;
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
