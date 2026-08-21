import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pins = Object.fromEntries(
  JSON.parse(readFileSync(join(root, "scripts/action-pins.json"), "utf8")).map(
    ({ action, commit }) => [action, commit],
  ),
);
export function checkActionPins() {
  const workflows = readdirSync(join(root, ".github/workflows")).filter((name) =>
    /\.(?:yml|yaml)$/.test(name),
  );
  const seen = new Map();
  const errors = [];
  for (const file of workflows) {
    const text = readFileSync(join(root, ".github/workflows", file), "utf8");
    for (const match of text.matchAll(/^\s*-?\s*uses:\s*([^@\s]+)@([^\s#]+)/gm)) {
      const [, action, ref] = match;
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
  return { workflows: workflows.length, actions: seen.size };
}

export function main() {
  const result = checkActionPins();
  console.log(
    `checked ${result.actions} centrally pinned actions across ${result.workflows} workflows`,
  );
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
