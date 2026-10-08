import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { decodeFluentFixture, encodeFluentFixture } from "../scripts/lib/fluent-fixture.mjs";

const encoded = JSON.parse(
  readFileSync(new URL("./fixtures/fluent-sdk-declarations.json", import.meta.url), "utf8"),
);

// @lat: [[tests#Fluent manifest#Shared declaration evidence expands without loss]]
describe("shared Fluent evidence", () => {
  it("round-trips every reviewed version through the canonical representation", () =>
    assert.deepEqual(encodeFluentFixture(decodeFluentFixture(encoded)), encoded));

  it("keeps expanded versions independent when stored declarations are shared", () => {
    const expanded = decodeFluentFixture(encoded);
    const first = expanded.versions["3.0.0"]?.capabilities["Acl"];
    const second = expanded.versions["3.0.1"]?.capabilities["Acl"];
    assert.ok(first && second);
    const before = structuredClone(second);
    first.idPolicy = "unknown";
    assert.deepEqual(second, before);
    assert.equal(
      decodeFluentFixture(encoded).versions["3.0.0"]?.capabilities["Acl"]?.idPolicy,
      "required",
    );
  });

  it("rejects missing evidence references and unsupported schemas", () => {
    const broken = structuredClone(encoded);
    delete broken.declarations[
      broken.inventories[broken.versions["3.0.0"].capabilities].entries.Acl
    ];
    assert.throws(() => decodeFluentFixture(broken), /missing Fluent evidence reference/);
    const cyclic = structuredClone(encoded);
    const key = cyclic.versions["3.0.0"].capabilities;
    cyclic.inventories[key].base = key;
    assert.throws(() => decodeFluentFixture(cyclic), /cyclic Fluent inventory reference/);
    assert.throws(
      () => decodeFluentFixture({ ...encoded, schemaVersion: 99 }),
      /unsupported Fluent fixture schema/,
    );
  });

  // @lat: [[tests#Fluent manifest#Malformed shared evidence cannot erase verification]]
  it("rejects a lifecycle inventory whose entries are missing", () => {
    const broken = structuredClone(encoded);
    delete broken.inventories["3.0.0:lifecycle"].entries;
    assert.throws(() => decodeFluentFixture(broken), /invalid Fluent fixture/);
  });

  it("rejects a non-list absence record", () => {
    const broken = structuredClone(encoded);
    broken.lists["3.0.0:absent"] = 42;
    assert.throws(() => decodeFluentFixture(broken), /invalid Fluent fixture/);
  });

  it("rejects malformed inventory references and evidence records", () => {
    const malformed = [
      { declarations: { ...encoded.declarations, "3.0.0:Acl": { idPolicy: "optional" } } },
      { lifecycles: { ...encoded.lifecycles, "3.0.0:Acl": { introduced: null } } },
      { lists: { ...encoded.lists, "3.0.0:absent": [42] } },
      {
        inventories: {
          ...encoded.inventories,
          "3.0.0:lifecycle": { entries: { Acl: 42 } },
        },
      },
      {
        inventories: {
          ...encoded.inventories,
          "3.0.0:lifecycle": { entries: {}, base: 42 },
        },
      },
      {
        inventories: {
          ...encoded.inventories,
          "3.0.0:lifecycle": { entries: {}, removed: [42] },
        },
      },
      {
        versions: { ...encoded.versions, "3.0.0": { ...encoded.versions["3.0.0"], lifecycle: 42 } },
      },
    ];
    for (const fields of malformed) {
      assert.throws(() => decodeFluentFixture({ ...encoded, ...fields }), /invalid Fluent fixture/);
    }
  });
});
