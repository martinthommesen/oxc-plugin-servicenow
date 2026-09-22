import { execFileSync } from "node:child_process";
import { root } from "./repo.mjs";

// A file-system monitor daemon this process does not control can answer a
// status read from its own cache, so every read disables it.
const FSMONITOR_OFF = ["-c", "core.fsmonitor=false"];
// Node's own execFileSync default; named so a caller that needs more says so.
const DEFAULT_MAX_BUFFER = 1024 * 1024;

/**
 * Run git against the repository and return its stdout.
 *
 * @param {readonly string[]} args
 * @param {{ cwd?: string, maxBuffer?: number }} [options]
 * @returns {string}
 */
export function git(args, options = {}) {
  return execFileSync("git", [...FSMONITOR_OFF, ...args], {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
  });
}
