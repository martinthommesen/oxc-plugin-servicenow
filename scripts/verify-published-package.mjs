import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectPackageFileTargets, packageTargetPath, tarballIntegrity } from "./check-release-artifact.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function hasProvenanceAttestation(view) {
  const attestations = view?.dist?.attestations;
  if (!attestations || typeof attestations !== "object") return false;
  if (typeof attestations.url === "string" && /^https:\/\//.test(attestations.url)) return true;
  return Boolean(attestations.provenance && typeof attestations.provenance === "object");
}

export function registryIntegrityMatches(view, expectedIntegrity) {
  return typeof expectedIntegrity === "string" && view?.dist?.integrity === expectedIntegrity;
}

export function verificationInstallArgs(name, version) {
  return ["install", "--ignore-scripts", "--no-audit", "--no-fund", `${name}@${version}`];
}

function fail(message) {
  const error = new Error(message);
  error.kind = "published-package";
  throw error;
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`${name} requires a value`);
  }
  return value;
}

function parsePositiveDuration(raw, name) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) fail(`${name} must be a positive number`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function isTransientRegistryError(error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const text = error instanceof Error ? error.message : String(error);
  return /EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|429|502|503|504|E404|404/i.test(`${code} ${text}`);
}

/** Retry only publication-lag/network failures within a bounded window. */
export async function retryBounded(operation, options = {}) {
  const timeoutMs = parsePositiveDuration(options.timeoutMs ?? 180000, "retry timeout");
  const intervalMs = parsePositiveDuration(options.intervalMs ?? 3000, "retry interval");
  const started = Date.now();
  let lastError;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientRegistryError(error)) throw error;
      const remaining = timeoutMs - (Date.now() - started);
      if (remaining <= 0) break;
      await sleep(Math.min(intervalMs, remaining));
    }
  }
  throw lastError;
}

function npmView(name, version) {
  const spec = `${name}@${version}`;
  const raw = execFileSync("npm", ["view", spec, "--json"], {
    encoding: "utf8",
    cwd: root,
  });
  const parsed = JSON.parse(raw);
  const view = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!view || typeof view !== "object") throw new Error(`npm view returned no metadata for ${spec}`);
  return view;
}

export async function waitForView(name, version, timeoutMs, intervalMs, accept = () => true) {
  const timeout = parsePositiveDuration(timeoutMs, "--timeout-ms");
  const interval = parsePositiveDuration(intervalMs, "--interval-ms");
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      const view = npmView(name, version);
      if (!accept(view)) throw new Error(`registry metadata for ${name}@${version} is not complete yet`);
      return view;
    } catch (error) {
      lastError = error;
      const remaining = timeout - (Date.now() - started);
      if (remaining <= 0) break;
      await sleep(Math.min(interval, remaining));
    }
  }
  fail(
    `registry did not list ${name}@${version}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function packageMetadataFromConsumer(consumer, name) {
  // package.json is itself a public export; resolve it through Node's package
  // resolver instead of reading a checkout-relative or dist-relative path.
  const consumerRequire = createRequire(join(consumer, "package.json"));
  let packageJsonPath;
  try {
    packageJsonPath = consumerRequire.resolve(`${name}/package.json`);
  } catch (error) {
    fail(`registry package does not export ${name}/package.json: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    pkg: JSON.parse(readFileSync(packageJsonPath, "utf8")),
    packageJsonPath,
    consumerRequire,
  };
}

/** Check every export target and declaration path in an installed package. */
export function inspectInstalledPackageExports(consumer, name, expectedVersion) {
  const { pkg, packageJsonPath, consumerRequire } = packageMetadataFromConsumer(consumer, name);
  if (pkg.version !== expectedVersion) fail(`installed version ${pkg.version} does not match ${expectedVersion}`);
  const packageRoot = dirname(packageJsonPath);
  const errors = [];
  for (const { path, target } of collectPackageFileTargets(pkg)) {
    const tarPath = packageTargetPath(target);
    if (!tarPath) {
      errors.push(`${path} has an unsafe or non-relative target ${String(target)}`);
      continue;
    }
    const relative = tarPath.slice("package/".length);
    if (!existsSync(join(packageRoot, relative))) errors.push(`${path} target ${target} is missing`);
  }
  for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
    if (subpath.includes("*")) {
      errors.push(`wildcard export ${subpath} cannot be verified without a concrete declaration`);
      continue;
    }
    const specifier = subpath === "." ? name : `${name}/${subpath.slice(2)}`;
    try {
      consumerRequire.resolve(specifier);
    } catch (error) {
      errors.push(`${specifier} export does not resolve: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (errors.length > 0) fail(`installed package export inspection failed:\n${errors.join("\n")}`);
  return { pkg, packageRoot };
}

/**
 * Import package entry points through their public bare specifiers. This runs
 * in a child whose cwd is the clean consumer, so resolution cannot fall back to
 * this repository's node_modules or a filesystem dist path.
 */
export async function importInstalledPackage(consumer, name, version) {
  const { pkg } = inspectInstalledPackageExports(consumer, name, version);
  const importScript = `
import { createRequire } from "node:module";
const packageName = process.env.RELEASE_PACKAGE_NAME;
const expectedVersion = process.env.RELEASE_PACKAGE_VERSION;
const plugin = await import(packageName);
const oxfmt = await import(packageName + "/oxfmt");
const require = createRequire(import.meta.url);
const recommended = require(packageName + "/oxfmt.recommended.json");
const exportedPackage = require(packageName + "/package.json");
if (plugin.PACKAGE_VERSION !== expectedVersion) throw new Error("PACKAGE_VERSION mismatch");
if (exportedPackage.version !== expectedVersion) throw new Error("package.json version mismatch");
if (plugin.default?.meta?.name !== "servicenow") throw new Error("plugin meta.name mismatch");
if (!oxfmt || typeof oxfmt !== "object") throw new Error("./oxfmt did not load");
if (!recommended || typeof recommended !== "object") throw new Error("./oxfmt.recommended.json did not load");
console.log(JSON.stringify({ metaName: plugin.default?.meta?.name, version: plugin.PACKAGE_VERSION, oxfmt: true, recommended: true }));`;
  let output;
  try {
    output = execFileSync(process.execPath, ["--input-type=module", "-e", importScript], {
      cwd: consumer,
      encoding: "utf8",
      env: { ...process.env, RELEASE_PACKAGE_NAME: name, RELEASE_PACKAGE_VERSION: version },
    });
  } catch (error) {
    fail(`registry public export import failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  let result;
  try {
    result = JSON.parse(output);
  } catch {
    fail(`registry public export import did not emit JSON: ${output.slice(0, 400)}`);
  }
  if (result.metaName !== "servicenow" || result.version !== version || !result.oxfmt || !result.recommended) {
    fail(`registry public export result was invalid: ${JSON.stringify(result)}`);
  }
  return { pkg, result };
}

function hasCompleteRegistryMetadata(view) {
  return (
    typeof view?.version === "string" &&
    typeof view?.dist?.tarball === "string" &&
    /^https?:\/\//.test(view.dist.tarball) &&
    typeof view?.dist?.integrity === "string" &&
    /^sha512-[A-Za-z0-9+/=]+$/.test(view.dist.integrity) &&
    hasProvenanceAttestation(view)
  );
}

export async function main(argv = process.argv) {
  const localPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const name = argValue(argv, "--name") ?? localPkg.name;
  const version = argValue(argv, "--version") ?? localPkg.version;
  const timeoutMs = argValue(argv, "--timeout-ms") ?? "180000";
  const intervalMs = argValue(argv, "--interval-ms") ?? "3000";
  const tarballFlag = argValue(argv, "--tarball");
  const skipInstall = argv.includes("--skip-install");

  const view = await waitForView(name, version, timeoutMs, intervalMs, hasCompleteRegistryMetadata);
  if (view.version !== version) {
    fail(`npm view version is ${view.version}`);
  }
  if (typeof view.dist?.tarball !== "string" || !/^https?:\/\//.test(view.dist.tarball)) {
    fail("npm view did not return a package tarball URL");
  }
  if (typeof view.dist?.integrity !== "string" || !/^sha512-[A-Za-z0-9+/=]+$/.test(view.dist.integrity)) {
    fail("npm view did not return a sha512 package integrity");
  }
  if (!hasProvenanceAttestation(view)) {
    fail("npm view did not return provenance attestations for the published package");
  }

  if (tarballFlag) {
    const tarball = isAbsolute(tarballFlag) ? tarballFlag : join(process.cwd(), tarballFlag);
    const expected = tarballIntegrity(readFileSync(tarball));
    if (!registryIntegrityMatches(view, expected)) {
      fail(`registry integrity ${view.dist.integrity} does not match inspected tarball ${expected}`);
    }
  }

  if (!skipInstall) {
    const consumer = mkdtempSync(join(tmpdir(), "sn-oxc-published-"));
    try {
      writeFileSync(
        join(consumer, "package.json"),
        JSON.stringify({ name: "sn-oxc-published-verify", private: true, type: "module" }, null, 2),
      );
      await retryBounded(
        async () => {
          execFileSync("npm", verificationInstallArgs(name, version), {
            cwd: consumer,
            encoding: "utf8",
          });
          await importInstalledPackage(consumer, name, version);
        },
        { timeoutMs, intervalMs },
      );
    } finally {
      rmSync(consumer, { recursive: true, force: true });
    }
  }

  const result = {
    ok: true,
    name,
    version,
    tarball: view.dist.tarball,
    integrity: view.dist.integrity,
    provenance: true,
    installed: !skipInstall,
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

const invokedDirectly = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
