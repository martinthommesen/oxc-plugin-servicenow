import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { replaceMarkedSection } from "./lib/generated-artifacts.mjs";
import { MIN_TYPESCRIPT_ESLINT_FOR_ESLINT_10 } from "./check-compat-matrix.mjs";
import { table } from "./lib/markdown-table.mjs";
import { root } from "./lib/repo.mjs";

const matrix = JSON.parse(await readFile(join(root, "scripts/compat-matrix.json"), "utf8"));
const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

/** @type {Array<any>} */
const cells = matrix.cells;
/** @type {Array<any>} */
const modes = matrix.javascriptModes;
const cellTable = table(
  ["Cell", "Node", "npm", "oxlint", "ESLint", "oxfmt", "typescript-eslint", "TypeScript"],
  cells.map((cell) => [
    `\`${cell.id}\``,
    cell.node,
    cell.npm,
    cell.oxlint,
    cell.eslint,
    cell.oxfmt,
    cell.typescriptEslint ?? "not installed",
    cell.typescript ?? "not installed",
  ]),
);
const declaredRangeTable = table(
  ["Component", "Declared range", "Tested minimum", "Tested current or latest"],
  [
    [
      "Node.js",
      `\`${matrix.node.engines}\``,
      matrix.node.minimum,
      matrix.node.supported.join(", "),
    ],
    ["oxlint", `\`${matrix.oxlint.peer}\``, matrix.oxlint.minimum, matrix.oxlint.highestCompatible],
    [
      "`@oxlint/plugins`",
      `\`${matrix.oxlintPlugins.dependency}\``,
      matrix.oxlintPlugins.pinned,
      matrix.oxlintPlugins.pinned,
    ],
    [
      "ESLint",
      `\`${matrix.eslint.peer}\``,
      matrix.eslint.minimum,
      `${matrix.eslint.currentV9} and ${matrix.eslint.current}`,
    ],
    ["oxfmt", `\`${matrix.oxfmt.peer}\``, matrix.oxfmt.minimum, matrix.oxfmt.highestCompatible],
    [
      "typescript-eslint",
      `\`${matrix.typescriptEslint.peer}\` (optional)`,
      matrix.typescriptEslint.minimum,
      matrix.typescriptEslint.current,
    ],
    [
      "TypeScript parser runtime",
      "optional parser dependency",
      matrix.typescript.minimum,
      matrix.typescript.current,
    ],
    [
      "Fluent SDK knowledge",
      "selected `fluentSdkVersion`",
      matrix.fluentSdk.join(", "),
      "unspecified selects the current manifest",
    ],
    [
      "ServiceNow release knowledge",
      "selected `release`",
      matrix.serviceNowReleases.join(", "),
      "unspecified uses only facts shared by every listed release",
    ],
    [
      "ServiceNow JavaScript",
      modes.map((mode) => `\`${mode}\``).join(", "),
      "all listed modes",
      "unknown never assumes ES5",
    ],
  ],
);
// Cells without a parser exercise the oxlint/oxfmt-only path; the parser floor
// for ESLint 10 cells is the same constant the matrix check enforces.
const parserless = cells
  .filter((cell) => cell.typescriptEslint === undefined)
  .map((cell) => `\`${cell.id}\``);
const parserlessNote =
  parserless.length === 0
    ? ""
    : ` Cells without typescript-eslint (${parserless.join(", ")}) exercise the oxlint/oxfmt-only path.`;

const page = `# Compatibility

This page is generated from \`scripts/compat-matrix.json\`. Do not edit it by hand. Run \`npm run docs\` after you change the matrix.

CI runs every cell under its exact Node runtime. Local \`npm run compat\` uses the \`${matrix.localSmokeCell}\` dependency set under the current host Node and npm. \`npm run compat -- --all\` is only a same-runtime dependency smoke test and is not multi-runtime proof. A nightly advisory job re-resolves the top of each declared range (\`node scripts/compat-consumer.mjs --top\`) and exercises the same consumer path without gating.

## Declared ranges

${declaredRangeTable}

## Packed-consumer matrix

${cellTable}

A cell fails with one of these classes: \`package\`, \`host-api\`, \`runtime\`, \`parser\`, or \`formatter\`. Parser cells exercise the exported ESLint configuration on real \`.now.ts\` and \`.now.tsx\` files.${parserlessNote} Parser cells on ESLint 10 require typescript-eslint ${MIN_TYPESCRIPT_ESLINT_FOR_ESLINT_10} or later; older parser lines stay on the ESLint 9 cells. Every supported combination installs with normal npm peer resolution.

## Contributors

Contributor installs need Node ${matrix.node.minimum} or later because development tooling (\`oxc-parser\`, \`tsx\`, oxlint JS plugins) targets that floor.

Consumer applications use the same Node floor. There is no separate older consumer runtime.

## Documentation URLs

Rule \`docs.url\` values point at the immutable \`v${packageManifest.version}\` release tag. The protected release workflow verifies that tag before publishing the corresponding package.
`;

await writeFile(join(root, "docs/compatibility.md"), page);

const readmePath = join(root, "README.md");
let readme = await readFile(readmePath, "utf8");
const readmeTable = table(
  ["Component", "Tested range"],
  [
    ["Node", matrix.node.supported.join(", ")],
    [
      "oxlint",
      `${matrix.oxlint.minimum} and ${matrix.oxlint.highestCompatible} (\`${matrix.oxlint.peer}\`)`,
    ],
    [
      "ESLint",
      `${matrix.eslint.minimum}, ${matrix.eslint.currentV9}, and ${matrix.eslint.current} (\`${matrix.eslint.peer}\`)`,
    ],
    [
      "oxfmt",
      `${matrix.oxfmt.minimum} and ${matrix.oxfmt.highestCompatible} (\`${matrix.oxfmt.peer}\`)`,
    ],
    ["ServiceNow engine tables", matrix.serviceNowReleases.join(", ")],
    ["Fluent SDK", matrix.fluentSdk.join(", ")],
  ],
);
readme = replaceMarkedSection(readme, "compatibility", readmeTable);
await writeFile(readmePath, readme);
console.log("updated docs/compatibility.md and README compatibility table");
