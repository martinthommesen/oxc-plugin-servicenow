import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GLIDE_API_RELEASES,
  GLIDE_CURSOR_ADVANCERS,
  GLIDE_DOCUMENTED_METHODS,
  GLIDE_FILTER_METHODS,
  GLIDE_QUERY_EXECUTORS,
  GLIDE_RECORD_METHODS,
  GLIDE_RECORD_EVIDENCE,
  GLIDE_SYSTEM_BYPASS_METHODS,
  resolveGlideCapabilities,
} from "../../src/glide/index.js";

describe("GlideRecord method manifest", () => {
  it("pins scoped and global evidence for every supported release", () => {
    assert.deepEqual(GLIDE_API_RELEASES, ["zurich", "australia"]);
    assert.match(GLIDE_RECORD_EVIDENCE.zurich.scoped, /\/r\/zurich\//);
    assert.match(GLIDE_RECORD_EVIDENCE.zurich.scoped, /c_GlideRecordScopedAPI/);
    assert.match(GLIDE_RECORD_EVIDENCE.zurich.global, /\/r\/zurich\//);
    assert.match(GLIDE_RECORD_EVIDENCE.zurich.global, /c_GlideRecordAPI/);
    assert.match(GLIDE_RECORD_EVIDENCE.australia.scoped, /\/r\/api-reference\//);
    assert.match(GLIDE_RECORD_EVIDENCE.australia.scoped, /c_GlideRecordScopedAPI/);
    assert.match(GLIDE_RECORD_EVIDENCE.australia.global, /\/r\/api-reference\//);
    assert.match(GLIDE_RECORD_EVIDENCE.australia.global, /c_GlideRecordAPI/);
    assert.equal(GLIDE_RECORD_EVIDENCE.australia.officialReleaseLabel, "Australia");
    assert.equal(GLIDE_RECORD_EVIDENCE.australia.officialUpdatedAt, "2026-03-12");
    assert.equal(GLIDE_RECORD_EVIDENCE.australia.reviewedAt, "2026-08-22");
    const scoped = GLIDE_RECORD_METHODS.filter((entry) => entry.apiScope === "scoped");
    assert.ok(scoped.length > 0);
    assert.ok(
      scoped.every((entry) =>
        GLIDE_API_RELEASES.every(
          (release) => entry.evidence[release] === GLIDE_RECORD_EVIDENCE[release].scoped,
        ),
      ),
    );
  });

  it("has unique method names and one role table", () => {
    const names = GLIDE_RECORD_METHODS.map((entry) => entry.name);
    assert.equal(names.length, new Set(names).size);
  });

  it("lists documented query executors without inventing getAsync", () => {
    assert.equal(
      GLIDE_RECORD_METHODS.some((entry) => entry.name === "getAsync"),
      false,
    );
    assert.equal(GLIDE_QUERY_EXECUTORS.has("getAsync"), false);
    assert.equal(GLIDE_QUERY_EXECUTORS.has("query"), true);
    assert.equal(GLIDE_QUERY_EXECUTORS.has("_query"), true);
    assert.equal(GLIDE_QUERY_EXECUTORS.has("queryNoDomain"), true);
    assert.equal(GLIDE_QUERY_EXECUTORS.has("get"), true);
    assert.equal(GLIDE_CURSOR_ADVANCERS.has("next"), true);
    assert.equal(GLIDE_CURSOR_ADVANCERS.has("_next"), true);
  });

  it("selects capabilities by exact scope and release", () => {
    const scoped = resolveGlideCapabilities({ scope: "scoped", release: "zurich" });
    const global = resolveGlideCapabilities({ scope: "global", release: "zurich" });
    const unknown = resolveGlideCapabilities({ scope: "unknown", release: "zurich" });
    assert.equal(scoped.executors.has("query"), true);
    assert.equal(scoped.executors.has("_query"), true);
    assert.equal(scoped.executors.has("queryNoDomain"), false);
    assert.equal(scoped.executors.has("getAsync"), false);
    assert.equal(global.executors.has("_query"), true);
    assert.equal(global.executors.has("queryNoDomain"), true);
    assert.equal(global.executors.has("getAsync"), false);
    assert.equal(unknown.executors.has("_query"), true);
    assert.equal(unknown.executors.has("queryNoDomain"), false);
    assert.equal(unknown.possibleExecutors.has("queryNoDomain"), true);
    assert.equal(unknown.executors.has("getAsync"), false);
    assert.equal(unknown.knownMethods.has("queryNoDomain"), true);
    assert.equal(scoped.cursorAdvancers.has("_next"), true);
    assert.equal(global.cursorAdvancers.has("_next"), true);
    assert.equal(resolveGlideCapabilities({ scope: "scoped", release: "zurich" }), scoped);
    assert.equal("add" in scoped.executors, false);
  });

  it("keeps Australia capabilities exact and omission release-conservative", () => {
    const australiaGlobal = resolveGlideCapabilities({ scope: "global", release: "australia" });
    const australiaScoped = resolveGlideCapabilities({ scope: "scoped", release: "australia" });
    const omitted = resolveGlideCapabilities({ scope: "unknown" });
    assert.equal(australiaGlobal.release, "australia");
    assert.deepEqual(australiaGlobal.releases, ["australia"]);
    assert.equal(australiaGlobal.executors.has("queryNoDomain"), true);
    assert.equal(australiaScoped.executors.has("queryNoDomain"), false);
    assert.equal(omitted.release, undefined);
    assert.deepEqual(omitted.releases, ["zurich", "australia"]);
    assert.equal(omitted.executors.has("queryNoDomain"), false);
    assert.equal(omitted.possibleExecutors.has("queryNoDomain"), true);
  });

  it("pins the complete Australia method-name firewall without inventing semantic roles", () => {
    const scoped = new Set(GLIDE_DOCUMENTED_METHODS.australia.scoped);
    const global = new Set(GLIDE_DOCUMENTED_METHODS.australia.global);
    const union = new Set([...scoped, ...global]);
    assert.equal(scoped.size, GLIDE_DOCUMENTED_METHODS.australia.scoped.length);
    assert.equal(global.size, GLIDE_DOCUMENTED_METHODS.australia.global.length);
    assert.equal(scoped.size, 68);
    assert.equal(global.size, 96);
    assert.equal(union.size, 102);
    assert.deepEqual([...scoped].filter((name) => !global.has(name)).sort(), [
      "getElements",
      "getLastErrorMessage",
      "isActionAborted",
      "isEncodedQueryValid",
      "isValidEncodedQuery",
      "isView",
    ]);
    assert.deepEqual([...global].filter((name) => !scoped.has(name)).sort(), [
      "addDomainQuery",
      "addExtraField",
      "addInactiveQuery",
      "addValue",
      "applyEncodedQuery",
      "applyTemplate",
      "autoSysFields",
      "changes",
      "find",
      "getDynamicAttribute",
      "getDynamicAttributeDisplayValue",
      "getDynamicAttributeValue",
      "getEscapedDisplayValue",
      "getFields",
      "getLocation",
      "getPlural",
      "getRelatedLists",
      "getRelatedTables",
      "getRowNumber",
      "hasAttachments",
      "insertWithReferences",
      "instanceOf",
      "queryNoDomain",
      "restoreLocation",
      "saveLocation",
      "setDisplayValue",
      "setDynamicAttributeDisplayValue",
      "setDynamicAttributeValue",
      "setDynamicAttributeValues",
      "setForceUpdate",
      "setLocation",
      "setNewGuid",
      "setQueryReferences",
      "setUseEngines",
    ]);
    for (const method of GLIDE_RECORD_METHODS) {
      for (const scope of method.supportedScopes) {
        assert.equal(
          GLIDE_DOCUMENTED_METHODS.australia[scope].includes(method.name),
          true,
          `${method.name} missing from Australia ${scope} inventory`,
        );
      }
    }
    const australia = resolveGlideCapabilities({ scope: "scoped", release: "australia" });
    assert.equal(australia.knownMethods.has("getTableName"), true);
    assert.equal(australia.knownMethods.has("addInactiveQuery"), true);
    assert.equal(australia.modeledMethods.has("getTableName"), false);
    assert.equal(australia.modeledMethods.has("addInactiveQuery"), false);
  });

  it("keeps the global-only executor scoped to the global API", () => {
    const queryNoDomain = GLIDE_RECORD_METHODS.find((entry) => entry.name === "queryNoDomain");
    assert.deepEqual(queryNoDomain, {
      name: "queryNoDomain",
      roles: ["executor"],
      evidence: {
        zurich: GLIDE_RECORD_EVIDENCE.zurich.global,
        australia: GLIDE_RECORD_EVIDENCE.australia.global,
      },
      apiScope: "global",
      supportedScopes: ["global"],
      releases: ["zurich", "australia"],
    });
    assert.equal(GLIDE_SYSTEM_BYPASS_METHODS.has("queryNoDomain"), false);
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
