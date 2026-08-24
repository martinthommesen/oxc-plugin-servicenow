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
      "error-iserror",
      "promise-try",
      "promise-withresolvers",
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
          compatibility: "es5-compatibility-policy",
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
    for (const id of ["error-iserror", "promise-try", "promise-withresolvers"] as const) {
      assert.equal(featureSupport(id, "es2021", "zurich"), "unsupported");
      assert.equal(featureSupport(id, "es2021", "australia"), "supported");
      assert.equal(featureSupport(id, "es2021"), "unknown");
    }
    for (const id of ["promise-try", "promise-withresolvers"] as const) {
      assert.equal(featureSupport(id, "es5"), "disallowed");
    }
  });

  it("attributes Australia-added static methods to the official engine update", () => {
    for (const id of ["error-iserror", "promise-try", "promise-withresolvers"] as const) {
      for (const release of SUPPORTED_SERVICENOW_RELEASES) {
        const cell = ENGINE_FEATURES[id].releases[release];
        assert.match(cell.evidence, /updates-javascript-engine\.html$/);
        assert.equal(cell.supportBasis.es2021, "official-release-update");
        assert.equal(cell.supportBasis.es5, "official-release-update");
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
