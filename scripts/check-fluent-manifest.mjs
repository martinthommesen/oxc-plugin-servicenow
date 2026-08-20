import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  DEFAULT_FLUENT_MANIFEST,
  fluentManifests,
  SUPPORTED_FLUENT_SDK_VERSIONS,
  CURRENT_FLUENT_SDK_VERSION,
} = await import(pathToFileURL(join(root, "src/fluent/index.ts")).href);

const REQUIRED_DIRECTIVES = [
  "fluent-ignore",
  "fluent-disable-sync",
  "fluent-disable-sync-for-file",
];

const REQUIRED_PLACEMENTS = {
  "fluent-ignore": "previous-line",
  "fluent-disable-sync": "previous-line",
  "fluent-disable-sync-for-file": "first-line",
};

function summarize(manifest) {
  return {
    version: manifest.version,
    sdkVersion: manifest.sdkVersion ?? null,
    apis: manifest.apis.map((api) => ({
      name: api.name,
      module: api.module,
      kind: api.kind,
      idRequirement: api.idRequirement,
      evidence: api.evidence,
    })),
    directives: manifest.directives.map((directive) => ({
      name: directive.name,
      placement: directive.placement,
      evidence: directive.evidence,
    })),
  };
}

function assertManifest(manifest) {
  const apiNames = manifest.apis.map((api) => api.name);
  assert.equal(apiNames.length, new Set(apiNames).size, `${manifest.version} has duplicate APIs`);
  const directiveNames = manifest.directives.map((directive) => directive.name);
  assert.equal(directiveNames.length, new Set(directiveNames).size, `${manifest.version} has duplicate directives`);

  for (const name of REQUIRED_DIRECTIVES) {
    assert.ok(directiveNames.includes(name), `${manifest.version} is missing @${name}`);
  }
  for (const directive of manifest.directives) {
    assert.ok(directive.evidence, `${directive.name} needs evidence`);
    const expected = REQUIRED_PLACEMENTS[directive.name];
    if (expected) assert.equal(directive.placement, expected, `${directive.name} placement`);
  }
  for (const api of manifest.apis) {
    assert.ok(api.evidence && api.evidence.length > 8, `${api.name} needs evidence`);
    assert.ok(api.module === "unknown" || api.module.startsWith("@"), `${api.name} module`);
    if (api.introduced && api.deprecated) {
      assert.ok(api.introduced <= api.deprecated, `${api.name} version range`);
    }
  }
}

for (const manifest of fluentManifests()) {
  assertManifest(manifest);
}

assert.deepEqual([...SUPPORTED_FLUENT_SDK_VERSIONS], ["3.0.0", "4.1.0"]);
assert.equal(CURRENT_FLUENT_SDK_VERSION, "4.1.0");

const fixturePath = join(root, "tests/fixtures/fluent-manifest-current.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const current = fluentManifests().find((manifest) => manifest.sdkVersion === CURRENT_FLUENT_SDK_VERSION);
assert.ok(current);
assert.deepEqual(summarize(current), fixture);
assert.equal(current.apis.length, DEFAULT_FLUENT_MANIFEST.apis.length);

console.log(
  `Fluent manifests: ${fluentManifests()
    .map((manifest) => `${manifest.sdkVersion ?? manifest.version} (${manifest.apis.length} APIs)`)
    .join(", ")}`,
);
