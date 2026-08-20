import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const TRUSTED_PUBLISHING_NPM_VERSION = "11.5.1";

/** Parse only a single semver-like npm --version line; npm must not be guessed from Node metadata. */
export function parseNpmVersion(output) {
  const lines = String(output).trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length !== 1 || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(lines[0])) {
    throw new Error(`npm --version returned an invalid value: ${JSON.stringify(output)}`);
  }
  return lines[0];
}

export function assertTrustedPublishingNpm(output, expected = TRUSTED_PUBLISHING_NPM_VERSION) {
  const actual = parseNpmVersion(output);
  if (actual !== expected) {
    throw new Error(`trusted publishing requires npm ${expected}; executable npm reported ${actual}`);
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
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

export function main(argv = process.argv) {
  const expected = argValue(argv, "--expected") ?? TRUSTED_PUBLISHING_NPM_VERSION;
  const output = argValue(argv, "--version-output");
  const actual = output === undefined ? assertTrustedPublishingNpm(execFileSync("npm", ["--version"], { encoding: "utf8" }), expected) : assertTrustedPublishingNpm(output, expected);
  const result = { ok: true, expected, actual };
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
