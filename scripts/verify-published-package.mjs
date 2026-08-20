import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tarballIntegrity } from "./check-release-artifact.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function hasProvenanceAttestation(view) {
  const attestations = view?.dist?.attestations;
  if (!attestations || typeof attestations !== "object") return false;
  if (typeof attestations.url === "string" && attestations.url.length > 0) return true;
  if (attestations.provenance && typeof attestations.provenance === "object") return true;
  return false;
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function npmView(name, version) {
  const spec = `${name}@${version}`;
  const raw = execFileSync("npm", ["view", spec, "--json"], {
    encoding: "utf8",
    cwd: root,
  });
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

async function waitForView(name, version, timeoutMs, intervalMs) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      return npmView(name, version);
    } catch (error) {
      lastError = error;
      const remaining = timeoutMs - (Date.now() - started);
      if (remaining <= 0) break;
      await sleep(Math.min(intervalMs, remaining));
    }
  }
  fail(
    `registry did not list ${name}@${version}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function importInstalledPackage(consumer, name, version) {
  const installed = join(consumer, "node_modules", name);
  const pkg = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
  if (pkg.version !== version) {
    fail(`installed version ${pkg.version} does not match ${version}`);
  }
  if (!pkg.exports?.["."] || !pkg.exports?.["./oxfmt"] || !pkg.exports?.["./oxfmt.recommended.json"]) {
    fail("installed package is missing a public export");
  }

  const plugin = await import(pathToFileURL(join(installed, "dist/index.js")).href);
  if (plugin.default?.meta?.name !== "servicenow") {
    fail(`registry package meta.name is ${plugin.default?.meta?.name}`);
  }
  if (plugin.PACKAGE_VERSION !== version) {
    fail(`registry PACKAGE_VERSION is ${plugin.PACKAGE_VERSION}`);
  }

  const oxfmt = await import(pathToFileURL(join(installed, "dist/oxfmt/index.js")).href);
  if (!oxfmt || typeof oxfmt !== "object") {
    fail("registry ./oxfmt export did not load");
  }

  const recommended = JSON.parse(readFileSync(join(installed, "oxfmt.recommended.json"), "utf8"));
  if (!recommended || typeof recommended !== "object") {
    fail("registry oxfmt.recommended.json did not load");
  }
}

export async function main(argv = process.argv) {
  const localPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const name = argValue(argv, "--name") ?? localPkg.name;
  const version = argValue(argv, "--version") ?? localPkg.version;
  const timeoutMs = Number(argValue(argv, "--timeout-ms") ?? "180000");
  const intervalMs = Number(argValue(argv, "--interval-ms") ?? "3000");
  const tarballFlag = argValue(argv, "--tarball");
  const skipInstall = argv.includes("--skip-install");

  const view = await waitForView(name, version, timeoutMs, intervalMs);
  if (view.version !== version) {
    fail(`npm view version is ${view.version}`);
  }
  if (typeof view.dist?.tarball !== "string" || !view.dist.tarball.includes(name)) {
    fail("npm view did not return a package tarball URL");
  }
  if (!hasProvenanceAttestation(view)) {
    fail("npm view did not return provenance attestations for the published package");
  }

  if (tarballFlag) {
    const tarball = isAbsolute(tarballFlag) ? tarballFlag : join(process.cwd(), tarballFlag);
    const expected = tarballIntegrity(readFileSync(tarball));
    if (view.dist.integrity !== expected) {
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
      execFileSync("npm", ["install", `${name}@${version}`], {
        cwd: consumer,
        encoding: "utf8",
      });
      await importInstalledPackage(consumer, name, version);
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
