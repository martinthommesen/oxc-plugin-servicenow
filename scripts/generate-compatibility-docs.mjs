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
      `| \`${cell.id}\` | ${cell.node} | ${cell.oxlint} | ${cell.eslint} | ${cell.oxfmt} |`,
  )
  .join("\n");

const page = `# Compatibility

This page is generated from \`scripts/compat-matrix.json\`. Do not edit it by hand. Run \`npm run docs\` after you change the matrix.

CI and \`npm run compat\` install the packed tarball in a clean consumer for each matrix cell that the current Node version can run.

## Declared ranges

| Component | Declared range | Tested minimum | Tested current or latest |
| --- | --- | --- | --- |
| Node.js | \`${matrix.node.engines}\` | ${matrix.node.minimum} | ${matrix.node.currentLts} LTS, ${matrix.node.currentMaintenance} maintenance, and ${matrix.node.current} Current |
| oxlint | \`${matrix.oxlint.peer}\` | ${matrix.oxlint.minimum} | ${matrix.oxlint.latestCompatible} |
| \`@oxlint/plugins\` | \`${matrix.oxlintPlugins.dependency}\` | ${matrix.oxlintPlugins.pinned} | ${matrix.oxlintPlugins.pinned} |
| ESLint | \`${matrix.eslint.peer}\` | ${matrix.eslint.minimum} | ${matrix.eslint.currentV9} and ${matrix.eslint.current} |
| oxfmt | \`${matrix.oxfmt.peer}\` | ${matrix.oxfmt.minimum} | ${matrix.oxfmt.latest} |
| typescript-eslint | \`${matrix.typescriptEslint.peer}\` (optional) | ${matrix.typescriptEslint.minimum ?? matrix.typescriptEslint.tested} | ${matrix.typescriptEslint.current ?? matrix.typescriptEslint.tested} |
| TypeScript parser runtime | optional parser dependency | ${matrix.typescript.tested} | ${matrix.typescript.tested} |
| Fluent SDK knowledge | selected \`fluentSdkVersion\` | ${matrix.fluentSdk.join(", ")} | unspecified selects the current manifest |
| ServiceNow JavaScript | ${matrix.javascriptModes.map((mode) => `\`${mode}\``).join(", ")} | all listed modes | unknown never assumes ES5 |

## Packed-consumer matrix

| Cell | Node | oxlint | ESLint | oxfmt |
| --- | --- | --- | --- | --- |
${cellRows}

A cell fails with one of these classes: \`package\`, \`host-api\`, \`runtime\`, \`parser\`, or \`formatter\`. Every cell also parses a TypeScript \`.now.tsx\` fixture with typescript-eslint ${matrix.typescriptEslint.current ?? matrix.typescriptEslint.tested} and TypeScript ${matrix.typescript.tested}; the ESLint 10 cells use npm's legacy-peer-deps install mode because that optional parser package currently declares an ESLint <10 peer, while the plugin's ESLint host API remains tested directly.

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
  `| Node | ${matrix.node.minimum}, ${matrix.node.currentLts}, ${matrix.node.currentMaintenance}, and ${matrix.node.current} |`,
  `| oxlint | ${matrix.oxlint.minimum} (\`${matrix.oxlint.peer}\`) |`,
  `| ESLint | ${matrix.eslint.minimum}, ${matrix.eslint.currentV9}, and ${matrix.eslint.current} (\`${matrix.eslint.peer}\`) |`,
  `| oxfmt | ${matrix.oxfmt.minimum} and ${matrix.oxfmt.latest} (\`${matrix.oxfmt.peer}\`) |`,
  `| ServiceNow engine tables | Zurich feature-support document |`,
  `| Fluent SDK | ${matrix.fluentSdk.join(", ")} |`,
].join("\n");
readme = replaceMarkedSection(readme, "compatibility", table);
await writeFile(readmePath, readme);
console.log("updated docs/compatibility.md and README compatibility table");
