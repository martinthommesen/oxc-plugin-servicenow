import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ENGINE_FEATURES,
  ENGINE_FEATURE_EVIDENCE,
  ENGINE_FEATURE_RELEASES,
  featureSupport,
} from "../src/engine/index.js";
import { SUPPORTED_SERVICENOW_RELEASES } from "../src/settings/index.js";

describe("ServiceNow engine feature matrix", () => {
  it("has complete evidence and mode cells for every reviewed release", () => {
    const releaseUpdateFeatures = new Set([
      "array-from-thisarg",
      "bigint-narrowing",
      "block-function-hoisting",
      "date-fraction-digits",
      "error-iserror",
      "function-call-apply-thisarg",
      "promise-try",
      "promise-withresolvers",
      "set-methods",
      "typed-array-factories",
    ]);
    const allModesReleaseUpdateFeatures = new Set([
      "block-function-hoisting",
      "date-fraction-digits",
    ]);
    assert.deepEqual(SUPPORTED_SERVICENOW_RELEASES, ["zurich", "australia"]);
    assert.deepEqual(Object.keys(ENGINE_FEATURE_RELEASES), SUPPORTED_SERVICENOW_RELEASES);
    for (const spec of Object.values(ENGINE_FEATURES)) {
      assert.deepEqual(Object.keys(spec.releases), SUPPORTED_SERVICENOW_RELEASES, spec.id);
      for (const cell of Object.values(spec.releases)) {
        assert.match(cell.evidence, /^https:\/\/www\.servicenow\.com\/docs\//);
        assert.deepEqual(Object.keys(cell.support).sort(), ["compatibility", "es2021", "es5"]);
        const documentedBy = releaseUpdateFeatures.has(spec.id)
          ? "official-release-update"
          : "official-table";
        assert.deepEqual(cell.supportBasis, {
          compatibility: allModesReleaseUpdateFeatures.has(spec.id)
            ? "official-release-update"
            : "es5-compatibility-policy",
          es5: documentedBy,
          es2021: documentedBy,
        });
      }
    }
    assert.deepEqual(ENGINE_FEATURE_EVIDENCE.australia, {
      url: ENGINE_FEATURE_RELEASES.australia,
      officialReleaseLabel: "Australia",
      officialUpdatedAt: "2026-03-12",
      reviewedAt: "2026-08-22",
    });
  });

  it("models Australia engine deltas without defaulting omission to Zurich", () => {
    for (const id of ["bigint64-arrays", "object-hasown"] as const) {
      assert.equal(featureSupport(id, "es2021", "zurich"), "unsupported");
      assert.equal(featureSupport(id, "es2021", "australia"), "supported");
      assert.equal(featureSupport(id, "es2021"), "unknown");
      assert.equal(featureSupport(id, "es5"), "unsupported");
    }
    assert.equal(featureSupport("error-iserror", "es5"), "unsupported");
    for (const id of [
      "array-from-thisarg",
      "bigint-narrowing",
      "error-iserror",
      "function-call-apply-thisarg",
      "promise-try",
      "promise-withresolvers",
      "set-methods",
      "typed-array-factories",
    ] as const) {
      assert.equal(featureSupport(id, "es2021", "zurich"), "unsupported");
      assert.equal(featureSupport(id, "es2021", "australia"), "supported");
      assert.equal(featureSupport(id, "es2021"), "unknown");
    }
    for (const id of ["promise-try", "promise-withresolvers"] as const) {
      assert.equal(featureSupport(id, "es5"), "disallowed");
    }
    assert.equal(featureSupport("set-methods", "es5"), "unsupported");
    assert.equal(featureSupport("array-from-thisarg", "es5"), "unsupported");
    assert.equal(featureSupport("function-call-apply-thisarg", "es5"), "unsupported");
    assert.equal(featureSupport("bigint-narrowing", "es5"), "unsupported");
    assert.equal(featureSupport("typed-array-factories", "es5"), "disallowed");
    for (const id of ["block-function-hoisting", "date-fraction-digits"] as const) {
      for (const mode of ["compatibility", "es5", "es2021"] as const) {
        assert.equal(featureSupport(id, mode, "zurich"), "unsupported");
        assert.equal(featureSupport(id, mode, "australia"), "supported");
        assert.equal(featureSupport(id, mode), "unknown");
      }
    }
  });

  it("attributes Australia-added features to the official engine update", () => {
    for (const id of [
      "array-from-thisarg",
      "bigint-narrowing",
      "block-function-hoisting",
      "error-iserror",
      "function-call-apply-thisarg",
      "date-fraction-digits",
      "promise-try",
      "promise-withresolvers",
      "set-methods",
      "typed-array-factories",
    ] as const) {
      for (const release of SUPPORTED_SERVICENOW_RELEASES) {
        const cell = ENGINE_FEATURES[id].releases[release];
        assert.match(cell.evidence, /updates-javascript-engine\.html$/);
        assert.equal(cell.supportBasis.es2021, "official-release-update");
        assert.equal(cell.supportBasis.es5, "official-release-update");
      }
    }
    for (const id of ["block-function-hoisting", "date-fraction-digits"] as const) {
      for (const release of SUPPORTED_SERVICENOW_RELEASES) {
        assert.deepEqual(ENGINE_FEATURES[id].releases[release].supportBasis, {
          compatibility: "official-release-update",
          es5: "official-release-update",
          es2021: "official-release-update",
        });
      }
    }
  });

  it("keeps universal restrictions and private static support distinct", () => {
    for (const candidateRelease of ["zurich", "australia"] as const) {
      assert.equal(
        featureSupport("private-instance-members", "es2021", candidateRelease),
        "unsupported",
      );
      assert.equal(
        featureSupport("dataview-bigint-getters", "es2021", candidateRelease),
        "unsupported",
      );
      assert.equal(
        featureSupport("private-static-members", "es2021", candidateRelease),
        "supported",
      );
    }
  });

  it("models globalThis as an ES2021-only server namespace", () => {
    for (const candidateRelease of ["zurich", "australia"] as const) {
      assert.equal(featureSupport("global-this", "es2021", candidateRelease), "supported");
      assert.equal(featureSupport("global-this", "es5", candidateRelease), "disallowed");
      assert.equal(featureSupport("global-this", "compatibility", candidateRelease), "disallowed");
    }
  });

  it("models Map and Set as ES2021-only collection types", () => {
    for (const id of ["map", "set"] as const) {
      for (const candidateRelease of ["zurich", "australia"] as const) {
        assert.equal(featureSupport(id, "es2021", candidateRelease), "supported");
        assert.equal(featureSupport(id, "es5", candidateRelease), "unsupported");
        assert.equal(featureSupport(id, "compatibility", candidateRelease), "unsupported");
      }
      assert.equal(featureSupport(id, "es2021"), "supported");
      assert.equal(featureSupport(id, "es5"), "unsupported");
      assert.equal(featureSupport(id, "compatibility"), "unsupported");
    }
  });

  it("records the method source-text delta without generalizing Function.toString", () => {
    assert.equal(
      featureSupport("function-tostring-method-source", "es2021", "zurich"),
      "disallowed",
    );
    assert.equal(
      featureSupport("function-tostring-method-source", "es2021", "australia"),
      "supported",
    );
    assert.equal(featureSupport("function-tostring-method-source", "es2021"), "unknown");
  });
});
