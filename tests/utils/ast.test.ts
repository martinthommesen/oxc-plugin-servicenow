import assert from "node:assert/strict";
import type { ESTree } from "@oxlint/plugins";
import { describe, it } from "node:test";
import { parse } from "../helpers/rule-tester.js";
import { fallbackComments, getName, isValueReference, walk } from "../../src/utils/ast.js";

describe("fallbackComments", () => {
  it("extracts line and block comments without a backtracking regex", () => {
    const comments = fallbackComments("var x = 1; // tail\n/* block */\n// last");
    assert.deepEqual(
      comments.map((comment) => comment.value),
      [" tail", " block ", " last"],
    );
  });

  it("skips an unclosed block comment and still finds a later line comment", () => {
    const source = `/*${"a/*".repeat(40_000)}\n// later`;
    const started = performance.now();
    const comments = fallbackComments(source);
    assert.equal(comments.length, 1);
    assert.equal(comments[0]?.value, " later");
    assert.ok(performance.now() - started < 250, "comment scan took longer than 250 ms");
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

describe("walk", () => {
  it("visits nodes deeper than the former recursion guard", () => {
    let node: Record<string, unknown> = { type: "Identifier", name: "value" };
    for (let depth = 0; depth < 1_000; depth += 1) {
      node = { type: "ExpressionStatement", expression: node };
    }
    let visited = 0;
    walk(node, { ExpressionStatement: () => (visited += 1) });
    assert.equal(visited, 1_000);
  });
});

function parentReferences(source: string, parentType: string, name: string): boolean[] {
  const parsed = parse(source, "references.ts");
  const references: boolean[] = [];
  const ancestors: ESTree.Node[] = [];
  walk(
    parsed.ast as unknown as ESTree.Node,
    {
      Identifier(node) {
        const parent = ancestors.at(-2);
        if (getName(node) === name && parent?.type === parentType)
          references.push(isValueReference(node, ancestors));
      },
    },
    ancestors,
  );
  return references;
}

describe("AST value references", () => {
  it("counts shorthand property values as reads", () => {
    assert.deepEqual(
      parentReferences("const value = 1; const record = { value };", "Property", "value"),
      [true, true],
    );
  });

  it("does not treat ExportSpecifier.local as a value read", () => {
    const source = "const value = 1; export { value as published };";
    assert.deepEqual(parentReferences(source, "ExportSpecifier", "value"), [false]);
    assert.deepEqual(parentReferences(source, "ExportSpecifier", "published"), [false]);
  });
});
