import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createReleaseTag } from "../../scripts/create-release-tag.mjs";

const COMMIT = "1".repeat(40);

describe("release tagger", () => {
  it("creates one lightweight tag at the exact current main commit", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body as string | undefined });
      if (url.endsWith("/git/ref/heads/main")) {
        return new Response(JSON.stringify({ object: { sha: COMMIT } }));
      }
      return new Response(JSON.stringify({ ref: "refs/tags/v2.0.0", object: { sha: COMMIT } }), {
        status: 201,
      });
    };

    const result = await createReleaseTag({
      version: "2.0.0",
      expectedCommit: COMMIT,
      repository: "martinthommesen/oxc-plugin-servicenow",
      token: "test-token",
      fetchImpl,
    });

    assert.deepEqual(result, {
      tag: "v2.0.0",
      commit: COMMIT,
      repository: "martinthommesen/oxc-plugin-servicenow",
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[1]?.method, "POST");
    assert.deepEqual(JSON.parse(calls[1]?.body ?? "{}"), {
      ref: "refs/tags/v2.0.0",
      sha: COMMIT,
    });
  });

  it("fails before tag creation when main moved", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ object: { sha: "2".repeat(40) } }));

    await assert.rejects(
      createReleaseTag({
        version: "2.0.0",
        expectedCommit: COMMIT,
        repository: "martinthommesen/oxc-plugin-servicenow",
        token: "test-token",
        fetchImpl,
      }),
      /main is/,
    );
  });
});
