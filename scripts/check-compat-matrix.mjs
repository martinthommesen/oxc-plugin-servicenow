import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function checkCompatibilityMatrix() {
  const matrix = JSON.parse(readFileSync(join(root, "scripts/compat-matrix.json"), "utf8"));
  const ids = matrix.cells.map((cell) => cell.id);
  const errors = [];
  if (new Set(ids).size !== ids.length) errors.push("compatibility matrix contains duplicate cell IDs");
  for (const cell of matrix.cells) {
    if (!cell.node || !cell.oxlint || !cell.eslint || !cell.oxfmt) errors.push(`${cell.id} is missing a host dimension`);
  }
  for (const workflow of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
    const text = readFileSync(join(root, workflow), "utf8");
    const actual = [...text.matchAll(/^\s+(?:- )?cell: ([^\s]+)$/gm)].map((match) => match[1]);
    const expected = workflow.endsWith("ci.yml") ? ids : ids;
    if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
      errors.push(`${workflow} consumer cells do not match scripts/compat-matrix.json`);
    }
  }
  if (errors.length) throw new Error(`compatibility matrix check failed:\n${errors.join("\n")}`);
  return { cells: ids.length };
}

export function main() {
  const result = checkCompatibilityMatrix();
  console.log(`checked ${result.cells} compatibility cells against CI and release workflows`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
