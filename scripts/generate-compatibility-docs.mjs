import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(await readFile(join(root, "scripts/compat-matrix.json"), "utf8"));

function replaceMarkedSection(source, name, body) {
  const start = `<!-- generated:${name}:start -->`;
  const end = `<!-- generated:${name}:end -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(source)) {
    throw new Error(`Missing ${start} / ${end} markers`);
  }
  return source.replace(pattern, `${start}\n${body.trim()}\n${end}`);
}

const cellRows = matrix.cells
  .map(
    (cell) =>
      `| \`${cell.id}\` | ${cell.node} | ${cell.npm} | ${cell.oxlint} | ${cell.eslint} | ${cell.oxfmt} | ${cell.typescriptEslint ?? "not installed"} | ${cell.typescript ?? "not installed"} |`,
  )
  .join("\n");

const page = `# Compatibility

This page is generated from \`scripts/compat-matrix.json\`. Do not edit it by hand. Run \`npm run docs\` after you change the matrix.

CI runs every cell under its exact Node runtime. Local \`npm run compat\` uses the \`${matrix.localSmokeCell}\` dependency set under the current host Node and npm. \`npm run compat -- --all\` is only a same-runtime dependency smoke test and is not multi-runtime proof.

## Declared ranges

| Component | Declared range | Tested minimum | Tested current or latest |
| --- | --- | --- | --- |
| Node.js | \`${matrix.node.engines}\` | ${matrix.node.minimum} | ${matrix.node.supported.join(", ")} |
| oxlint | \`${matrix.oxlint.peer}\` | ${matrix.oxlint.minimum} | ${matrix.oxlint.highestCompatible} |
| \`@oxlint/plugins\` | \`${matrix.oxlintPlugins.dependency}\` | ${matrix.oxlintPlugins.pinned} | ${matrix.oxlintPlugins.pinned} |
| ESLint | \`${matrix.eslint.peer}\` | ${matrix.eslint.minimum} | ${matrix.eslint.currentV9} and ${matrix.eslint.current} |
| oxfmt | \`${matrix.oxfmt.peer}\` | ${matrix.oxfmt.minimum} | ${matrix.oxfmt.highestCompatible} |
| typescript-eslint | \`${matrix.typescriptEslint.peer}\` (optional) | ${matrix.typescriptEslint.minimum} | ${matrix.typescriptEslint.current} |
| TypeScript parser runtime | optional parser dependency | ${matrix.typescript.minimum} | ${matrix.typescript.current} |
| Fluent SDK knowledge | selected \`fluentSdkVersion\` | ${matrix.fluentSdk.join(", ")} | unspecified selects the current manifest |
| ServiceNow JavaScript | ${matrix.javascriptModes.map((mode) => `\`${mode}\``).join(", ")} | all listed modes | unknown never assumes ES5 |

## Packed-consumer matrix

| Cell | Node | npm | oxlint | ESLint | oxfmt | typescript-eslint | TypeScript |
| --- | --- | --- | --- | --- | --- | --- | --- |
${cellRows}

A cell fails with one of these classes: \`package\`, \`host-api\`, \`runtime\`, \`parser\`, or \`formatter\`. Parser cells exercise the exported ESLint configuration on real \`.now.ts\` and \`.now.tsx\` files. ESLint 10 cells omit typescript-eslint because its current peer range does not accept ESLint 10. Every supported combination installs with normal npm peer resolution.

## Contributors

Contributor installs need Node ${matrix.node.minimum} or later because development tooling (\`oxc-parser\`, \`tsx\`, oxlint JS plugins) targets that floor.

Consumer applications use the same Node floor. There is no separate older consumer runtime.

## Documentation URLs

Rule \`docs.url\` values point at \`blob/main/docs/rules\`. Release tags keep those files on \`main\` until a versioned docs path is generated from the published tag.
`;

await writeFile(join(root, "docs/compatibility.md"), page);

const readmePath = join(root, "README.md");
let readme = await readFile(readmePath, "utf8");
const table = [
  "| Component | Tested range |",
  "| --- | --- |",
  `| Node | ${matrix.node.supported.join(", ")} |`,
  `| oxlint | ${matrix.oxlint.minimum} and ${matrix.oxlint.highestCompatible} (\`${matrix.oxlint.peer}\`) |`,
  `| ESLint | ${matrix.eslint.minimum}, ${matrix.eslint.currentV9}, and ${matrix.eslint.current} (\`${matrix.eslint.peer}\`) |`,
  `| oxfmt | ${matrix.oxfmt.minimum} and ${matrix.oxfmt.highestCompatible} (\`${matrix.oxfmt.peer}\`) |`,
  `| ServiceNow engine tables | Zurich feature-support document |`,
  `| Fluent SDK | ${matrix.fluentSdk.join(", ")} |`,
].join("\n");
readme = replaceMarkedSection(readme, "compatibility", table);
await writeFile(readmePath, readme);
console.log("updated docs/compatibility.md and README compatibility table");
