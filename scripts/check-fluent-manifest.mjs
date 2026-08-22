import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  DEFAULT_FLUENT_MANIFEST,
  fluentManifests,
  SUPPORTED_FLUENT_SDK_VERSIONS,
  CURRENT_FLUENT_SDK_VERSION,
  FLUENT_SDK_ARTIFACTS,
} = await import(pathToFileURL(join(root, "src/fluent/index.ts")).href);
const { FLUENT_DECLARATION_SNAPSHOTS } = await import(
  pathToFileURL(join(root, "src/fluent/declaration-snapshots.ts")).href
);
const { compareFluentVersions, isAllowedFluentEvidenceLocation } = await import(
  pathToFileURL(join(root, "src/fluent/evidence.ts")).href
);
const { assertFluentLifecycleMatches } = await import(
  pathToFileURL(join(root, "src/fluent/lifecycle.ts")).href
);

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
    lifecycle: Object.fromEntries(
      manifest.apis.map((api) => [
        api.name,
        { introduced: api.introduced ?? null, deprecated: api.deprecated ?? null },
      ]),
    ),
  };
}

function assertManifest(manifest) {
  const apiNames = manifest.apis.map((api) => api.name);
  assert.equal(apiNames.length, new Set(apiNames).size, `${manifest.version} has duplicate APIs`);
  const directiveNames = manifest.directives.map((directive) => directive.name);
  assert.equal(
    directiveNames.length,
    new Set(directiveNames).size,
    `${manifest.version} has duplicate directives`,
  );

  for (const name of REQUIRED_DIRECTIVES) {
    assert.ok(directiveNames.includes(name), `${manifest.version} is missing @${name}`);
  }
  for (const directive of manifest.directives) {
    assert.ok(directive.evidence, `${directive.name} needs evidence`);
    const expected = REQUIRED_PLACEMENTS[directive.name];
    if (expected) assert.equal(directive.placement, expected, `${directive.name} placement`);
  }
  for (const api of manifest.apis) {
    const canonical = DEFAULT_FLUENT_MANIFEST.apis.find((candidate) => candidate.name === api.name);
    assert.ok(api.evidence && api.evidence.length > 8, `${api.name} needs evidence`);
    assert.ok(api.module === "unknown" || api.module.startsWith("@"), `${api.name} module`);
    assert.ok(
      Array.isArray(api.evidenceRecords) && api.evidenceRecords.length > 0,
      `${api.name} needs evidence records`,
    );
    for (const record of api.evidenceRecords) {
      assert.equal(record.symbol, api.name, `${api.name} evidence symbol`);
      assert.ok(isAllowedFluentEvidenceLocation(record.url), `${api.name} evidence URL`);
      assert.match(record.version, /^\d+\.\d+\.\d+$/, `${api.name} evidence version`);
      if (record.url.startsWith("https://registry.npmjs.org/@servicenow%2fsdk-core/")) {
        assert.ok(
          record.url.includes(record.version),
          `${api.name} evidence URL must include its version`,
        );
      }
      if (record.transition === "introduced")
        assert.equal(record.version, api.introduced, `${api.name} introduction evidence`);
      if (record.transition === "deprecated")
        assert.equal(
          record.version,
          api.deprecated ?? canonical?.deprecated,
          `${api.name} deprecation evidence`,
        );
    }
    if (api.introduced) {
      assert.ok(
        api.evidenceRecords.some(
          (record) => record.transition === "introduced" && record.version === api.introduced,
        ),
        `${api.name} needs introduction evidence`,
      );
    }
    if (api.deprecated) {
      assert.ok(
        api.evidenceRecords.some(
          (record) => record.transition === "deprecated" && record.version === api.deprecated,
        ),
        `${api.name} needs deprecation evidence`,
      );
    }
    if (api.introduced && api.deprecated) {
      assert.ok(
        compareFluentVersions(api.introduced, api.deprecated) <= 0,
        `${api.name} version range`,
      );
    }
  }
  for (const directive of manifest.directives) {
    assert.ok(
      Array.isArray(directive.evidenceRecords) && directive.evidenceRecords.length > 0,
      `${directive.name} needs evidence records`,
    );
    for (const record of directive.evidenceRecords) {
      assert.equal(record.symbol, directive.name, `${directive.name} evidence symbol`);
      assert.ok(isAllowedFluentEvidenceLocation(record.url), `${directive.name} evidence URL`);
      assert.match(record.version, /^\d+\.\d+\.\d+$/, `${directive.name} evidence version`);
    }
  }
}

for (const manifest of fluentManifests()) {
  assertManifest(manifest);
}

assert.deepEqual(
  [...SUPPORTED_FLUENT_SDK_VERSIONS],
  [
    "3.0.0",
    "3.0.1",
    "3.0.2",
    "3.0.3",
    "4.0.0",
    "4.0.1",
    "4.0.2",
    "4.1.0",
    "4.1.1",
    "4.2.0",
    "4.3.0",
    "4.4.0",
    "4.4.1",
    "4.5.0",
    "4.6.0",
    "4.6.1",
    "4.7.0",
    "4.7.1",
    "4.7.2",
    "4.8.0",
    "4.8.1",
    "4.9.0",
    "4.9.1",
    "4.9.2",
    "4.10.0",
    "4.10.1",
    "4.11.0",
  ],
);
assert.equal(CURRENT_FLUENT_SDK_VERSION, "4.11.0");
assert.deepEqual(Object.keys(FLUENT_SDK_ARTIFACTS), [...SUPPORTED_FLUENT_SDK_VERSIONS]);
for (const [version, evidence] of Object.entries(FLUENT_SDK_ARTIFACTS)) {
  assert.match(evidence.sdkIntegrity, /^sha512-[A-Za-z0-9+/]+=*$/, `${version} SDK integrity`);
  assert.match(evidence.coreIntegrity, /^sha512-[A-Za-z0-9+/]+=*$/, `${version} core integrity`);
}

const fixturePath = join(root, "tests/fixtures/fluent-manifest-current.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const current = fluentManifests().find(
  (manifest) => manifest.sdkVersion === CURRENT_FLUENT_SDK_VERSION,
);
assert.ok(current);
const currentSummary = summarize(current);
if (process.argv.includes("--update-current")) {
  await writeFile(fixturePath, `${JSON.stringify(currentSummary, null, 2)}\n`);
} else {
  assert.deepEqual(currentSummary, fixture);
}

const declarationFixture = JSON.parse(
  await readFile(join(root, "tests/fixtures/fluent-sdk-declarations.json"), "utf8"),
);
assert.deepEqual(declarationFixture.reviewedVersions, [...SUPPORTED_FLUENT_SDK_VERSIONS]);
assert.equal(declarationFixture.defaultVersion, CURRENT_FLUENT_SDK_VERSION);
for (const version of SUPPORTED_FLUENT_SDK_VERSIONS) {
  const detail = declarationFixture.versions[version];
  const runtime = FLUENT_DECLARATION_SNAPSHOTS[version];
  assert.ok(detail && runtime, `${version}: declaration snapshot missing`);
  assert.equal(
    detail.sdk.integrity,
    FLUENT_SDK_ARTIFACTS[version].sdkIntegrity,
    `${version}: SDK integrity fixture`,
  );
  assert.equal(
    detail.core.integrity,
    FLUENT_SDK_ARTIFACTS[version].coreIntegrity,
    `${version}: core integrity fixture`,
  );
  assert.deepEqual(
    runtime.capabilities,
    detail.capabilities,
    `${version}: runtime capability snapshot`,
  );
  assert.deepEqual(
    runtime.discoveredCapabilities,
    detail.discoveredCapabilities,
    `${version}: discovered capability snapshot`,
  );
  assert.deepEqual(runtime.absent, detail.absent, `${version}: negative capability snapshot`);
  const manifest = fluentManifests().find((item) => item.sdkVersion === version);
  assert.ok(manifest, `${version}: runtime manifest missing`);
  assert.deepEqual(runtime.typos, DEFAULT_FLUENT_MANIFEST.typos, `${version}: typo snapshot`);
  for (const [name, lifecycle] of Object.entries(runtime.lifecycle)) {
    const api = manifest.apis.find((item) => item.name === name);
    assert.ok(api, `${version}: lifecycle API ${name} missing from manifest`);
    const expectedLifecycle = {
      ...lifecycle,
      deprecated:
        lifecycle.deprecated ??
        (api.idRequirement === "deprecated"
          ? api.evidenceRecords.find((record) => record.transition === "deprecated")?.version
          : undefined) ??
        null,
    };
    try {
      assertFluentLifecycleMatches(api, expectedLifecycle, `${version}: ${name}`);
    } catch (error) {
      assert.fail(error instanceof Error ? error.message : String(error));
    }
  }
  const names = new Set(manifest.apis.map((api) => api.name));
  for (const name of Object.keys(detail.discoveredCapabilities)) {
    if (!runtime.lifecycle[name]) continue;
    assert.ok(names.has(name), `${version}: declaration-proven required factory ${name} missing`);
  }
  for (const [name, lifecycle] of Object.entries(runtime.lifecycle)) {
    if (!lifecycle.introduced) continue;
    for (const priorVersion of SUPPORTED_FLUENT_SDK_VERSIONS) {
      if (compareFluentVersions(priorVersion, lifecycle.introduced) >= 0) continue;
      const priorManifest = fluentManifests().find((item) => item.sdkVersion === priorVersion);
      assert.ok(
        !priorManifest?.apis.some((api) => api.name === name),
        `${name} leaked before ${lifecycle.introduced}`,
      );
    }
  }
  for (const name of ["DatabaseIndex", "Module", "ScriptedRestApi", "UiFormatter"]) {
    assert.ok(detail.absent.includes(name), `${version}: phantom ${name} unexpectedly exported`);
    assert.ok(!names.has(name), `${version}: phantom ${name} present in runtime manifest`);
  }
}

const boundaryFixture = JSON.parse(
  await readFile(join(root, "tests/fixtures/fluent-sdk-boundaries.json"), "utf8"),
);
for (const [version, expected] of Object.entries(boundaryFixture.versions)) {
  const manifest = fluentManifests().find((item) => item.sdkVersion === version);
  assert.ok(manifest, `missing manifest for boundary fixture ${version}`);
  const names = new Set(manifest.apis.map((api) => api.name));
  for (const name of expected.present) {
    assert.ok(names.has(name), `${version} declaration capability ${name} missing`);
  }
  for (const name of expected.absent ?? []) {
    assert.ok(!names.has(name), `${version} declaration capability ${name} leaked`);
  }
  const policies = new Map(manifest.apis.map((api) => [api.name, api.idRequirement]));
  for (const [name, policy] of Object.entries(expected.idRequirements ?? {})) {
    assert.equal(policies.get(name), policy, `${version} ${name} id policy`);
  }
}
for (const manifest of fluentManifests()) {
  for (const api of DEFAULT_FLUENT_MANIFEST.apis) {
    if (!api.introduced || compareFluentVersions(manifest.sdkVersion, api.introduced) >= 0)
      continue;
    assert.ok(
      !manifest.apis.some((candidate) => candidate.name === api.name),
      `${api.name} leaked before ${api.introduced}`,
    );
  }
}

const v41 = fluentManifests().find((item) => item.sdkVersion === "4.1.0");
const v48 = fluentManifests().find((item) => item.sdkVersion === "4.8.0");
assert.ok(
  !v41?.apis.some((api) => api.name === "AliasTemplate"),
  "AliasTemplate leaked before 4.8.0",
);
assert.ok(
  v48?.apis.some((api) => api.name === "AliasTemplate"),
  "AliasTemplate missing at 4.8.0",
);

console.log(
  `Fluent manifests: ${fluentManifests()
    .map((manifest) => `${manifest.sdkVersion ?? manifest.version} (${manifest.apis.length} APIs)`)
    .join(", ")}`,
);
