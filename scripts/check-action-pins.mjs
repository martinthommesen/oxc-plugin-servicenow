import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseDocument } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pinEntries = parseActionPinCatalog(
  readFileSync(join(root, "scripts/action-pins.json"), "utf8"),
);

export function parseActionPinCatalog(source) {
  const document = parseDocument(source, { strict: true });
  const parseProblems = [...document.errors, ...document.warnings];
  if (parseProblems.length > 0) {
    throw new Error(
      `invalid action pin catalog:\n${parseProblems.map(({ message }) => message).join("\n")}`,
    );
  }
  let catalog;
  try {
    catalog = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `invalid action pin catalog: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!Array.isArray(catalog)) {
    throw new Error("invalid action pin catalog: expected an array of action pins");
  }
  return catalog;
}

function collectUses(workflow) {
  const references = [];
  if (!workflow || typeof workflow !== "object") return references;
  // Composite actions put their steps under runs.steps instead of jobs.
  const runsSteps = workflow.runs?.steps;
  if (Array.isArray(runsSteps)) {
    for (const step of runsSteps) {
      if (step && typeof step === "object" && !Array.isArray(step) && Object.hasOwn(step, "uses")) {
        references.push(step.uses);
      }
    }
  }
  const jobs = workflow.jobs;
  if (!jobs || typeof jobs !== "object" || Array.isArray(jobs)) return references;
  for (const job of Object.values(jobs)) {
    if (!job || typeof job !== "object" || Array.isArray(job)) continue;
    if (Object.hasOwn(job, "uses")) references.push(job.uses);
    if (!Array.isArray(job.steps)) continue;
    for (const step of job.steps) {
      if (step && typeof step === "object" && !Array.isArray(step) && Object.hasOwn(step, "uses")) {
        references.push(step.uses);
      }
    }
  }
  return references;
}

export function checkActionPinSources(sources, reviewedPinEntries) {
  const pins = new Map();
  const errors = [];
  for (const entry of reviewedPinEntries) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.action !== "string" ||
      !/^[^@\s]+$/.test(entry.action) ||
      typeof entry.commit !== "string" ||
      !/^[0-9a-f]{40}$/.test(entry.commit)
    ) {
      errors.push("scripts/action-pins.json contains an invalid action pin entry");
      continue;
    }
    if (pins.has(entry.action)) {
      errors.push(`scripts/action-pins.json contains duplicate action ${entry.action}`);
      continue;
    }
    pins.set(entry.action, entry.commit);
  }

  const seen = new Map();
  for (const { file, text } of sources) {
    const document = parseDocument(text, { strict: true, merge: true });
    const parseProblems = [...document.errors, ...document.warnings];
    if (parseProblems.length > 0) {
      for (const problem of parseProblems) errors.push(`${file}: ${problem.message}`);
      continue;
    }
    let workflow;
    try {
      workflow = document.toJS({ maxAliasCount: 100 });
    } catch (error) {
      errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const references = collectUses(workflow);
    for (const reference of references) {
      if (typeof reference !== "string") {
        errors.push(`${file}: uses must be a string action reference`);
        continue;
      }
      if (reference.startsWith("./")) continue;
      const separator = reference.lastIndexOf("@");
      const action = separator > 0 ? reference.slice(0, separator) : reference;
      const ref = separator > 0 ? reference.slice(separator + 1) : "";
      if (!/^[0-9a-f]{40}$/.test(ref)) {
        errors.push(`${file}: ${reference} is not pinned to a full SHA`);
        continue;
      }
      if (!pins.has(action)) {
        errors.push(`${file}: ${action} is not in scripts/action-pins.json`);
      } else if (pins.get(action) !== ref) {
        errors.push(
          `${file}: ${action}@${ref} differs from centrally reviewed ${pins.get(action)}`,
        );
      }
      const prior = seen.get(action);
      if (prior && prior.ref !== ref) errors.push(`${file}: ${action} diverges from ${prior.file}`);
      else if (!prior) seen.set(action, { file, ref });
    }
  }
  for (const action of pins.keys()) {
    if (!seen.has(action)) errors.push(`central pin ${action} is unused`);
  }
  if (errors.length) throw new Error(`workflow action pin check failed:\n${errors.join("\n")}`);
  return { workflows: sources.length, actions: seen.size };
}

// Local composite actions (`uses: ./.github/actions/...`) are exempt from
// SHA pinning, but their own action.yml steps can reference third-party
// actions, so those files are scanned too (FINDINGS.md IMP-001).
function compositeActionSources() {
  const actionsRoot = join(root, ".github/actions");
  if (!existsSync(actionsRoot)) return [];
  return readdirSync(actionsRoot, { recursive: true, encoding: "utf8" })
    .filter((name) => /(?:^|\/)action\.(?:yml|yaml)$/.test(name))
    .sort()
    .map((name) => ({
      file: join(".github/actions", name),
      text: readFileSync(join(actionsRoot, name), "utf8"),
    }));
}

export function checkActionPins() {
  const workflows = readdirSync(join(root, ".github/workflows"))
    .filter((name) => /\.(?:yml|yaml)$/.test(name))
    .sort();
  const sources = workflows.map((file) => ({
    file,
    text: readFileSync(join(root, ".github/workflows", file), "utf8"),
  }));
  return checkActionPinSources([...sources, ...compositeActionSources()], pinEntries);
}

export function main() {
  const result = checkActionPins();
  console.log(
    `checked ${result.actions} centrally pinned actions across ${result.workflows} workflows`,
  );
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
