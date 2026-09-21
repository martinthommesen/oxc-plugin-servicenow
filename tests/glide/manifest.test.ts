import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GLIDE_AGGREGATE_EVIDENCE,
  GLIDE_AGGREGATE_METHODS,
  GLIDE_API_RELEASES,
  GLIDE_DOCUMENTED_METHODS,
  GLIDE_RECORD_METHODS,
  GLIDE_RECORD_EVIDENCE,
  resolveGlideCapabilities,
} from "../../src/glide/index.js";

// Role membership has one home: the resolved view. These read it across every
// admissible scope, so a membership assertion cannot pass for the reason the
// deleted flat sets used to give (a single un-versioned derivation).
const anyScope = resolveGlideCapabilities({ scope: "unknown" });

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
    assert.equal(anyScope.byKind.GlideRecord.possibleExecutors.has("getAsync"), false);
    assert.equal(anyScope.byKind.GlideRecord.possibleExecutors.has("query"), true);
    assert.equal(anyScope.byKind.GlideRecord.possibleExecutors.has("_query"), true);
    assert.equal(anyScope.byKind.GlideRecord.possibleExecutors.has("queryNoDomain"), true);
    assert.equal(anyScope.byKind.GlideRecord.possibleExecutors.has("get"), true);
    assert.equal(anyScope.byKind.GlideRecord.cursorAdvancers.has("next"), true);
    assert.equal(anyScope.byKind.GlideRecord.cursorAdvancers.has("_next"), true);
  });

  it("selects capabilities by exact scope and release", () => {
    const scoped = resolveGlideCapabilities({ scope: "scoped", release: "zurich" });
    const global = resolveGlideCapabilities({ scope: "global", release: "zurich" });
    const unknown = resolveGlideCapabilities({ scope: "unknown", release: "zurich" });
    assert.equal(scoped.byKind.GlideRecord.executors.has("query"), true);
    assert.equal(scoped.byKind.GlideRecord.executors.has("_query"), true);
    assert.equal(scoped.byKind.GlideRecord.executors.has("queryNoDomain"), false);
    assert.equal(scoped.byKind.GlideRecord.executors.has("getAsync"), false);
    assert.equal(global.byKind.GlideRecord.executors.has("_query"), true);
    assert.equal(global.byKind.GlideRecord.executors.has("queryNoDomain"), true);
    assert.equal(global.byKind.GlideRecord.executors.has("getAsync"), false);
    assert.equal(unknown.byKind.GlideRecord.executors.has("_query"), true);
    assert.equal(unknown.byKind.GlideRecord.executors.has("queryNoDomain"), false);
    assert.equal(unknown.byKind.GlideRecord.possibleExecutors.has("queryNoDomain"), true);
    assert.equal(unknown.byKind.GlideRecord.executors.has("getAsync"), false);
    assert.equal(unknown.knownMethods.has("queryNoDomain"), true);
    assert.equal(scoped.byKind.GlideRecord.cursorAdvancers.has("_next"), true);
    assert.equal(global.byKind.GlideRecord.cursorAdvancers.has("_next"), true);
    assert.equal(resolveGlideCapabilities({ scope: "scoped", release: "zurich" }), scoped);
    assert.equal("add" in scoped.byKind.GlideRecord.executors, false);
  });

  it("keeps Australia capabilities exact and omission release-conservative", () => {
    const australiaGlobal = resolveGlideCapabilities({ scope: "global", release: "australia" });
    const australiaScoped = resolveGlideCapabilities({ scope: "scoped", release: "australia" });
    const omitted = resolveGlideCapabilities({ scope: "unknown" });
    assert.equal(australiaGlobal.release, "australia");
    assert.deepEqual(australiaGlobal.releases, ["australia"]);
    assert.equal(australiaGlobal.byKind.GlideRecord.executors.has("queryNoDomain"), true);
    assert.equal(australiaScoped.byKind.GlideRecord.executors.has("queryNoDomain"), false);
    assert.equal(omitted.release, undefined);
    assert.deepEqual(omitted.releases, ["zurich", "australia"]);
    assert.equal(omitted.byKind.GlideRecord.executors.has("queryNoDomain"), false);
    assert.equal(omitted.byKind.GlideRecord.possibleExecutors.has("queryNoDomain"), true);
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
    assert.equal(anyScope.byKind.GlideRecord.systemBypass.has("queryNoDomain"), false);
  });

  it("lists only documented ACL-bypass methods", () => {
    assert.deepEqual([...anyScope.byKind.GlideRecord.systemBypass].sort(), [
      "addSystemEncodedQuery",
      "addSystemOrderBy",
      "addSystemOrderByDesc",
      "addSystemQuery",
    ]);
    assert.equal(anyScope.byKind.GlideRecord.systemBypass.has("addSystemFoo"), false);
    assert.equal(anyScope.byKind.GlideRecord.systemBypass.has("addQuery"), false);
  });

  it("treats user and system query builders as filters", () => {
    assert.equal(anyScope.byKind.GlideRecord.filters.has("addUserQuery"), true);
    assert.equal(anyScope.byKind.GlideRecord.filters.has("addUserEncodedQuery"), true);
    assert.equal(anyScope.byKind.GlideRecord.filters.has("addSystemQuery"), true);
    assert.equal(anyScope.byKind.GlideRecord.filters.has("query"), false);
    assert.equal(anyScope.byKind.GlideRecord.filters.has("orderBy"), false);
    assert.equal(anyScope.byKind.GlideRecord.filters.has("setLimit"), false);
    assert.equal(anyScope.byKind.GlideRecord.filters.has("chooseWindow"), false);
    assert.equal(anyScope.byKind.GlideRecord.filters.has("addInactiveQuery"), false);
  });

  it("resolves GlideAggregate query roles by receiver kind, not by string literal", () => {
    const aggregate = anyScope.byKind.GlideAggregate;
    assert.deepEqual([...aggregate.executors], ["query"]);
    assert.deepEqual([...aggregate.cursorAdvancers], ["next"]);
    // The two methods the finders key on argument tuples carry no query role, so
    // a role read must not claim them as executors.
    assert.equal(aggregate.executors.has("addAggregate"), false);
    assert.equal(aggregate.executors.has("getAggregate"), false);
    assert.deepEqual([...aggregate.filters], []);
    // The GlideRecord answer is unchanged.
    assert.equal(anyScope.byKind.GlideRecord.executors.has("query"), true);
    assert.equal(anyScope.byKind.GlideRecord.executors.has("get"), true);
    assert.equal(anyScope.byKind.GlideRecord.executors.has("next"), false);
  });

  it("cites only reviewed GlideAggregate pages", () => {
    assert.match(GLIDE_AGGREGATE_EVIDENCE.zurich.scoped!, /\/r\/zurich\//);
    assert.match(GLIDE_AGGREGATE_EVIDENCE.zurich.scoped!, /c_GlideAggregateScopedAPI/);
    assert.match(GLIDE_AGGREGATE_EVIDENCE.australia.scoped!, /c_GlideAggregateScopedAPI/);
    assert.match(GLIDE_AGGREGATE_EVIDENCE.australia.global!, /c_GlideAggregateAPI/);
    assert.match(GLIDE_AGGREGATE_EVIDENCE.zurich.global!, /c_GlideAggregateAPI/);
    for (const entry of GLIDE_AGGREGATE_METHODS) {
      assert.deepEqual(entry.releases, ["zurich", "australia"]);
      assert.equal(entry.evidence.zurich, GLIDE_AGGREGATE_EVIDENCE.zurich.scoped);
      assert.equal(entry.evidence.australia, GLIDE_AGGREGATE_EVIDENCE.australia.scoped);
      assert.equal(typeof GLIDE_AGGREGATE_EVIDENCE.australia.scoped, "string");
    }
  });
});
