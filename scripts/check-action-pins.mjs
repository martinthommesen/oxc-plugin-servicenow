import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pins = JSON.parse(readFileSync(join(root, "scripts/action-pins.json"), "utf8"));
function compositeActionFiles() {
  const actionsRoot = join(root, ".github/actions");
  if (!existsSync(actionsRoot)) return [];
  return readdirSync(actionsRoot, { recursive: true, encoding: "utf8" })
    .filter((name) => /(?:^|\/)action\.(?:yml|yaml)$/.test(name))
    .map((name) => join(".github/actions", name));
}

export function checkActionPins() {
  const workflows = readdirSync(join(root, ".github/workflows"))
    .filter((name) => /\.(?:yml|yaml)$/.test(name))
    .map((name) => join(".github/workflows", name));
  const files = [...workflows, ...compositeActionFiles()];
  const seen = new Map();
  const errors = [];
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    // Any uses: value without owner/repo@sha shape is a hard failure. A local
    // composite action or docker:// reference cannot be SHA-pinned and must
    // not pass silently (FINDINGS.md IMP-001).
    for (const match of text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
      const reference = match[1].replace(/^['"]|['"]$/g, "");
      const at = reference.indexOf("@");
      if (at < 0) {
        errors.push(`${file}: uses ${reference} is not a SHA-pinnable owner/repo reference`);
        continue;
      }
      const action = reference.slice(0, at);
      const ref = reference.slice(at + 1);
      if (!action || !ref) continue;
      if (!/^[0-9a-f]{40}$/.test(ref))
        errors.push(`${file}: ${action} is not pinned to a full SHA`);
      if (!(action in pins)) errors.push(`${file}: ${action} is not in scripts/action-pins.json`);
      else if (pins[action] !== ref)
        errors.push(`${file}: ${action}@${ref} differs from centrally reviewed ${pins[action]}`);
      const prior = seen.get(action);
      if (prior && prior.ref !== ref) errors.push(`${file}: ${action} diverges from ${prior.file}`);
      else if (!prior) seen.set(action, { file, ref });
    }
  }
  for (const action of Object.keys(pins)) {
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
