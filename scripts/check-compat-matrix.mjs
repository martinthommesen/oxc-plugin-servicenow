import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rangeFloor, rangeTopMajor, satisfiesRange } from "./lib/semver-range.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exactVersion = /^\d+\.\d+\.\d+$/;

function loadJson(file) {
  return JSON.parse(readFileSync(join(root, file), "utf8"));
}

/**
 * Reconcile the published peer ranges with the tested compatibility policy in
 * both directions: an advertised host range that no cell exercises, and a
 * combination the project rejects that npm would nonetheless install, are both
 * failures. Previously the ESLint 10 rejection lived as one hardcoded rule with
 * no link back to the peer metadata that advertised it (FINDINGS.md OPS-011).
 */
export function checkSupportPolicy(matrix, pkg) {
  const errors = [];
  const policy = matrix.supportPolicy;
  const components = policy?.components;
  if (!components || Object.keys(components).length === 0) {
    return ["compatibility matrix has no supportPolicy.components"];
  }
  const peerName = (key) => (key === "typescriptEslint" ? "typescript-eslint" : key);
  const testedVersions = new Map();

  for (const [key, component] of Object.entries(components)) {
    const declared = pkg.peerDependencies?.[peerName(key)];
    if (declared !== component.peer) {
      errors.push(
        `${peerName(key)} peer is ${declared ?? "missing"}; support policy declares ${component.peer}`,
      );
    }
    if (matrix[key]?.peer !== undefined && matrix[key].peer !== component.peer) {
      errors.push(`${key} range disagrees with its support policy entry`);
    }
    const versions = (component.tested ?? []).map((field) => ({
      field,
      version: matrix[key]?.[field],
    }));
    if (versions.length === 0) errors.push(`${key} support policy lists no tested versions`);
    testedVersions.set(
      key,
      versions.map((entry) => entry.version).filter((version) => exactVersion.test(version ?? "")),
    );
    for (const { field, version } of versions) {
      if (!exactVersion.test(version ?? "")) {
        errors.push(`${key}.${field} is not an exact version`);
        continue;
      }
      if (!satisfiesRange(version, component.peer)) {
        errors.push(
          `${key} tested version ${version} is outside the declared peer ${component.peer}`,
        );
      }
      if (!(matrix.cells ?? []).some((cell) => cell[component.cellField] === version)) {
        errors.push(`${key} tested version ${version} has no compatibility cell`);
      }
    }
    // Both ends of what npm advertises must actually be exercised, otherwise the
    // peer range promises support for a major nothing ever ran.
    const floor = rangeFloor(component.peer);
    if (matrix[key]?.minimum !== floor) {
      errors.push(
        `${key} minimum ${matrix[key]?.minimum ?? "missing"} is not the peer floor ${floor}`,
      );
    }
    const topMajor = rangeTopMajor(component.peer);
    const covered = testedVersions.get(key) ?? [];
    if (!covered.some((version) => Number(version.split(".")[0]) === topMajor)) {
      errors.push(`${key} peer ${component.peer} advertises ${topMajor}.x but no cell tests it`);
    }
  }

  for (const combination of policy.incompatibleCombinations ?? []) {
    const label = combination.id ?? "(missing id)";
    const constraints = Object.entries(combination.components ?? {});
    if (constraints.length < 2) {
      errors.push(`${label} must constrain at least two components`);
      continue;
    }
    // A rejection record is only meaningful if the pairing is advertised; an
    // unreachable record would silently rot into a false reassurance.
    for (const [key, range] of constraints) {
      const witness = combination.witness?.[key];
      if (!exactVersion.test(witness ?? "")) {
        errors.push(`${label} has no exact ${key} witness version`);
        continue;
      }
      if (!satisfiesRange(witness, range)) {
        errors.push(
          `${label} witness ${key} ${witness} is outside its own declared range ${range}`,
        );
      }
      const peer = components[key]?.peer;
      if (peer && !satisfiesRange(witness, peer)) {
        errors.push(
          `${label} is not reachable: ${key} ${witness} is outside the published peer ${peer}`,
        );
      }
    }
    // ... and only safe if something other than our own metadata blocks it,
    // because npm peer ranges cannot express a conjunction across two packages.
    const blocked = combination.blockedBy;
    const blockedWitness = combination.witness?.[blocked?.peer];
    if (!blocked?.package || !blocked?.peer || !blocked?.range) {
      errors.push(`${label} does not record the upstream peer range that blocks it`);
    } else if (!exactVersion.test(blockedWitness ?? "")) {
      errors.push(`${label} blockedBy names ${blocked.peer}, which has no witness version`);
    } else if (satisfiesRange(blockedWitness, blocked.range)) {
      errors.push(
        `${label} claims ${blocked.package} rejects ${blocked.peer} ${blockedWitness}, but ${blocked.range} accepts it`,
      );
    }
    for (const cell of matrix.cells ?? []) {
      const matches = constraints.every(([key, range]) => {
        const value = cell[components[key]?.cellField ?? key];
        return value !== undefined && satisfiesRange(value, range);
      });
      if (matches) errors.push(`${cell.id} exercises the rejected combination ${label}`);
    }
  }
  return errors;
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
  }

  errors.push(...checkSupportPolicy(matrix, pkg));

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
