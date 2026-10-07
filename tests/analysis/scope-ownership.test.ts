import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ESTree } from "@oxlint/plugins";
import { buildScopeTree } from "../../src/analysis/bindings.js";
import { isNode, walk } from "../../src/utils/ast.js";
import { parse } from "../helpers/rule-tester.js";

function scopeFixture() {
  const program = parse(
    `const value = 1; function caller(value) { const local = value; } function outer() { return value; }`,
  ).ast;
  assert.ok(isNode(program));
  const tree = buildScopeTree(program);
  const functions = new Map<string, ESTree.Node>();
  const uses: ESTree.Node[] = [];
  walk(program, {
    FunctionDeclaration(node) {
      if (node.type === "FunctionDeclaration" && node.id) functions.set(node.id.name, node);
    },
    Identifier(node) {
      if (node.type === "Identifier" && node.name === "value") uses.push(node);
    },
  });
  const caller = functions.get("caller");
  const outer = functions.get("outer");
  const outerUse = uses.at(-1);
  assert.ok(caller && outer && outerUse);
  return { program, tree, caller, outer, outerUse };
}

// @lat: [[tests#Analysis behavior#Known AST nodes retain lexical scope ownership]]
describe("known-node lexical scopes", () => {
  it("runs shared entry callbacks after scope-specific visitors with the current ancestors", () => {
    const program = parse("function owner() { value; }").ast;
    assert.ok(isNode(program));
    const events: string[] = [];
    const ancestors: ESTree.Node[] = [];
    walk(
      program,
      {
        FunctionDeclaration() {
          events.push("enter function");
        },
        "*"(node) {
          if (node.type === "FunctionDeclaration") events.push("index function");
          if (node.type === "Identifier" && node.name === "value")
            events.push(ancestors.map((ancestor) => ancestor.type).join("/"));
        },
      },
      ancestors,
    );
    assert.deepEqual(events, [
      "enter function",
      "index function",
      "Program/FunctionDeclaration/BlockStatement/ExpressionStatement/Identifier",
    ]);
  });

  it("uses the node's lexical scope before a caller's unrelated ancestors", () => {
    const { program, tree, caller, outerUse } = scopeFixture();
    assert.equal(tree.resolve("value", outerUse, [program, caller])?.kind, "const");
  });

  it("resolves indexed known nodes without source offsets", () => {
    const { tree, caller, outerUse } = scopeFixture();
    Reflect.deleteProperty(outerUse, "start");
    Reflect.deleteProperty(outerUse, "end");
    assert.equal(tree.resolve("value", outerUse, [caller])?.kind, "const");
  });

  it("preserves offset lookup for a foreign node", () => {
    const { tree, outerUse } = scopeFixture();
    const foreign = { ...outerUse };
    assert.equal(tree.resolve("value", foreign)?.kind, "const");
  });

  it("keeps ownership isolated between independently built trees", () => {
    const first = scopeFixture();
    const second = scopeFixture();
    assert.notEqual(
      first.tree.scopeForNode(first.outerUse),
      second.tree.scopeForNode(second.outerUse),
    );
    assert.equal(first.tree.executionBoundaryForNode(first.outerUse)?.block, first.outer);
  });
});
