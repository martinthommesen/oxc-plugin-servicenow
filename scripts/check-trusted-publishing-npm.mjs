import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Bounded range instead of exact equality (FINDINGS.md IMP-002): npm OIDC
// trusted publishing needs at least the minimum, and the exclusive upper
// bound keeps an untested major from running the publish step. The observed
// version is printed in the result JSON for audit.
/** @type {string} */
export const TRUSTED_PUBLISHING_NPM_MINIMUM = "11.5.1";
/** @type {string} */
export const TRUSTED_PUBLISHING_NPM_BELOW = "12.0.0";

/**
 * @param {string} version
 * @returns {{ core: number[], suffix: string }}
 */
function parseCore(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)((?:[-+]).*)?$/.exec(version);
  if (!match) throw new Error(`invalid npm version bound: ${version}`);
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], suffix: match[4] ?? "" };
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareCoreVersions(left, right) {
  const a = parseCore(left);
  const b = parseCore(right);
  for (let index = 0; index < 3; index += 1) {
    const aValue = a.core[index] ?? 0;
    const bValue = b.core[index] ?? 0;
    if (aValue !== bValue) return aValue - bValue;
  }
  // SemVer: a prerelease precedes its release. The bounds are plain x.y.z,
  // so a prerelease npm (11.5.1-rc.0) must stay below the 11.5.1 minimum.
  const aPre = a.suffix.startsWith("-") ? 0 : 1;
  const bPre = b.suffix.startsWith("-") ? 0 : 1;
  return aPre - bPre;
}

/**
 * Parse only a single semver-like npm --version line; npm must not be guessed from Node metadata.
 * @param {string} output
 * @returns {string}
 */
export function parseNpmVersion(output) {
  const lines = String(output)
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const first = lines[0];
  if (
    lines.length !== 1 ||
    first === undefined ||
    !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(first)
  ) {
    throw new Error(`npm --version returned an invalid value: ${JSON.stringify(output)}`);
  }
  return first;
}

/**
 * @param {string} output
 * @param {string} [minimum]
 * @param {string} [below]
 * @returns {string}
 */
export function assertTrustedPublishingNpm(
  output,
  minimum = TRUSTED_PUBLISHING_NPM_MINIMUM,
  below = TRUSTED_PUBLISHING_NPM_BELOW,
) {
  const actual = parseNpmVersion(output);
  if (compareCoreVersions(actual, minimum) < 0 || compareCoreVersions(actual, below) >= 0) {
    throw new Error(
      `trusted publishing requires npm >=${minimum} <${below}; executable npm reported ${actual}`,
    );
  }
  return actual;
}

/**
 * @param {string} [command]
 * @returns {string}
 */
export function readExecutableNpmVersion(command = "npm") {
  return assertTrustedPublishingNpm(execFileSync(command, ["--version"], { encoding: "utf8" }));
}

/**
 * @param {string[]} argv
 * @param {string} name
 * @returns {string | undefined}
 */
function argValue(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) throw new Error(`${name} requires a value`);
  return value;
}

/**
 * @param {string[]} [argv]
 * @returns {Record<string, unknown>}
 */
export function main(argv = process.argv) {
  const minimum = argValue(argv, "--expected") ?? TRUSTED_PUBLISHING_NPM_MINIMUM;
  const output = argValue(argv, "--version-output");
  const actual =
    output === undefined
      ? assertTrustedPublishingNpm(
          execFileSync("npm", ["--version"], { encoding: "utf8" }),
          minimum,
        )
      : assertTrustedPublishingNpm(output, minimum);
  const result = { ok: true, minimum, below: TRUSTED_PUBLISHING_NPM_BELOW, actual };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

const invokedScript = process.argv[1];
const invokedDirectly =
  invokedScript !== undefined &&
  invokedScript !== "" &&
  import.meta.url === pathToFileURL(invokedScript).href;
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
