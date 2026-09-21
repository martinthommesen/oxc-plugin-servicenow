import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * @param {string} path
 * @returns {any}
 */
export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Write `value` as a complete JSON document, so a concurrent reader never
 * observes a partially written artifact.
 *
 * @param {string} path
 * @param {unknown} value
 * @returns {void}
 */
export function writeJsonArtifact(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryDirectory = mkdtempSync(join(dirname(path), ".atomic-artifact-"));
  const temporaryPath = join(temporaryDirectory, "artifact.json");
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}
