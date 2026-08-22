import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GLIDE_API_RELEASE,
  GLIDE_CURSOR_ADVANCERS,
  GLIDE_FILTER_METHODS,
  GLIDE_QUERY_EXECUTORS,
  GLIDE_RECORD_METHODS,
  GLIDE_SCOPED_RECORD_EVIDENCE,
  GLIDE_SYSTEM_BYPASS_METHODS,
  resolveGlideCapabilities,
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

  it("does not invent an undocumented global executor", () => {
    assert.equal(
      GLIDE_RECORD_METHODS.some((entry) => entry.name === "getAsync"),
      false,
    );
    assert.equal(GLIDE_QUERY_EXECUTORS.has("getAsync"), false);
    assert.equal(GLIDE_QUERY_EXECUTORS.has("query"), true);
    assert.equal(GLIDE_QUERY_EXECUTORS.has("get"), true);
    assert.equal(GLIDE_CURSOR_ADVANCERS.has("next"), true);
    assert.equal(GLIDE_CURSOR_ADVANCERS.has("_next"), true);
  });

  it("selects capabilities by exact scope and release", () => {
    const scoped = resolveGlideCapabilities({ scope: "scoped", release: "zurich" });
    const global = resolveGlideCapabilities({ scope: "global", release: "zurich" });
    const unknown = resolveGlideCapabilities({ scope: "unknown", release: "zurich" });
    assert.equal(scoped.executors.has("query"), true);
    assert.equal(scoped.executors.has("getAsync"), false);
    assert.equal(global.executors.has("getAsync"), false);
    assert.equal(unknown.executors.has("getAsync"), false);
    assert.equal(scoped.cursorAdvancers.has("_next"), true);
    assert.equal(global.cursorAdvancers.has("_next"), true);
    assert.equal(resolveGlideCapabilities({ scope: "scoped", release: "zurich" }), scoped);
    assert.equal("add" in scoped.executors, false);
  });

  it("lists only documented ACL-bypass methods", () => {
    assert.deepEqual([...GLIDE_SYSTEM_BYPASS_METHODS].sort(), [
      "addSystemEncodedQuery",
      "addSystemOrderBy",
      "addSystemOrderByDesc",
      "addSystemQuery",
    ]);
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
