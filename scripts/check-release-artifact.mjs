import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseNpmPackJson } from "./parse-npm-pack.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const REQUIRED_TARBALL_PATHS = [
  "package/package.json",
  "package/dist/index.js",
  "package/dist/index.d.ts",
  "package/dist/oxfmt/index.js",
  "package/oxfmt.recommended.json",
  "package/README.md",
  "package/LICENSE",
  "package/CHANGELOG.md",
];

export const FORBIDDEN_TARBALL_PREFIXES = [
  "package/src/",
  "package/tests/",
  "package/.github/",
  "package/scripts/",
  "package/plans/",
  "package/docs/",
];

export function changelogVersionHeadingPattern(version) {
  const escaped = String(version).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^## ${escaped} — (\\d{4}-\\d{2}-\\d{2})$`, "m");
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function changelogHasVersionHeading(text, version) {
  const match = changelogVersionHeadingPattern(version).exec(text);
  return Boolean(match && isValidIsoDate(match[1]));
}

export function inspectTarballListing(files) {
  const errors = [];
  const listing = new Set(files);
  for (const required of REQUIRED_TARBALL_PATHS) {
    if (!listing.has(required)) {
      errors.push(`missing ${required}`);
    }
  }
  for (const file of files) {
    if (FORBIDDEN_TARBALL_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      errors.push(`forbidden ${file}`);
    }
    if (file.includes(".env")) {
      errors.push(`forbidden secret path ${file}`);
    }
  }
  return errors;
}

function packageExportTargets(value, path = "exports", targets = []) {
  if (typeof value === "string") {
    targets.push({ path, target: value });
    return targets;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => packageExportTargets(item, `${path}[${index}]`, targets));
    return targets;
  }
  if (!value || typeof value !== "object") return targets;
  for (const [key, item] of Object.entries(value)) {
    packageExportTargets(item, `${path}.${key}`, targets);
  }
  return targets;
}

/** Return every concrete file target in package `exports` and `types` metadata. */
export function collectPackageFileTargets(pkg) {
  const targets = [];
  if (typeof pkg.types === "string") targets.push({ path: "types", target: pkg.types });
  if (typeof pkg.typings === "string") targets.push({ path: "typings", target: pkg.typings });
  if (typeof pkg.main === "string") targets.push({ path: "main", target: pkg.main });
  if (typeof pkg.module === "string") targets.push({ path: "module", target: pkg.module });
  packageExportTargets(pkg.exports, "exports", targets);
  return targets;
}

export function packageTargetPath(target) {
  if (typeof target !== "string" || !target.startsWith("./") || target.includes("\0")) return undefined;
  const normalized = target.slice(2);
  if (!normalized || normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") return undefined;
  return `package/${normalized}`;
}

/**
 * Verify package entry points and declaration targets against a tar listing.
 * This is deliberately independent of the package's source tree: publish and
 * consumer jobs must prove the exact inspected bytes, not the checkout.
 */
export function inspectPackageExports(pkg, files) {
  const errors = [];
  const listing = new Set(files);
  if (!pkg || typeof pkg !== "object") return ["package metadata is not an object"];
  if (!pkg.exports || typeof pkg.exports !== "object") errors.push("package.json is missing exports");
  for (const { path, target } of collectPackageFileTargets(pkg)) {
    const tarPath = packageTargetPath(target);
    if (!tarPath) {
      errors.push(`${path} has an unsafe or non-relative target ${String(target)}`);
      continue;
    }
    if (!listing.has(tarPath)) errors.push(`${path} target ${target} is missing from tarball`);
    if ((path === "types" || path === "typings" || path.endsWith(".types")) && !/\.d\.(?:[cm]ts|ts)$/.test(target)) {
      errors.push(`${path} target ${target} is not a declaration file`);
    }
  }
  return errors;
}

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function tarballIntegrity(buffer) {
  return `sha512-${createHash("sha512").update(buffer).digest("base64")}`;
}

function fail(message) {
  const error = new Error(message);
  error.kind = "release-artifact";
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

function ensureBuiltDist() {
  // Release checks must never inspect stale ignored dist output. The validate
  // job also builds explicitly; this second build protects local invocation.
  execFileSync("npm", ["run", "build"], { cwd: root, encoding: "utf8", stdio: "inherit" });
}

function packTarball(destination) {
  ensureBuiltDist();
  mkdirSync(destination, { recursive: true });
  const stdout = execFileSync("npm", ["pack", "--json", "--ignore-scripts", `--pack-destination=${destination}`], {
    encoding: "utf8",
    cwd: root,
  });
  let record;
  try {
    record = parseNpmPackJson(stdout);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  const filename = record.filename;
  return join(destination, filename);
}

function listTarball(tarball) {
  return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).split("\n").filter(Boolean);
}

function readPackedPackage(tarball) {
  return JSON.parse(execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }));
}

function checkChangelog(version) {
  const text = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  if (!changelogHasVersionHeading(text, version)) {
    fail(`CHANGELOG.md must contain an exact heading: ## ${version} — YYYY-MM-DD`);
  }
}

function runConsumer(tarball, allCells) {
  const args = [join(root, "scripts/compat-consumer.mjs"), "--tarball", tarball];
  if (allCells) args.push("--all");
  execFileSync("npx", ["tsx", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });
}

function parseArgs(argv) {
  return {
    changelogOnly: argv.includes("--changelog-only"),
    consumer: argv.includes("--consumer") || argv.includes("--consumer-all"),
    consumerAll: argv.includes("--consumer-all"),
    tarball: argValue(argv, "--tarball"),
    writePath: argValue(argv, "--write-path"),
    packDestination: argValue(argv, "--pack-destination"),
  };
}

export function main(argv = process.argv) {
  const options = parseArgs(argv);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  checkChangelog(pkg.version);
  if (options.changelogOnly) {
    const result = { ok: true, version: pkg.version, changelog: true };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const destination = options.packDestination
    ? isAbsolute(options.packDestination)
      ? options.packDestination
      : join(process.cwd(), options.packDestination)
    : process.cwd();
  const tarball = options.tarball
    ? isAbsolute(options.tarball)
      ? options.tarball
      : join(process.cwd(), options.tarball)
    : packTarball(destination);

  const files = listTarball(tarball);
  const listingErrors = inspectTarballListing(files);
  if (listingErrors.length > 0) {
    fail(`tarball inspection failed:\n${listingErrors.join("\n")}`);
  }

  const packedPkg = readPackedPackage(tarball);
  if (packedPkg.version !== pkg.version) {
    fail(`packed version ${packedPkg.version} does not match package.json ${pkg.version}`);
  }
  if (packedPkg.name !== pkg.name) {
    fail(`packed name ${packedPkg.name} does not match package.json ${pkg.name}`);
  }
  const exportErrors = inspectPackageExports(packedPkg, files);
  if (exportErrors.length > 0) {
    fail(`package export inspection failed:\n${exportErrors.join("\n")}`);
  }

  if (options.consumer) {
    runConsumer(tarball, options.consumerAll);
  }

  if (options.writePath) {
    const writePath = isAbsolute(options.writePath) ? options.writePath : join(process.cwd(), options.writePath);
    mkdirSync(dirname(writePath), { recursive: true });
    writeFileSync(writePath, `${tarball}\n`);
  }

  const result = {
    ok: true,
    name: pkg.name,
    version: pkg.version,
    tarball,
    sha256: sha256File(tarball),
    integrity: tarballIntegrity(readFileSync(tarball)),
    files: files.length,
    consumer: Boolean(options.consumer),
    consumerAll: Boolean(options.consumerAll),
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
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
