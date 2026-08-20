import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fallbackComments } from "../../src/utils/ast.js";

describe("fallbackComments", () => {
  it("extracts line and block comments without a backtracking regex", () => {
    const comments = fallbackComments("var x = 1; // tail\n/* block */\n// last");
    assert.deepEqual(
      comments.map((comment) => comment.value),
      [" tail", " block ", " last"],
    );
  });

  it("skips an unclosed block comment and still finds a later line comment", () => {
    const comments = fallbackComments(`/*${"a/*".repeat(4000)}\n// later`);
    assert.equal(comments.length, 1);
    assert.equal(comments[0]?.value, " later");
  });

  it("closes the first opener at the first star-slash", () => {
    const comments = fallbackComments("/* start\n/* inner */ after");
    assert.equal(comments.length, 1);
    assert.equal(comments[0]?.value, " start\n/* inner ");
  });

  it("keeps an empty closed block comment", () => {
    const comments = fallbackComments("/**/");
    assert.equal(comments.length, 1);
    assert.equal(comments[0]?.value, "");
    assert.equal(comments[0]?.start, 0);
    assert.equal(comments[0]?.end, 4);
  });
});
