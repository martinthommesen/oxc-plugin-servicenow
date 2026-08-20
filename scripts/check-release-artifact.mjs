import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  return new RegExp(`^## ${escaped} — \\d{4}-\\d{2}-\\d{2}$`, "m");
}

export function changelogHasVersionHeading(text, version) {
  return changelogVersionHeadingPattern(version).test(text);
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
  try {
    readFileSync(join(root, "dist/index.js"));
  } catch {
    execFileSync("npm", ["run", "build"], { cwd: root, encoding: "utf8" });
  }
}

function packTarball(destination) {
  ensureBuiltDist();
  mkdirSync(destination, { recursive: true });
  const stdout = execFileSync("npm", ["pack", "--json", "--ignore-scripts", `--pack-destination=${destination}`], {
    encoding: "utf8",
    cwd: root,
  });
  const parsed = JSON.parse(stdout);
  const filename = parsed[0]?.filename;
  if (typeof filename !== "string") {
    fail(`unexpected pack output: ${stdout}`);
  }
  return join(destination, filename);
}

function listTarball(tarball) {
  return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).split("\n").filter(Boolean);
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

  const packedPkg = JSON.parse(
    execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
  );
  if (packedPkg.version !== pkg.version) {
    fail(`packed version ${packedPkg.version} does not match package.json ${pkg.version}`);
  }
  if (packedPkg.name !== pkg.name) {
    fail(`packed name ${packedPkg.name} does not match package.json ${pkg.name}`);
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
