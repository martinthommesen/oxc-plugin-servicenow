import assert from "node:assert/strict";

/** @param {Record<string, any>} pool */
function interner(pool) {
  const keys = new Map();
  /** @param {string} key @param {any} value */
  return (key, value) => {
    const digest = JSON.stringify(value);
    if (!keys.has(digest)) {
      keys.set(digest, key);
      pool[key] = value;
    }
    return keys.get(digest);
  };
}

/**
 * Store each declaration, lifecycle, inventory and absence list once. Stable
 * references name the first version and symbol that supplied the evidence.
 * Exact package hashes and publication identities remain per version.
 * @param {any} fixture
 * @returns {any}
 */
export function encodeFluentFixture(fixture) {
  /** @type {Record<string, any>} */
  const declarations = {};
  /** @type {Record<string, any>} */
  const lifecycles = {};
  /** @type {Record<string, any>} */
  const inventories = {};
  /** @type {Record<string, any>} */
  const lists = {};
  const declaration = interner(declarations);
  const lifecycle = interner(lifecycles);
  const inventoryKeys = new Map();
  const previous = new Map();
  /** @param {string} field @param {string} key @param {Record<string, string>} refs */
  const inventory = (field, key, refs) => {
    const digest = JSON.stringify(refs);
    if (inventoryKeys.has(digest)) return inventoryKeys.get(digest);
    const prior = previous.get(field);
    const changes = prior
      ? Object.fromEntries(
          Object.entries(refs).filter(([name, value]) => prior.refs[name] !== value),
        )
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
  const list = interner(lists);
  const versions = Object.fromEntries(
    Object.entries(fixture.versions).map(([version, value]) => {
      const item = { .../** @type {any} */ (value) };
      for (const field of ["capabilities", "discoveredCapabilities", "lifecycle"]) {
        const intern = field === "lifecycle" ? lifecycle : declaration;
        const refs = Object.fromEntries(
          Object.entries(item[field])
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, evidence]) => [name, intern(`${version}:${name}`, evidence)]),
        );
        item[field] = inventory(field, `${version}:${field}`, refs);
      }
      for (const field of ["absent", "unresolvedBareExports", "unreviewedRequiredFactories"]) {
        item[field] = list(`${version}:${field}`, item[field]);
      }
      return [version, item];
    }),
  );
  return { ...fixture, schemaVersion: 2, declarations, lifecycles, inventories, lists, versions };
}

/**
 * Expand evidence for manifest and drift queries. Copies keep versions
 * independent even when their stored declarations or inventories are shared.
 * @param {any} fixture
 * @returns {any}
 */
export function decodeFluentFixture(fixture) {
  assert.equal(fixture.schemaVersion, 2, "unsupported Fluent fixture schema");
  const { declarations, lifecycles, inventories, lists, ...metadata } = fixture;
  /** @param {Record<string, any>} pool @param {string} key */
  const resolve = (pool, key) => {
    assert.ok(Object.hasOwn(pool, key), `missing Fluent evidence reference: ${key}`);
    return structuredClone(pool[key]);
  };
  const expanded = new Map();
  const resolving = new Set();
  /** @param {string} key @returns {Record<string, string>} */
  const inventoryRefs = (key) => {
    if (expanded.has(key)) return expanded.get(key);
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
  const versions = Object.fromEntries(
    Object.entries(fixture.versions).map(([version, value]) => {
      const item = { .../** @type {any} */ (value) };
      for (const field of ["capabilities", "discoveredCapabilities", "lifecycle"]) {
        const pool = field === "lifecycle" ? lifecycles : declarations;
        item[field] = Object.fromEntries(
          Object.entries(inventoryRefs(item[field])).map(([name, key]) => [
            name,
            resolve(pool, /** @type {string} */ (key)),
          ]),
        );
      }
      for (const field of ["absent", "unresolvedBareExports", "unreviewedRequiredFactories"])
        item[field] = resolve(lists, item[field]);
      return [version, item];
    }),
  );
  return { ...metadata, schemaVersion: 1, versions };
}
