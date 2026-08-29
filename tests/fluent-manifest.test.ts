import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_FLUENT_MANIFEST,
  entitiesRequiringId,
  knownDirectiveNames,
  resolveFluentManifest,
} from "../src/fluent/index.js";
import { FLUENT_DECLARATION_SNAPSHOTS } from "../src/fluent/declaration-snapshots.js";
import { compareFluentVersions, isAllowedFluentEvidenceLocation } from "../src/fluent/evidence.js";
import { assertFluentLifecycleMatches } from "../src/fluent/lifecycle.js";

function isHttpsServiceNowDocsUrl(evidence: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(evidence);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && parsed.hostname === "www.servicenow.com";
}

describe("Fluent SDK manifest", () => {
  it("includes official directives", () => {
    const names = knownDirectiveNames();
    assert.ok(names.has("fluent-ignore"));
    assert.ok(names.has("fluent-disable-sync"));
    assert.ok(names.has("fluent-disable-sync-for-file"));
  });

  it("requires evidence on every API and directive", () => {
    for (const api of DEFAULT_FLUENT_MANIFEST.apis) {
      assert.ok(api.evidence.length > 8, `${api.name} is missing evidence`);
      assert.ok(api.name.length > 0);
    }
    for (const directive of DEFAULT_FLUENT_MANIFEST.directives) {
      assert.ok(isHttpsServiceNowDocsUrl(directive.evidence), `${directive.name} evidence`);
    }
  });

  it("requires $id on BusinessRule and not on Table", () => {
    const required = entitiesRequiringId();
    assert.ok(required.has("BusinessRule"));
    assert.ok(required.has("ClientScript"));
    assert.equal(required.has("Table"), false);
  });

  it("does not force Flow onto @servicenow/sdk/core", () => {
    const flow = DEFAULT_FLUENT_MANIFEST.apis.find((api) => api.name === "Flow");
    assert.equal(flow?.module, "unknown");
    assert.equal(flow?.idRequirement, "unknown");
  });

  it("rejects deceptive and malformed evidence locations", () => {
    assert.equal(
      isAllowedFluentEvidenceLocation("https://www.servicenow.com.attacker.example/docs/r/api"),
      false,
    );
    assert.equal(
      isAllowedFluentEvidenceLocation(
        "https://registry.npmjs.org/attacker/@servicenow%2fsdk-core/-/sdk-core-4.11.0.tgz",
      ),
      false,
    );
    assert.equal(isAllowedFluentEvidenceLocation("docs/../secrets.txt"), false);
    assert.equal(
      isAllowedFluentEvidenceLocation(
        "https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html",
      ),
      true,
    );
  });

  it("compares semantic versions numerically", () => {
    assert.ok(compareFluentVersions("4.9.2", "4.10.0") < 0);
    assert.ok(compareFluentVersions("4.10.0", "4.9.2") > 0);
    assert.equal(compareFluentVersions("4.10.0", "4.10.0"), 0);
    assert.throws(() => compareFluentVersions("4.10", "4.10.0"));
  });

  it("rejects deleted introduced and deprecated lifecycle fields", () => {
    const manifest = resolveFluentManifest("4.10.0");
    const api = manifest.apis.find((item) => item.name === "StateModel");
    const expected = FLUENT_DECLARATION_SNAPSHOTS["4.10.0"]?.lifecycle.StateModel;
    assert.ok(api);
    assert.ok(expected);
    const mutated = { ...api };
    delete mutated.introduced;
    assert.throws(
      () => assertFluentLifecycleMatches(mutated, expected),
      /introduction lifecycle drifted/,
    );

    const list = resolveFluentManifest("4.11.0").apis.find((item) => item.name === "List");
    const listExpected = FLUENT_DECLARATION_SNAPSHOTS["4.11.0"]?.lifecycle.List;
    assert.ok(list);
    assert.ok(listExpected);
    const deprecatedMutation = { ...list };
    delete deprecatedMutation.deprecated;
    assert.throws(
      () => assertFluentLifecycleMatches(deprecatedMutation, listExpected),
      /deprecation lifecycle drifted/,
    );
  });
});
