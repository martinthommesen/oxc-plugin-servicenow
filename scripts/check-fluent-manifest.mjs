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
      introduced: api.introduced ?? null,
      deprecated: api.deprecated ?? null,
      evidence: api.evidence,
    })),
    directives: manifest.directives.map((directive) => ({
      name: directive.name,
      placement: directive.placement,
      evidence: directive.evidence,
    })),
    typos: manifest.typos,
  };
}

function compareVersions(left, right) {
  const parse = (version) => version.split(".").map(Number);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
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
    const canonicalApi = DEFAULT_FLUENT_MANIFEST.apis.find((candidate) => candidate.name === api.name);
    assert.ok(api.evidence && api.evidence.length > 8, `${api.name} needs evidence`);
    assert.ok(api.module === "unknown" || api.module.startsWith("@"), `${api.name} module`);
    assert.ok(Array.isArray(api.evidenceRecords) && api.evidenceRecords.length > 0, `${api.name} needs evidence records`);
    for (const record of api.evidenceRecords) {
      assert.equal(record.symbol, api.name, `${api.name} evidence symbol`);
      assert.match(record.url, /^(?:https?:\/\/|tests\/|src\/|docs\/)/, `${api.name} evidence URL`);
      assert.match(record.version, /^\d+\.\d+\.\d+$/, `${api.name} evidence version`);
      if (record.url.startsWith("https://registry.npmjs.org/@servicenow%2fsdk-core/")) {
        assert.ok(record.url.includes(record.version), `${api.name} evidence URL must include its version`);
      }
      if (record.transition === "introduced") assert.equal(record.version, api.introduced, `${api.name} introduction evidence`);
      if (record.transition === "deprecated") {
        assert.equal(record.version, canonicalApi?.deprecated, `${api.name} deprecation evidence`);
      }
    }
    if (api.introduced && api.deprecated) {
      assert.ok(compareVersions(api.introduced, api.deprecated) <= 0, `${api.name} version range`);
    }
  }
  for (const directive of manifest.directives) {
    assert.ok(Array.isArray(directive.evidenceRecords) && directive.evidenceRecords.length > 0, `${directive.name} needs evidence records`);
    for (const record of directive.evidenceRecords) {
      assert.equal(record.symbol, directive.name, `${directive.name} evidence symbol`);
      assert.match(record.url, /^(?:https?:\/\/|tests\/|src\/|docs\/)/, `${directive.name} evidence URL`);
      assert.match(record.version, /^\d+\.\d+\.\d+$/, `${directive.name} evidence version`);
    }
  }
}

for (const manifest of fluentManifests()) {
  assertManifest(manifest);
}

assert.deepEqual([...SUPPORTED_FLUENT_SDK_VERSIONS], ["3.0.0", "4.1.0", "4.8.0", "4.10.0", "4.11.0"]);
assert.equal(CURRENT_FLUENT_SDK_VERSION, "4.11.0");

const fixturePath = join(root, "tests/fixtures/fluent-manifest-current.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const current = fluentManifests().find((manifest) => manifest.sdkVersion === CURRENT_FLUENT_SDK_VERSION);
assert.ok(current);
assert.deepEqual(summarize(current), fixture);
assert.equal(current.apis.length, DEFAULT_FLUENT_MANIFEST.apis.length);

const boundaryFixture = JSON.parse(await readFile(join(root, "tests/fixtures/fluent-sdk-boundaries.json"), "utf8"));
for (const [version, expected] of Object.entries(boundaryFixture.versions)) {
  const manifest = fluentManifests().find((item) => item.sdkVersion === version);
  assert.ok(manifest, `missing manifest for declaration fixture ${version}`);
  const names = new Set(manifest.apis.map((api) => api.name));
  for (const name of expected.present) assert.ok(names.has(name), `${version} declaration capability ${name} missing`);
  for (const name of expected.absent ?? []) assert.ok(!names.has(name), `${version} declaration capability ${name} leaked`);
  const policies = new Map(manifest.apis.map((api) => [api.name, api.idRequirement]));
  for (const [name, policy] of Object.entries(expected.idRequirements ?? {})) {
    assert.equal(policies.get(name), policy, `${version} ${name} id policy`);
  }
}
for (const manifest of fluentManifests()) {
  for (const api of DEFAULT_FLUENT_MANIFEST.apis) {
    if (!api.introduced || compareVersions(manifest.sdkVersion, api.introduced) >= 0) continue;
    assert.ok(
      !manifest.apis.some((candidate) => candidate.name === api.name),
      `${api.name} leaked before ${api.introduced}`,
    );
  }
}

console.log(
  `Fluent manifests: ${fluentManifests()
    .map((manifest) => `${manifest.sdkVersion ?? manifest.version} (${manifest.apis.length} APIs)`)
    .join(", ")}`,
);
