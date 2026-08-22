import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exactVersion = /^\d+\.\d+\.\d+$/;

function loadJson(file) {
  return JSON.parse(readFileSync(join(root, file), "utf8"));
}

export function checkCompatibilityMatrix() {
  const matrix = loadJson("scripts/compat-matrix.json");
  const pkg = loadJson("package.json");
  const errors = [];
  const ids = matrix.cells?.map((cell) => cell.id) ?? [];

  if (!exactVersion.test(matrix.resolvedAt?.replaceAll("-", ".") ?? "")) {
    errors.push("resolvedAt must be an exact YYYY-MM-DD date");
  }
  if (new Set(ids).size !== ids.length)
    errors.push("compatibility matrix contains duplicate cell IDs");
  if (ids.length === 0) errors.push("compatibility matrix has no cells");
  if (!ids.includes(matrix.localSmokeCell))
    errors.push("compatibility matrix localSmokeCell does not name an exact cell");

  const requiredCellFields = ["node", "npm", "oxlint", "eslint", "oxfmt"];
  for (const cell of matrix.cells ?? []) {
    if (!/^[a-z0-9-]+$/.test(cell.id ?? ""))
      errors.push(`${cell.id ?? "(missing id)"} has an invalid ID`);
    for (const field of requiredCellFields) {
      if (!exactVersion.test(cell[field] ?? ""))
        errors.push(`${cell.id} ${field} is not an exact version`);
    }
    const hasParser = cell.typescriptEslint !== undefined || cell.typescript !== undefined;
    if (
      hasParser &&
      (!exactVersion.test(cell.typescriptEslint ?? "") || !exactVersion.test(cell.typescript ?? ""))
    ) {
      errors.push(
        `${cell.id} must define exact typescript-eslint and TypeScript versions together`,
      );
    }
    if (cell.eslint.startsWith("10.") && hasParser) {
      errors.push(`${cell.id} must not compose typescript-eslint with ESLint 10`);
    }
  }

  const cellNodes = new Set((matrix.cells ?? []).map((cell) => cell.node));
  for (const runtime of matrix.node.supported ?? []) {
    if (!exactVersion.test(runtime)) errors.push(`Node runtime ${runtime} is not exact`);
    if (!cellNodes.has(runtime)) errors.push(`Node runtime ${runtime} has no compatibility cell`);
  }
  for (const [name, expected] of [
    ["node engines", matrix.node.engines],
    ["oxlint peer", matrix.oxlint.peer],
    ["ESLint peer", matrix.eslint.peer],
    ["oxfmt peer", matrix.oxfmt.peer],
    ["typescript-eslint peer", matrix.typescriptEslint.peer],
    ["@oxlint/plugins dependency", matrix.oxlintPlugins.dependency],
  ]) {
    const actual =
      name === "node engines"
        ? pkg.engines?.node
        : name === "@oxlint/plugins dependency"
          ? pkg.dependencies?.["@oxlint/plugins"]
          : pkg.peerDependencies?.[
              name === "oxlint peer"
                ? "oxlint"
                : name === "ESLint peer"
                  ? "eslint"
                  : name === "oxfmt peer"
                    ? "oxfmt"
                    : "typescript-eslint"
            ];
    if (actual !== expected)
      errors.push(`${name} is ${actual ?? "missing"}; matrix requires ${expected}`);
  }

  for (const workflow of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
    const text = readFileSync(join(root, workflow), "utf8");
    if (!text.includes("node scripts/check-compat-matrix.mjs --github-matrix")) {
      errors.push(`${workflow} does not generate its matrix from scripts/compat-matrix.json`);
    }
    if (!text.includes("fromJSON(needs."))
      errors.push(`${workflow} does not consume the generated matrix`);
    if (/^\s+- cell:/m.test(text)) errors.push(`${workflow} contains copied compatibility cells`);
  }

  if (errors.length) throw new Error(`compatibility matrix check failed:\n${errors.join("\n")}`);
  return {
    cells: ids.length,
    matrix: { include: matrix.cells.map((cell) => ({ cell: cell.id, node: cell.node })) },
  };
}

export function main() {
  const result = checkCompatibilityMatrix();
  if (process.argv.includes("--github-matrix")) {
    process.stdout.write(`${JSON.stringify(result.matrix)}\n`);
  } else {
    console.log(`checked ${result.cells} exact compatibility cells against package and workflows`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
