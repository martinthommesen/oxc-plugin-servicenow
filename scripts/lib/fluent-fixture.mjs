import assert from "node:assert/strict";

/** @typedef {Record<string, unknown>} FixtureRecord */
/** @typedef {string} EvidenceReference */
/** @typedef {Record<string, EvidenceReference>} InventoryReferences */
/** @typedef {"capabilities" | "discoveredCapabilities" | "lifecycle"} InventoryField */
/**
 * @typedef {Omit<import("../audit-fluent-sdk.mjs").AuditDeclarationEvidence, "idPolicy"> & {
 *   idPolicy: import("../../src/fluent/snapshot-types.js").DeclarationIdPolicy
 * } & FixtureRecord} DeclarationEvidence
 */
/** @typedef {import("../../src/fluent/lifecycle.js").FluentLifecycleSnapshot & FixtureRecord} LifecycleEvidence */
/** @typedef {{entries: InventoryReferences, base?: EvidenceReference, removed?: string[]} & FixtureRecord} EvidenceInventory */
/**
 * @typedef {{name: string, version: string, publishedAt: string, tarball: string, integrity: string} & FixtureRecord} ArtifactEvidence
 * @typedef {ArtifactEvidence & {coreDependency: string, coreEntry: string}} SdkArtifactEvidence
 * @typedef {{version: string, sdk: SdkArtifactEvidence, core: ArtifactEvidence, exportInventorySha256: string} & FixtureRecord} VersionMetadata
 * @typedef {{defaultVersion: string, reviewedVersions: string[]} & FixtureRecord} FixtureMetadata
 * @typedef {VersionMetadata & {
 *   capabilities: Record<string, DeclarationEvidence>, discoveredCapabilities: Record<string, DeclarationEvidence>,
 *   lifecycle: Record<string, LifecycleEvidence>, absent: string[], unresolvedBareExports: string[], unreviewedRequiredFactories: string[]
 * }} ExpandedVersion
 * @typedef {VersionMetadata & {
 *   capabilities: EvidenceReference, discoveredCapabilities: EvidenceReference, lifecycle: EvidenceReference,
 *   absent: EvidenceReference, unresolvedBareExports: EvidenceReference, unreviewedRequiredFactories: EvidenceReference
 * }} EncodedVersion
 * @typedef {FixtureMetadata & {schemaVersion: 1, versions: Record<string, ExpandedVersion>}} ExpandedFixture
 * @typedef {FixtureMetadata & {
 *   schemaVersion: 2, versions: Record<string, EncodedVersion>, declarations: Record<string, DeclarationEvidence>,
 *   lifecycles: Record<string, LifecycleEvidence>, inventories: Record<string, EvidenceInventory>, lists: Record<string, string[]>
 * }} EncodedFixture
 */

/** @param {unknown} value @returns {value is FixtureRecord} */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} value @param {string} label @returns {FixtureRecord} */
function record(value, label) {
  assert.ok(isRecord(value), `invalid Fluent fixture ${label}: expected an object`);
  return value;
}

/** @param {unknown} value @param {string} label @returns {string} */
function text(value, label) {
  assert.ok(typeof value === "string", `invalid Fluent fixture ${label}: expected a string`);
  return value;
}

/** @param {unknown} value @param {string} label @returns {EvidenceReference} */
function reference(value, label) {
  const key = text(value, label);
  assert.ok(key.length > 0, `invalid Fluent fixture ${label}: expected a nonempty reference`);
  return key;
}

/** @param {unknown} value @param {string} label @returns {string[]} */
function stringList(value, label) {
  assert.ok(Array.isArray(value), `invalid Fluent fixture ${label}: expected a string list`);
  return Array.from(value, (item, index) => text(item, `${label}[${index}]`));
}

/**
 * @template T
 * @param {unknown} value
 * @param {string} label
 * @param {(item: unknown, label: string) => T} parse
 * @returns {Record<string, T>}
 */
function evidenceRecord(value, label, parse) {
  return Object.fromEntries(
    Object.entries(record(value, label)).map(([key, item]) => [
      key,
      parse(item, `${label}.${key}`),
    ]),
  );
}

/** @param {unknown} value @param {string} label @returns {DeclarationEvidence} */
function declarationEvidence(value, label) {
  const item = record(value, label);
  const idPolicy = item["idPolicy"];
  assert.ok(
    idPolicy === "required" || idPolicy === "deprecated" || idPolicy === "unknown",
    `invalid Fluent fixture ${label}.idPolicy`,
  );
  return {
    ...item,
    module: text(item["module"], `${label}.module`),
    exportName: text(item["exportName"], `${label}.exportName`),
    declarationPath: text(item["declarationPath"], `${label}.declarationPath`),
    declarationSha256: text(item["declarationSha256"], `${label}.declarationSha256`),
    sourceSha256: text(item["sourceSha256"], `${label}.sourceSha256`),
    kind: text(item["kind"], `${label}.kind`),
    idPolicy,
  };
}

/** @param {unknown} value @param {string} label @returns {LifecycleEvidence} */
function lifecycleEvidence(value, label) {
  const item = record(value, label);
  return {
    ...item,
    introduced:
      item["introduced"] === null ? null : text(item["introduced"], `${label}.introduced`),
    deprecated:
      item["deprecated"] === null ? null : text(item["deprecated"], `${label}.deprecated`),
  };
}

/** @param {unknown} value @param {string} label @returns {EvidenceInventory} */
function evidenceInventory(value, label) {
  const item = record(value, label);
  return {
    ...item,
    entries: evidenceRecord(item["entries"], `${label}.entries`, reference),
    ...(Object.hasOwn(item, "base") ? { base: reference(item["base"], `${label}.base`) } : {}),
    ...(Object.hasOwn(item, "removed")
      ? { removed: stringList(item["removed"], `${label}.removed`) }
      : {}),
  };
}

/** @param {unknown} value @param {string} label @returns {ArtifactEvidence} */
function artifactEvidence(value, label) {
  const item = record(value, label);
  return {
    ...item,
    name: text(item["name"], `${label}.name`),
    version: text(item["version"], `${label}.version`),
    publishedAt: text(item["publishedAt"], `${label}.publishedAt`),
    tarball: text(item["tarball"], `${label}.tarball`),
    integrity: text(item["integrity"], `${label}.integrity`),
  };
}

/** @param {FixtureRecord} item @param {string} label @returns {VersionMetadata} */
function versionMetadata(item, label) {
  const sdk = artifactEvidence(item["sdk"], `${label}.sdk`);
  return {
    ...item,
    version: text(item["version"], `${label}.version`),
    sdk: {
      ...sdk,
      coreDependency: text(sdk["coreDependency"], `${label}.sdk.coreDependency`),
      coreEntry: text(sdk["coreEntry"], `${label}.sdk.coreEntry`),
    },
    core: artifactEvidence(item["core"], `${label}.core`),
    exportInventorySha256: text(item["exportInventorySha256"], `${label}.exportInventorySha256`),
  };
}

/** @param {FixtureRecord} item @returns {FixtureMetadata} */
function fixtureMetadata(item) {
  return {
    ...item,
    defaultVersion: text(item["defaultVersion"], "defaultVersion"),
    reviewedVersions: stringList(item["reviewedVersions"], "reviewedVersions"),
  };
}

/** @param {unknown} value @param {string} label @returns {ExpandedVersion} */
function expandedVersion(value, label) {
  const item = record(value, label);
  return {
    ...versionMetadata(item, label),
    capabilities: evidenceRecord(
      item["capabilities"],
      `${label}.capabilities`,
      declarationEvidence,
    ),
    discoveredCapabilities: evidenceRecord(
      item["discoveredCapabilities"],
      `${label}.discoveredCapabilities`,
      declarationEvidence,
    ),
    lifecycle: evidenceRecord(item["lifecycle"], `${label}.lifecycle`, lifecycleEvidence),
    absent: stringList(item["absent"], `${label}.absent`),
    unresolvedBareExports: stringList(
      item["unresolvedBareExports"],
      `${label}.unresolvedBareExports`,
    ),
    unreviewedRequiredFactories: stringList(
      item["unreviewedRequiredFactories"],
      `${label}.unreviewedRequiredFactories`,
    ),
  };
}

/** @param {unknown} value @param {string} label @returns {EncodedVersion} */
function encodedVersion(value, label) {
  const item = record(value, label);
  return {
    ...versionMetadata(item, label),
    capabilities: reference(item["capabilities"], `${label}.capabilities`),
    discoveredCapabilities: reference(
      item["discoveredCapabilities"],
      `${label}.discoveredCapabilities`,
    ),
    lifecycle: reference(item["lifecycle"], `${label}.lifecycle`),
    absent: reference(item["absent"], `${label}.absent`),
    unresolvedBareExports: reference(
      item["unresolvedBareExports"],
      `${label}.unresolvedBareExports`,
    ),
    unreviewedRequiredFactories: reference(
      item["unreviewedRequiredFactories"],
      `${label}.unreviewedRequiredFactories`,
    ),
  };
}

/** @template T @param {Record<string, T>} pool */
function interner(pool) {
  /** @type {Map<string, EvidenceReference>} */
  const keys = new Map();
  /** @param {EvidenceReference} key @param {T} value @returns {EvidenceReference} */
  return (key, value) => {
    const digest = JSON.stringify(value);
    const existing = keys.get(digest);
    if (existing !== undefined) return existing;
    keys.set(digest, key);
    pool[key] = value;
    return key;
  };
}

/**
 * Store each declaration, lifecycle, inventory and absence list once. Stable
 * references name the first version and symbol that supplied the evidence.
 * Exact package hashes and publication identities remain per version.
 * @param {unknown} value
 * @returns {EncodedFixture}
 */
export function encodeFluentFixture(value) {
  const fixture = record(value, "root");
  assert.equal(fixture["schemaVersion"], 1, "unsupported Fluent fixture schema");
  /** @type {Record<string, DeclarationEvidence>} */
  const declarations = {};
  /** @type {Record<string, LifecycleEvidence>} */
  const lifecycles = {};
  /** @type {Record<string, EvidenceInventory>} */
  const inventories = {};
  /** @type {Record<string, string[]>} */
  const lists = {};
  const declaration = interner(declarations);
  const lifecycle = interner(lifecycles);
  /** @type {Map<string, EvidenceReference>} */
  const inventoryKeys = new Map();
  /** @type {Map<InventoryField, {key: EvidenceReference, refs: InventoryReferences}>} */
  const previous = new Map();
  /** @param {InventoryField} field @param {EvidenceReference} key @param {InventoryReferences} refs */
  const inventory = (field, key, refs) => {
    const digest = JSON.stringify(refs);
    const existing = inventoryKeys.get(digest);
    if (existing !== undefined) return existing;
    const prior = previous.get(field);
    const changes = prior
      ? Object.fromEntries(Object.entries(refs).filter(([name, ref]) => prior.refs[name] !== ref))
      : refs;
    const removed = prior ? Object.keys(prior.refs).filter((name) => !(name in refs)) : [];
    inventories[key] = {
      ...(prior ? { base: prior.key } : {}),
      entries: changes,
      ...(removed.length ? { removed } : {}),
    };
    inventoryKeys.set(digest, key);
    previous.set(field, { key, refs });
    return key;
  };
  /**
   * @template T
   * @param {InventoryField} field
   * @param {string} version
   * @param {Record<string, T>} evidence
   * @param {(key: EvidenceReference, item: T) => EvidenceReference} intern
   */
  const storeInventory = (field, version, evidence, intern) =>
    inventory(
      field,
      `${version}:${field}`,
      Object.fromEntries(
        Object.entries(evidence)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, item]) => [name, intern(`${version}:${name}`, item)]),
      ),
    );
  const list = interner(lists);
  const versions = Object.fromEntries(
    Object.entries(evidenceRecord(fixture["versions"], "versions", expandedVersion)).map(
      ([version, item]) => [
        version,
        {
          ...item,
          capabilities: storeInventory("capabilities", version, item.capabilities, declaration),
          discoveredCapabilities: storeInventory(
            "discoveredCapabilities",
            version,
            item.discoveredCapabilities,
            declaration,
          ),
          lifecycle: storeInventory("lifecycle", version, item.lifecycle, lifecycle),
          absent: list(`${version}:absent`, item.absent),
          unresolvedBareExports: list(
            `${version}:unresolvedBareExports`,
            item.unresolvedBareExports,
          ),
          unreviewedRequiredFactories: list(
            `${version}:unreviewedRequiredFactories`,
            item.unreviewedRequiredFactories,
          ),
        },
      ],
    ),
  );
  return {
    ...fixtureMetadata(fixture),
    schemaVersion: 2,
    declarations,
    lifecycles,
    inventories,
    lists,
    versions,
  };
}

/**
 * Expand validated evidence for manifest and drift queries. Copies keep versions
 * independent even when their stored declarations or inventories are shared.
 * @param {unknown} value
 * @returns {ExpandedFixture}
 */
export function decodeFluentFixture(value) {
  const fixture = record(value, "root");
  assert.equal(fixture["schemaVersion"], 2, "unsupported Fluent fixture schema");
  const declarations = evidenceRecord(fixture["declarations"], "declarations", declarationEvidence);
  const lifecycles = evidenceRecord(fixture["lifecycles"], "lifecycles", lifecycleEvidence);
  const inventories = evidenceRecord(fixture["inventories"], "inventories", evidenceInventory);
  const lists = evidenceRecord(fixture["lists"], "lists", stringList);
  const {
    declarations: _declarations,
    lifecycles: _lifecycles,
    inventories: _inventories,
    lists: _lists,
    ...metadata
  } = fixtureMetadata(fixture);
  /** @template T @param {Record<string, T>} pool @param {EvidenceReference} key @returns {T} */
  const resolve = (pool, key) => {
    const item = Object.hasOwn(pool, key) ? pool[key] : undefined;
    assert.ok(item !== undefined, `missing Fluent evidence reference: ${key}`);
    return structuredClone(item);
  };
  /** @type {Map<EvidenceReference, InventoryReferences>} */
  const expanded = new Map();
  /** @type {Set<EvidenceReference>} */
  const resolving = new Set();
  /** @param {EvidenceReference} key @returns {InventoryReferences} */
  const inventoryRefs = (key) => {
    const cached = expanded.get(key);
    if (cached !== undefined) return cached;
    assert.ok(!resolving.has(key), `cyclic Fluent inventory reference: ${key}`);
    resolving.add(key);
    const item = resolve(inventories, key);
    const refs = { ...(item.base ? inventoryRefs(item.base) : {}), ...item.entries };
    for (const name of item.removed ?? []) delete refs[name];
    const sorted = Object.fromEntries(
      Object.entries(refs).sort(([left], [right]) => left.localeCompare(right)),
    );
    expanded.set(key, sorted);
    resolving.delete(key);
    return sorted;
  };
  /** @template T @param {EvidenceReference} key @param {Record<string, T>} pool @returns {Record<string, T>} */
  const expandInventory = (key, pool) =>
    Object.fromEntries(
      Object.entries(inventoryRefs(key)).map(([name, ref]) => [name, resolve(pool, ref)]),
    );
  const versions = Object.fromEntries(
    Object.entries(evidenceRecord(fixture["versions"], "versions", encodedVersion)).map(
      ([version, item]) => [
        version,
        {
          ...item,
          capabilities: expandInventory(item.capabilities, declarations),
          discoveredCapabilities: expandInventory(item.discoveredCapabilities, declarations),
          lifecycle: expandInventory(item.lifecycle, lifecycles),
          absent: resolve(lists, item.absent),
          unresolvedBareExports: resolve(lists, item.unresolvedBareExports),
          unreviewedRequiredFactories: resolve(lists, item.unreviewedRequiredFactories),
        },
      ],
    ),
  );
  return { ...metadata, schemaVersion: 1, versions };
}
