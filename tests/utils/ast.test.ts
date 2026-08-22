import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ESTree } from "@oxlint/plugins";
import { parse } from "../helpers/rule-tester.js";
import { getName, isValueReference, walk } from "../../src/utils/ast.js";

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
