import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GLIDE_API_RELEASE,
  GLIDE_FILTER_METHODS,
  GLIDE_GLOBAL_RECORD_EVIDENCE,
  GLIDE_QUERY_EXECUTORS,
  GLIDE_RECORD_METHODS,
  GLIDE_SCOPED_RECORD_EVIDENCE,
  GLIDE_SYSTEM_BYPASS_METHODS,
} from "../../src/glide/index.js";

describe("GlideRecord method manifest", () => {
  it("is pinned to the Zurich scoped reference", () => {
    assert.equal(GLIDE_API_RELEASE, "zurich");
    assert.match(GLIDE_SCOPED_RECORD_EVIDENCE, /c_GlideRecordScopedAPI/);
    const scoped = GLIDE_RECORD_METHODS.filter((entry) => entry.apiScope === "scoped");
    assert.ok(scoped.length > 0);
    assert.ok(scoped.every((entry) => entry.evidence === GLIDE_SCOPED_RECORD_EVIDENCE));
  });

  it("has unique method names and one role table", () => {
    const names = GLIDE_RECORD_METHODS.map((entry) => entry.name);
    assert.equal(names.length, new Set(names).size);
  });

  it("lists getAsync as a global executor with its own evidence", () => {
    const getAsync = GLIDE_RECORD_METHODS.find((entry) => entry.name === "getAsync");
    assert.ok(getAsync);
    assert.deepEqual([...getAsync.roles], ["executor"]);
    assert.equal(getAsync.apiScope, "global");
    assert.equal(getAsync.evidence, GLIDE_GLOBAL_RECORD_EVIDENCE);
    assert.equal(GLIDE_QUERY_EXECUTORS.has("getAsync"), true);
    assert.equal(GLIDE_QUERY_EXECUTORS.has("query"), true);
    assert.equal(GLIDE_QUERY_EXECUTORS.has("get"), true);
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
