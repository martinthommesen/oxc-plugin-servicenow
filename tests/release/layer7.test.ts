import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseNpmVersion, assertTrustedPublishingNpm } from "../../scripts/check-trusted-publishing-npm.mjs";
import { parseReleaseView, releaseAction, releaseAssetNames } from "../../scripts/create-github-release.mjs";
import { packageTargetPath } from "../../scripts/check-release-artifact.mjs";
import { isTransientRegistryError, retryBounded } from "../../scripts/verify-published-package.mjs";
import { checkActionPins } from "../../scripts/check-action-pins.mjs";

const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");

describe("release automation gates", () => {
  it("enforces one full-SHA action pin set across workflows", () => {
    const result = checkActionPins();
    assert.equal(result.workflows, 2);
    assert.equal(result.actions, 4);
  });

  it("accepts only the pinned executable npm version", () => {
    assert.equal(parseNpmVersion("11.5.1\n"), "11.5.1");
    assert.equal(assertTrustedPublishingNpm("11.5.1", "11.5.1"), "11.5.1");
    assert.throws(() => parseNpmVersion("v11.5.1\n"), /invalid/);
    assert.throws(() => assertTrustedPublishingNpm("11.5.2", "11.5.1"), /requires npm/);
  });

  it("makes GitHub release retries idempotent and exposes only safe targets", () => {
    assert.equal(releaseAction(undefined, "pkg.tgz"), "create");
    assert.equal(releaseAction({ tagName: "v2.0.0", assets: [] }, "pkg.tgz"), "upload-asset");
    assert.equal(releaseAction({ tagName: "v2.0.0", assets: [{ name: "pkg.tgz" }] }, "pkg.tgz"), "verify-asset");
    assert.deepEqual(releaseAssetNames({ assets: [{ name: "pkg.tgz" }, { name: 1 }] }), ["pkg.tgz"]);
    assert.deepEqual(parseReleaseView('{"tagName":"v2.0.0"}').tagName, "v2.0.0");
    assert.throws(() => parseReleaseView("[]"), /no release object/);
    assert.equal(packageTargetPath("./dist/index.js"), "package/dist/index.js");
    assert.equal(packageTargetPath("../outside.js"), undefined);
  });

  it("retries only transient registry lag and bounds the attempt window", async () => {
    let attempts = 0;
    const result = await retryBounded(
      async () => {
        attempts += 1;
        if (attempts < 3) throw Object.assign(new Error("registry returned 503"), { code: "E503" });
        return "ready";
      },
      { timeoutMs: 100, intervalMs: 1 },
    );
    assert.equal(result, "ready");
    assert.equal(attempts, 3);
    assert.equal(isTransientRegistryError(Object.assign(new Error("integrity mismatch"), { code: "EINTEGRITY" })), false);
    assert.equal(isTransientRegistryError(Object.assign(new Error("temporary timeout"), { code: "ETIMEDOUT" })), true);
    await assert.rejects(
      retryBounded(async () => { throw Object.assign(new Error("integrity mismatch"), { code: "EINTEGRITY" }); }, { timeoutMs: 10, intervalMs: 1 }),
      /integrity mismatch/,
    );
  });

  it("keeps OIDC and privileged permissions isolated to publish/release jobs", () => {
    assert.match(workflow, /id-token:\s*write/);
    assert.equal((workflow.match(/^\s+id-token:\s*write$/gm) ?? []).length, 1);
    assert.match(workflow, /node-version:\s*24\.5\.0/);
    assert.match(workflow, /npm publish .*--provenance/);
    assert.doesNotMatch(workflow, /NPM_TOKEN/);
    assert.match(workflow, /needs:\s*\[validate, consumer\]/);
    assert.match(workflow, /registry-verify:/);
    assert.match(workflow, /github-release:/);
  });
});
