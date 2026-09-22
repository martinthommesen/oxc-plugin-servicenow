import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIENT_SURFACES,
  SERVER_ONLY_SURFACES,
  SERVER_SURFACES,
  SURFACE_VALUES,
} from "../src/surfaces.js";

// @lat: [[tests#Context evidence#Surface vocabulary has one authored home]]
describe("surface vocabulary", () => {
  it("partitions client and server-only surfaces while preserving UI Action overlap", () => {
    const all = new Set(SURFACE_VALUES);
    const client: ReadonlySet<string> = new Set(CLIENT_SURFACES);
    const serverOnly: ReadonlySet<string> = new Set(SERVER_ONLY_SURFACES);
    assert.deepEqual(
      [...serverOnly].filter((surface) => client.has(surface)),
      [],
    );
    assert.deepEqual(new Set([...serverOnly, ...client]), all);
    assert.equal(SERVER_SURFACES.includes("ui-action"), true);
    assert.equal(CLIENT_SURFACES.includes("ui-action"), true);
  });
});
