import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sha256File, tarballIntegrity } from "./check-release-artifact.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function parseReleaseView(raw) {
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (error) {
    throw new Error(`gh release view returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("gh release view returned no release object");
  }
  return parsed;
}

/** Decide the idempotent action before touching GitHub. */
export function releaseAction(existing, assetName) {
  if (!existing) return "create";
  if (existing.tagName && typeof existing.tagName !== "string") throw new Error("release tagName is malformed");
  const assets = Array.isArray(existing.assets) ? existing.assets : [];
  return assets.some((asset) => asset && asset.name === assetName) ? "verify-asset" : "upload-asset";
}

export function releaseAssetNames(view) {
  return (Array.isArray(view?.assets) ? view.assets : [])
    .filter((asset) => asset && typeof asset.name === "string")
    .map((asset) => asset.name);
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
  if (!value || value.startsWith("--")) fail(`${name} requires a value`);
  return value;
}

function gh(args, options = {}) {
  const command = process.env.GH_BIN || "gh";
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

function viewRelease(tag) {
  try {
    return parseReleaseView(gh(["release", "view", tag, "--json", "tagName,name,assets"]));
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    // gh uses status 1 for both 404 and auth failures; only treat explicit
    // not-found output as an absent release so auth/network errors fail closed.
    if (/not found|HTTP 404|release .*does not exist/i.test(stderr)) return undefined;
    throw error;
  }
}

function downloadAsset(tag, assetName, destination) {
  gh(["release", "download", tag, "--pattern", assetName, "--dir", destination, "--clobber"], { inherit: true });
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
  const temporary = mkdtempSync(join(process.env.RUNNER_TEMP || join(root, ".tmp"), "sn-gh-release-"));
  try {
    const downloaded = downloadAsset(tag, basename(tarball), temporary);
    const expectedIntegrity = tarballIntegrity(readFileSync(tarball));
    const actualIntegrity = tarballIntegrity(downloaded);
    if (actualIntegrity !== expectedIntegrity) {
      fail(`existing GitHub release asset ${basename(tarball)} does not match inspected tarball (${actualIntegrity} != ${expectedIntegrity})`);
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
  if (!assetName.endsWith(".tgz") || assetName !== tarballArg && tarballArg.endsWith("/")) fail(`invalid tarball path ${tarballArg}`);
  const version = argValue(argv, "--version") ?? tag.slice(1);
  if (version !== tag.slice(1)) fail(`release version ${version} does not match tag ${tag}`);
  const existing = viewRelease(tag);
  const action = releaseAction(existing, assetName);
  let result;
  if (action === "create") {
    gh([
      "release",
      "create",
      tag,
      tarball,
      "--title",
      `v${version}`,
      "--notes",
      `Published oxc-plugin-servicenow ${version} from the inspected tarball.`,
    ], { inherit: true });
    result = { action: "created" };
  } else {
    if (existing.tagName !== tag) fail(`existing release tag ${existing.tagName} does not match ${tag}`);
    const asset = existing.assets.find((item) => item?.name === assetName);
    if (action === "verify-asset") {
      result = { action: "reused", verification: verifyExistingAsset(tag, asset, tarball) };
    } else {
      result = { action: "uploaded", verification: uploadAsset(tag, tarball) };
    }
  }
  const output = { ok: true, tag, asset: assetName, ...result };
  console.log(JSON.stringify(output, null, 2));
  return output;
}

const invokedDirectly = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
