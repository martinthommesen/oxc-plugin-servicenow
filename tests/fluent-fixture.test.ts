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
    const before = structuredClone(expanded.versions["3.0.1"].capabilities.Acl);
    expanded.versions["3.0.0"].capabilities.Acl.idPolicy = "unknown";
    assert.deepEqual(expanded.versions["3.0.1"].capabilities.Acl, before);
    assert.equal(
      decodeFluentFixture(encoded).versions["3.0.0"].capabilities.Acl.idPolicy,
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
});
