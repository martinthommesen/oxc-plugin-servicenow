import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Bounded range instead of exact equality (FINDINGS.md IMP-002): npm OIDC
// trusted publishing needs at least the minimum, and the exclusive upper
// bound keeps an untested major from running the publish step. The observed
// version is printed in the result JSON for audit.
export const TRUSTED_PUBLISHING_NPM_MINIMUM = "11.5.1";
export const TRUSTED_PUBLISHING_NPM_BELOW = "12.0.0";
/** @deprecated Use TRUSTED_PUBLISHING_NPM_MINIMUM. */
export const TRUSTED_PUBLISHING_NPM_VERSION = TRUSTED_PUBLISHING_NPM_MINIMUM;

function compareCoreVersions(left, right) {
  const a = left.split(/[-+]/)[0].split(".").map(Number);
  const b = right.split(/[-+]/)[0].split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

/** Parse only a single semver-like npm --version line; npm must not be guessed from Node metadata. */
export function parseNpmVersion(output) {
  const lines = String(output)
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 1 || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(lines[0])) {
    throw new Error(`npm --version returned an invalid value: ${JSON.stringify(output)}`);
  }
  return lines[0];
}

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

export function readExecutableNpmVersion(command = "npm") {
  return assertTrustedPublishingNpm(execFileSync(command, ["--version"], { encoding: "utf8" }));
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) throw new Error(`${name} requires a value`);
  return value;
}

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
