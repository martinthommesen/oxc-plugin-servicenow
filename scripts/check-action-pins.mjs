import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// A Map so a reference spelled like an Object.prototype member cannot
// resolve through the prototype chain (FINDINGS.md IMP-001, MNT-003).
const pins = new Map(
  Object.entries(JSON.parse(readFileSync(join(root, "scripts/action-pins.json"), "utf8"))),
);
function compositeActionFiles() {
  const actionsRoot = join(root, ".github/actions");
  if (!existsSync(actionsRoot)) return [];
  return readdirSync(actionsRoot, { recursive: true, encoding: "utf8" })
    .filter((name) => /(?:^|\/)action\.(?:yml|yaml)$/.test(name))
    .map((name) => join(".github/actions", name));
}

/**
 * Extract `uses:` references without a YAML dependency: the CI `workflow`
 * job runs before `npm ci`, so this file must stay dependency-free
 * (FINDINGS.md IMP-001). Lines inside `|`/`>` block scalars are skipped so a
 * `run:` body containing the literal text `uses:` is not matched as an
 * action reference.
 */
export function extractUsesReferences(text) {
  const references = [];
  let scalarIndent = -1;
  for (const line of text.split(/\r?\n/)) {
    const content = line.trim();
    const indent = line.length - line.trimStart().length;
    if (scalarIndent >= 0) {
      if (content === "" || indent > scalarIndent) continue;
      scalarIndent = -1;
    }
    if (/^[^#'"]*:\s*[|>][0-9+-]*\s*(?:#.*)?$/.test(line)) {
      scalarIndent = indent;
      continue;
    }
    const match = /^\s*-?\s*uses:\s*(\S+)/.exec(line);
    if (match) references.push(match[1].replace(/^['"]|['"]$/g, ""));
  }
  return references;
}

/** Validate one file's references against the central pin table. */
export function scanWorkflowText(file, text, seen = new Map()) {
  const errors = [];
  for (const reference of extractUsesReferences(text)) {
    // Any uses: value without owner/repo@sha shape is a hard failure. A local
    // composite action or docker:// reference cannot be SHA-pinned and must
    // not pass silently (FINDINGS.md IMP-001).
    const at = reference.indexOf("@");
    if (at < 0) {
      errors.push(`${file}: uses ${reference} is not a SHA-pinnable owner/repo reference`);
      continue;
    }
    const action = reference.slice(0, at);
    const ref = reference.slice(at + 1);
    if (!action || !ref) {
      errors.push(`${file}: uses ${reference} is malformed`);
      continue;
    }
    if (!/^[0-9a-f]{40}$/.test(ref)) errors.push(`${file}: ${action} is not pinned to a full SHA`);
    if (!pins.has(action)) errors.push(`${file}: ${action} is not in scripts/action-pins.json`);
    else if (pins.get(action) !== ref)
      errors.push(`${file}: ${action}@${ref} differs from centrally reviewed ${pins.get(action)}`);
    const prior = seen.get(action);
    if (prior && prior.ref !== ref) errors.push(`${file}: ${action} diverges from ${prior.file}`);
    else if (!prior) seen.set(action, { file, ref });
  }
  return errors;
}

export function checkActionPins() {
  const workflows = readdirSync(join(root, ".github/workflows"))
    .filter((name) => /\.(?:yml|yaml)$/.test(name))
    .map((name) => join(".github/workflows", name));
  const files = [...workflows, ...compositeActionFiles()];
  const seen = new Map();
  const errors = [];
  for (const file of files) {
    errors.push(...scanWorkflowText(file, readFileSync(join(root, file), "utf8"), seen));
  }
  for (const action of pins.keys()) {
    if (!seen.has(action)) errors.push(`central pin ${action} is unused`);
  }
  if (errors.length) throw new Error(`workflow action pin check failed:\n${errors.join("\n")}`);
  return { workflows: files.length, actions: seen.size };
}

export function main() {
  const result = checkActionPins();
  console.log(
    `checked ${result.actions} centrally pinned actions across ${result.workflows} workflows`,
  );
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
