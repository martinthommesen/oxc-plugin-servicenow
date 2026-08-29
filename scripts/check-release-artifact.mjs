import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, posix } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseNpmPackJson } from "./parse-npm-pack.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;

export function isReleaseVersion(value) {
  return typeof value === "string" && RELEASE_VERSION.test(value);
}

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

const ALLOWED_ROOT_TARBALL_PATHS = new Set(
  REQUIRED_TARBALL_PATHS.filter((path) => !path.startsWith("package/dist/")),
);

export function changelogVersionHeadingPattern(version) {
  const escaped = String(version).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^## ${escaped} — (\\d{4}-\\d{2}-\\d{2})$`, "m");
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function changelogHasVersionHeading(text, version) {
  const unreleased = /^## Unreleased\s*$/m.exec(text);
  const match = changelogVersionHeadingPattern(version).exec(text);
  if (!unreleased || !match || !isValidIsoDate(match[1]) || match.index < unreleased.index) {
    return false;
  }
  const firstVersionHeading = /^## (?!Unreleased\s*$).+$/m.exec(
    text.slice(unreleased.index + unreleased[0].length),
  );
  if (!firstVersionHeading || firstVersionHeading[0] !== match[0]) return false;
  const today = new Date().toISOString().slice(0, 10);
  return match[1] <= today;
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
    if (
      !file.startsWith("package/") ||
      file.includes("\0") ||
      file.includes("\\") ||
      posix.normalize(file) !== file ||
      file === "package/"
    ) {
      errors.push(`unsafe tarball path ${file}`);
    }
    if (FORBIDDEN_TARBALL_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      errors.push(`forbidden ${file}`);
    }
    if (!file.startsWith("package/dist/") && !ALLOWED_ROOT_TARBALL_PATHS.has(file)) {
      errors.push(`unexpected package output ${file}`);
    }
    if (file.includes(".env")) {
      errors.push(`forbidden secret path ${file}`);
    }
    if (file.endsWith(".map")) {
      errors.push(`unexpected source map ${file}`);
    }
  }
  if (listing.size !== files.length) errors.push("duplicate tarball path");
  return errors;
}

export function inspectTarballEntryTypes(verboseLines) {
  return verboseLines
    .filter((line) => /^[lh]/.test(line))
    .map((line) => `link entry is not allowed: ${line}`);
}

export function inspectNpmPackRecord(record, tarballFiles) {
  const errors = [];
  if (!record || typeof record !== "object" || !Array.isArray(record.files)) {
    return ["npm pack record is missing its files manifest"];
  }
  const paths = [];
  for (const file of record.files) {
    if (!file || typeof file !== "object" || typeof file.path !== "string") {
      errors.push("npm pack file record is invalid");
      continue;
    }
    paths.push(file.path);
    if (
      !file.path ||
      file.path.includes("\0") ||
      file.path.includes("\\") ||
      file.path.startsWith("/") ||
      posix.normalize(file.path) !== file.path ||
      file.path === ".." ||
      file.path.startsWith("../")
    ) {
      errors.push(`unsafe npm pack path ${file.path}`);
    }
    if (!Number.isSafeInteger(file.size) || file.size < 0) {
      errors.push(`invalid size for ${file.path}`);
    }
    if (!Number.isSafeInteger(file.mode) || file.mode < 0 || file.mode > 0o7777) {
      errors.push(`invalid mode for ${file.path}`);
    } else if ((file.mode & 0o111) !== 0) {
      errors.push(`unexpected executable ${file.path}`);
    }
    if (file.link != null) errors.push(`symlink is not allowed: ${file.path}`);
    // Declaration-size budget: a stray `as const` on a generated data module
    // once shipped a 939 KB .d.ts (FINDINGS.md PER-001).
    if (file.path.endsWith(".d.ts") && file.size > 200_000) {
      errors.push(`declaration ${file.path} exceeds the 200 KB budget (${file.size} bytes)`);
    }
  }
  if (new Set(paths).size !== paths.length) errors.push("duplicate npm pack path");
  const normalizedTarPaths = tarballFiles.map((path) => path.replace(/^package\//, "")).sort();
  if (JSON.stringify([...paths].sort()) !== JSON.stringify(normalizedTarPaths)) {
    errors.push("npm pack manifest paths differ from the tarball listing");
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
  if (typeof target !== "string" || !target.startsWith("./") || target.includes("\0"))
    return undefined;
  const normalized = target.slice(2);
  if (
    !normalized ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized === ".."
  )
    return undefined;
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
  if (!pkg.exports || typeof pkg.exports !== "object")
    errors.push("package.json is missing exports");
  for (const { path, target } of collectPackageFileTargets(pkg)) {
    const tarPath = packageTargetPath(target);
    if (!tarPath) {
      errors.push(`${path} has an unsafe or non-relative target ${String(target)}`);
      continue;
    }
    if (!listing.has(tarPath)) errors.push(`${path} target ${target} is missing from tarball`);
    if (
      (path === "types" || path === "typings" || path.endsWith(".types")) &&
      !/\.d\.(?:[cm]ts|ts)$/.test(target)
    ) {
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

export function normalizeNpmPackManifest(record, tarball) {
  const tarballBytes = readFileSync(tarball);
  const files = record.files.map((file) => {
    const bytes = execFileSync("tar", ["-xOf", tarball, `package/${file.path}`], {
      maxBuffer: 64 * 1024 * 1024,
    });
    if (bytes.byteLength !== file.size) {
      fail(`npm pack size mismatch for ${file.path}`);
    }
    return {
      path: file.path,
      size: file.size,
      mode: file.mode,
      link: file.link ?? null,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
  const manifest = {
    schemaVersion: 1,
    name: record.name,
    version: record.version,
    filename: record.filename,
    size: statSync(tarball).size,
    unpackedSize: files.reduce((total, file) => total + file.size, 0),
    entryCount: files.length,
    shasum: createHash("sha1").update(tarballBytes).digest("hex"),
    integrity: tarballIntegrity(tarballBytes),
    sha256: createHash("sha256").update(tarballBytes).digest("hex"),
    files,
  };
  for (const field of [
    "name",
    "version",
    "filename",
    "size",
    "unpackedSize",
    "entryCount",
    "shasum",
    "integrity",
  ]) {
    if (record[field] !== manifest[field]) {
      fail(`npm pack ${field} does not match the exact tarball`);
    }
  }
  return manifest;
}

export function createReleasePublishInput(inputDir, tarball, pkg, npmPackManifest) {
  const scriptsDir = join(inputDir, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  const files = [
    { source: tarball, path: join("package", basename(tarball)) },
    {
      source: join(root, "scripts/check-trusted-publishing-npm.mjs"),
      path: "scripts/check-trusted-publishing-npm.mjs",
    },
    {
      source: join(root, "scripts/publish-release-package.mjs"),
      path: "scripts/publish-release-package.mjs",
    },
  ];
  mkdirSync(join(inputDir, "package"), { recursive: true });
  writeFileSync(
    join(inputDir, "package/npm-pack-manifest.json"),
    `${JSON.stringify(npmPackManifest, null, 2)}\n`,
  );
  files.push({
    source: undefined,
    path: "package/npm-pack-manifest.json",
  });
  for (const file of files) {
    if (file.source) copyFileSync(file.source, join(inputDir, file.path));
  }
  const manifest = {
    schemaVersion: 1,
    name: pkg.name,
    version: pkg.version,
    files: files.map((file) => ({
      path: file.path,
      sha256: sha256File(join(inputDir, file.path)),
    })),
  };
  writeFileSync(
    join(inputDir, "release-publish-input.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
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
  if (!value || value.startsWith("-")) {
    fail(`${name} requires a value`);
  }
  return value;
}

function ensureBuiltDist() {
  // Release checks must never inspect stale ignored dist output. The validate
  // job also builds explicitly; this second build protects local invocation.
  // Callers may parse this script's stdout as JSON. Keep the build's npm
  // banners out of that machine-readable channel while preserving failures.
  for (const script of ["clean", "build"]) {
    execFileSync("npm", ["run", script], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "ignore", "inherit"],
    });
  }
}

function packTarball(destination) {
  ensureBuiltDist();
  mkdirSync(destination, { recursive: true });
  const stdout = execFileSync(
    "npm",
    ["pack", "--json", "--ignore-scripts", `--pack-destination=${destination}`],
    {
      encoding: "utf8",
      cwd: root,
    },
  );
  let record;
  try {
    record = parseNpmPackJson(stdout);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  const filename = record.filename;
  return { tarball: join(destination, filename), record };
}

function listTarball(tarball) {
  return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).split("\n").filter(Boolean);
}

function listTarballVerbose(tarball) {
  return execFileSync("tar", ["-tvzf", tarball], { encoding: "utf8" }).split("\n").filter(Boolean);
}

function readPackedPackage(tarball) {
  return JSON.parse(
    execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
  );
}

function checkChangelog(version) {
  const text = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  if (!changelogHasVersionHeading(text, version)) {
    fail(`CHANGELOG.md must contain an exact heading: ## ${version} — YYYY-MM-DD`);
  }
}

function runConsumer(tarball, allCells) {
  const args = [
    join(root, "scripts/compat-consumer.mjs"),
    "--tarball",
    tarball,
    "--sha256",
    sha256File(tarball),
  ];
  if (allCells) args.push("--all");
  execFileSync(process.execPath, args, {
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
    publishInputDir: argValue(argv, "--publish-input-dir"),
  };
}

export function main(argv = process.argv) {
  const options = parseArgs(argv);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (!isReleaseVersion(pkg.version))
    fail(`package.json has invalid release version ${pkg.version}`);
  if (options.changelogOnly) {
    checkChangelog(pkg.version);
    const result = { ok: true, version: pkg.version, changelog: true };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const destination = options.packDestination
    ? isAbsolute(options.packDestination)
      ? options.packDestination
      : join(process.cwd(), options.packDestination)
    : process.cwd();
  if (options.tarball) {
    fail(
      "--tarball requires a preserved npm pack manifest and is not supported by this build gate",
    );
  }
  const { tarball, record } = packTarball(destination);

  const files = listTarball(tarball);
  const listingErrors = [
    ...inspectTarballListing(files),
    ...inspectTarballEntryTypes(listTarballVerbose(tarball)),
    ...inspectNpmPackRecord(record, files),
  ];
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
  const npmPackManifest = normalizeNpmPackManifest(record, tarball);

  if (options.consumer) {
    runConsumer(tarball, options.consumerAll);
  }

  if (options.writePath) {
    const writePath = isAbsolute(options.writePath)
      ? options.writePath
      : join(process.cwd(), options.writePath);
    mkdirSync(dirname(writePath), { recursive: true });
    writeFileSync(writePath, `${tarball}\n`);
  }
  if (options.publishInputDir) {
    const inputDir = isAbsolute(options.publishInputDir)
      ? options.publishInputDir
      : join(process.cwd(), options.publishInputDir);
    createReleasePublishInput(inputDir, tarball, pkg, npmPackManifest);
  }

  const result = {
    ok: true,
    name: pkg.name,
    version: pkg.version,
    tarball,
    sha256: sha256File(tarball),
    integrity: tarballIntegrity(readFileSync(tarball)),
    npmPackManifest,
    files: files.length,
    consumer: Boolean(options.consumer),
    consumerAll: Boolean(options.consumerAll),
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
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
