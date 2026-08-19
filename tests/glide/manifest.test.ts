import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GLIDE_API_RELEASE,
  GLIDE_FILTER_METHODS,
  GLIDE_RECORD_METHODS,
  GLIDE_SCOPED_RECORD_EVIDENCE,
  GLIDE_SYSTEM_BYPASS_METHODS,
} from "../../src/glide/index.js";

describe("GlideRecord method manifest", () => {
  it("is pinned to the Zurich scoped reference", () => {
    assert.equal(GLIDE_API_RELEASE, "zurich");
    assert.match(GLIDE_SCOPED_RECORD_EVIDENCE, /c_GlideRecordScopedAPI/);
    assert.ok(GLIDE_RECORD_METHODS.every((entry) => entry.evidence === GLIDE_SCOPED_RECORD_EVIDENCE));
  });

  it("lists only documented ACL-bypass methods", () => {
    assert.deepEqual(
      [...GLIDE_SYSTEM_BYPASS_METHODS].sort(),
      ["addSystemEncodedQuery", "addSystemOrderBy", "addSystemOrderByDesc", "addSystemQuery"],
    );
    assert.equal(GLIDE_SYSTEM_BYPASS_METHODS.has("addSystemFoo"), false);
    assert.equal(GLIDE_SYSTEM_BYPASS_METHODS.has("addQuery"), false);
  });

  it("treats user and system query builders as filters", () => {
    assert.equal(GLIDE_FILTER_METHODS.has("addUserQuery"), true);
    assert.equal(GLIDE_FILTER_METHODS.has("addUserEncodedQuery"), true);
    assert.equal(GLIDE_FILTER_METHODS.has("addSystemQuery"), true);
    assert.equal(GLIDE_FILTER_METHODS.has("query"), false);
    assert.equal(GLIDE_FILTER_METHODS.has("orderBy"), false);
    assert.equal(GLIDE_FILTER_METHODS.has("setLimit"), false);
    assert.equal(GLIDE_FILTER_METHODS.has("chooseWindow"), false);
    assert.equal(GLIDE_FILTER_METHODS.has("addInactiveQuery"), false);
  });
});
