import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_FLUENT_MANIFEST,
  entitiesRequiringId,
  knownDirectiveNames,
} from "../src/fluent/index.js";

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
});
