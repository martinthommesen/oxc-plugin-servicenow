import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  apisByName,
  DEFAULT_FLUENT_MANIFEST,
  knownDirectiveNames,
  resolveFluentManifest,
} from "../src/fluent/index.js";
import { compareFluentVersions, isAllowedFluentEvidenceLocation } from "../src/fluent/evidence.js";
import { assertFluentLifecycleMatches } from "../src/fluent/lifecycle.js";

// Lifecycle and declaration evidence live in the fixture, which is the review
// artifact. The shipped snapshot carries only what `registry.ts` reads.
const DECLARATION_EVIDENCE = JSON.parse(
  readFileSync(new URL("../tests/fixtures/fluent-sdk-declarations.json", import.meta.url), "utf8"),
) as {
  versions: Record<
    string,
    { lifecycle: Record<string, { introduced: string | null; deprecated: string | null }> }
  >;
};

// @lat: [[tests#Fluent manifest#The manifest matches the pinned fixture]]
describe("Fluent SDK manifest", () => {
  it("includes official directives", () => {
    const names = knownDirectiveNames();
    assert.ok(names.has("fluent-ignore"));
    assert.ok(names.has("fluent-disable-sync"));
    assert.ok(names.has("fluent-disable-sync-for-file"));
  });

  it("requires evidence and an id requirement on every API and directive", () => {
    for (const api of DEFAULT_FLUENT_MANIFEST.apis) {
      assert.ok(api.evidence.length > 8, `${api.name} is missing evidence`);
      assert.ok(api.name.length > 0);
    }
    for (const directive of DEFAULT_FLUENT_MANIFEST.directives) {
      assert.ok(isAllowedFluentEvidenceLocation(directive.evidence), `${directive.name} evidence`);
    }
    const apis = apisByName();
    assert.equal(apis.get("BusinessRule")?.idRequirement, "required");
    assert.equal(apis.get("ClientScript")?.idRequirement, "required");
    assert.notEqual(apis.get("Table")?.idRequirement, "required");
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
    const expected = DECLARATION_EVIDENCE.versions["4.10.0"]?.lifecycle["StateModel"];
    assert.ok(api);
    assert.ok(expected);
    const mutated = { ...api };
    delete mutated.introduced;
    assert.throws(
      () => assertFluentLifecycleMatches(mutated, expected),
      /introduction lifecycle drifted/,
    );

    const list = resolveFluentManifest("4.11.0").apis.find((item) => item.name === "List");
    const listExpected = DECLARATION_EVIDENCE.versions["4.11.0"]?.lifecycle["List"];
    assert.ok(list);
    assert.ok(listExpected);
    const deprecatedMutation = { ...list };
    delete deprecatedMutation.deprecated;
    assert.throws(
      () => assertFluentLifecycleMatches(deprecatedMutation, listExpected),
      /deprecation lifecycle drifted/,
    );
  });

  it("reports the first deprecating version for List and Role (FINDINGS.md MNT-006)", () => {
    for (const version of ["4.0.0", "4.1.0", "4.11.0"]) {
      const manifest = resolveFluentManifest(version);
      assert.equal(
        manifest.apis.find((api) => api.name === "List")?.deprecated,
        "4.0.0",
        `List deprecation at ${version}`,
      );
      assert.equal(
        manifest.apis.find((api) => api.name === "Role")?.deprecated,
        "4.0.0",
        `Role deprecation at ${version}`,
      );
    }
    const before = resolveFluentManifest("3.0.3");
    assert.equal(before.apis.find((api) => api.name === "List")?.deprecated, undefined);
    assert.equal(before.apis.find((api) => api.name === "Role")?.deprecated, undefined);
  });
});
