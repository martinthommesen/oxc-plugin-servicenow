import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { root } from "./lib/repo.mjs";

const exactVersion = /^\d+\.\d+\.\d+$/;

/**
 * First typescript-eslint line whose peer range admits ESLint 10. Parser cells
 * on ESLint 10 must install a parser at or above this version, and the
 * generated compatibility page states the same floor (FINDINGS.md OPS-011).
 */
export const MIN_TYPESCRIPT_ESLINT_FOR_ESLINT_10 = "8.56.0";

/**
 * @typedef {object} CompatibilityCheckResult
 * @property {number} cells
 * @property {{ include: Array<{ cell: string, node: string }> }} matrix
 */

/**
 * @param {string} file
 * @returns {any}
 */
function loadJson(file) {
  return JSON.parse(readFileSync(join(root, file), "utf8"));
}

/**
 * @returns {CompatibilityCheckResult}
 */
export function checkCompatibilityMatrix() {
  const matrix = loadJson("scripts/compat-matrix.json");
  const pkg = loadJson("package.json");
  const errors = [];
  const ids = matrix.cells?.map(/** @param {any} cell */ (cell) => cell.id) ?? [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(matrix.resolvedAt ?? "")) {
    errors.push("resolvedAt must be an exact YYYY-MM-DD date");
  }
  if (new Set(ids).size !== ids.length)
    errors.push("compatibility matrix contains duplicate cell IDs");
  if (ids.length === 0) errors.push("compatibility matrix has no cells");
  if (!ids.includes(matrix.localSmokeCell))
    errors.push("compatibility matrix localSmokeCell does not name an exact cell");

  const releases = matrix.serviceNowReleases;
  if (!Array.isArray(releases) || releases.length === 0) {
    errors.push("compatibility matrix has no ServiceNow releases");
  } else {
    if (new Set(releases).size !== releases.length) {
      errors.push("compatibility matrix contains duplicate ServiceNow releases");
    }
    for (const release of releases) {
      if (typeof release !== "string" || !/^[a-z][a-z0-9-]*$/.test(release)) {
        errors.push(`invalid ServiceNow release ${JSON.stringify(release)}`);
      }
    }
  }

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
      // Older parser lines must stay on the ESLint 9 cells.
      const [floorMajor, floorMinor] = MIN_TYPESCRIPT_ESLINT_FOR_ESLINT_10.split(".").map(Number);
      const [parserMajor, parserMinor] = String(cell.typescriptEslint ?? "")
        .split(".")
        .map(Number);
      const major = parserMajor ?? 0;
      const floor = floorMajor ?? 0;
      const supportsEslint10 =
        major > floor || (major === floor && (parserMinor ?? 0) >= (floorMinor ?? 0));
      if (!supportsEslint10) {
        errors.push(
          `${cell.id} must not compose typescript-eslint below ${MIN_TYPESCRIPT_ESLINT_FOR_ESLINT_10} with ESLint 10`,
        );
      }
    }
  }

  const cellNodes = new Set((matrix.cells ?? []).map(/** @param {any} cell */ (cell) => cell.node));
  for (const runtime of matrix.node.supported ?? []) {
    if (!exactVersion.test(runtime)) errors.push(`Node runtime ${runtime} is not exact`);
    if (!cellNodes.has(runtime)) errors.push(`Node runtime ${runtime} has no compatibility cell`);
  }
  // TypeScript has no package peer entry: it reaches parser cells through
  // typescript-eslint's own peer range, so declaring one here would force a
  // TypeScript install on oxlint-only consumers. Pin the published minimum and
  // current values to the cells that prove them instead (FINDINGS.md OPS-011).
  const cellTypescripts = new Set(
    (matrix.cells ?? []).map(/** @param {any} cell */ (cell) => cell.typescript),
  );
  for (const published of [matrix.typescript?.minimum, matrix.typescript?.current]) {
    if (!exactVersion.test(published ?? "")) {
      errors.push(`TypeScript published value ${published ?? "missing"} is not exact`);
    } else if (!cellTypescripts.has(published)) {
      errors.push(`TypeScript ${published} has no compatibility cell`);
    }
  }
  /** @type {Array<[string, unknown, unknown]>} */
  const versionPins = [
    ["node engines", pkg.engines?.node, matrix.node.engines],
    ["oxlint peer", pkg.peerDependencies?.["oxlint"], matrix.oxlint.peer],
    ["ESLint peer", pkg.peerDependencies?.["eslint"], matrix.eslint.peer],
    ["oxfmt peer", pkg.peerDependencies?.["oxfmt"], matrix.oxfmt.peer],
    [
      "typescript-eslint peer",
      pkg.peerDependencies?.["typescript-eslint"],
      matrix.typescriptEslint.peer,
    ],
    [
      "@oxlint/plugins dependency",
      pkg.dependencies?.["@oxlint/plugins"],
      matrix.oxlintPlugins.dependency,
    ],
  ];
  for (const [name, actual, expected] of versionPins) {
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
    matrix: {
      include: matrix.cells.map(
        /** @param {any} cell */ (cell) => ({
          cell: cell.id,
          node: cell.node,
        }),
      ),
    },
  };
}

/**
 * @returns {CompatibilityCheckResult}
 */
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
