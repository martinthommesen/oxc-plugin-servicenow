import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * True when `url` names the module Node was started with, so a script can
 * export helpers for tests and still run its own driver when invoked.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isMainModule(url) {
  const entry = process.argv[1];
  return entry !== undefined && entry !== "" && pathToFileURL(entry).href === url;
}
