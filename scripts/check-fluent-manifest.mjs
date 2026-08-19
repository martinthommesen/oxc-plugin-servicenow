import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { DEFAULT_FLUENT_MANIFEST } = await import(
  pathToFileURL(join(root, "src/fluent/manifest.ts")).href
);

const REQUIRED_DIRECTIVES = [
  "fluent-ignore",
  "fluent-disable-sync",
  "fluent-disable-sync-for-file",
];

const names = new Set(DEFAULT_FLUENT_MANIFEST.directives.map((item) => item.name));
for (const name of REQUIRED_DIRECTIVES) {
  assert.ok(names.has(name), `manifest is missing official directive @${name}`);
}

for (const api of DEFAULT_FLUENT_MANIFEST.apis) {
  assert.ok(api.evidence, `${api.name} needs an evidence URL`);
}

console.log(
  `Fluent manifest ${DEFAULT_FLUENT_MANIFEST.version}: ${DEFAULT_FLUENT_MANIFEST.apis.length} APIs, ${DEFAULT_FLUENT_MANIFEST.directives.length} directives`,
);
