import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createReleaseTag } from "../../scripts/create-release-tag.mjs";
import { readPackageJson } from "../integration/helpers.js";

const COMMIT = "1".repeat(40);
const REPOSITORY = "martinthommesen/oxc-plugin-servicenow";
const pkg = readPackageJson();
const TAG = `v${pkg.version}`;
const CHANGELOG = `# Changelog\n\n## Unreleased\n\n## ${pkg.version} — 2026-01-01\n\n- note\n`;
const READ_TAG = `GET /git/ref/tags/${TAG}`;
const READ_MAIN = "GET /git/ref/heads/main";
const CREATE_TAG = "POST /git/refs";

function github(handlers: { tag?: () => Response; main?: () => Response }) {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const call = `${init?.method ?? "GET"} ${new URL(String(input)).pathname.replace(`/repos/${REPOSITORY}`, "")}`;
    calls.push(call);
    if (call === READ_TAG) return handlers.tag?.() ?? new Response("Not Found", { status: 404 });
    if (call === READ_MAIN) {
      return handlers.main?.() ?? new Response(JSON.stringify({ object: { sha: COMMIT } }));
    }
    if (call === CREATE_TAG) {
      assert.deepEqual(JSON.parse(String(init?.body)), { ref: `refs/tags/${TAG}`, sha: COMMIT });
      return new Response(JSON.stringify({ ref: `refs/tags/${TAG}`, object: { sha: COMMIT } }), {
        status: 201,
      });
    }
    throw new Error(`unexpected request ${call}`);
  };
  return { calls, fetchImpl };
}

describe("release tagger", () => {
  // @lat: [[tests#Release governance#Merging a version tags it exactly once]]
  it("creates one lightweight tag at the exact current main commit", async () => {
    const { calls, fetchImpl } = github({});
    const result = await createReleaseTag({
      version: pkg.version,
      expectedCommit: COMMIT,
      repository: REPOSITORY,
      token: "test-token",
      changelog: CHANGELOG,
      fetchImpl,
    });
    assert.deepEqual(result, { tag: TAG, commit: COMMIT, repository: REPOSITORY });
    assert.deepEqual(calls, [READ_TAG, READ_MAIN, CREATE_TAG]);
  });

  it("defaults the version to package.json so a push needs no input", async () => {
    const { calls, fetchImpl } = github({});
    const result = await createReleaseTag({
      expectedCommit: COMMIT,
      repository: REPOSITORY,
      token: "test-token",
      changelog: CHANGELOG,
      fetchImpl,
    });
    assert.equal(result.tag, TAG);
    assert.equal(calls.at(-1), CREATE_TAG);
  });

  it("reports an existing tag without pushing anything", async () => {
    const existing = "2".repeat(40);
    const { calls, fetchImpl } = github({
      tag: () => new Response(JSON.stringify({ object: { sha: existing } })),
    });
    const result = await createReleaseTag({
      expectedCommit: COMMIT,
      repository: REPOSITORY,
      token: "test-token",
      changelog: CHANGELOG,
      fetchImpl,
    });
    assert.deepEqual(result, { tag: TAG, commit: existing, repository: REPOSITORY });
    assert.deepEqual(calls, [READ_TAG]);
  });

  it("refuses to tag a version the changelog does not name", async () => {
    const { calls, fetchImpl } = github({});
    await assert.rejects(
      createReleaseTag({
        expectedCommit: COMMIT,
        repository: REPOSITORY,
        token: "test-token",
        changelog: "# Changelog\n\n## Unreleased\n\n- pending\n",
        fetchImpl,
      }),
      /CHANGELOG\.md must contain an exact heading/,
    );
    assert.deepEqual(calls, [READ_TAG]);
  });

  it("fails before tag creation when main moved", async () => {
    const { calls, fetchImpl } = github({
      main: () => new Response(JSON.stringify({ object: { sha: "2".repeat(40) } })),
    });
    await assert.rejects(
      createReleaseTag({
        version: pkg.version,
        expectedCommit: COMMIT,
        repository: REPOSITORY,
        token: "test-token",
        changelog: CHANGELOG,
        fetchImpl,
      }),
      /main is/,
    );
    assert.deepEqual(calls, [READ_TAG, READ_MAIN]);
  });
});
