import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ESTree } from "@oxlint/plugins";
import { buildScopeTree } from "../../src/analysis/bindings.js";
import { isNode, walk } from "../../src/utils/ast.js";
import { lint, lintWithAnalysis, parse } from "../helpers/rule-tester.js";
import { assertSubQuadratic } from "../helpers/scaling.js";

function aliasFixture(count: number): string {
  const lines = ['import { Table } from "@servicenow/sdk";'];
  for (let index = 0; index < count; index += 1) lines.push(`let a${index} = Table;`);
  for (let index = 0; index < count; index += 1) lines.push(`a${index}({ name: "row${index}" });`);
  return `${lines.join("\n")}\n`;
}

function scopeFixture(count: number): {
  program: ESTree.Node;
  uses: Extract<ESTree.Node, { type: "Identifier" }>[];
} {
  const program = parse(
    Array.from(
      { length: count },
      (_, index) =>
        `function owner${index}(value) { { const local = value; local; } return value; }`,
    ).join("\n"),
  ).ast;
  assert.ok(isNode(program));
  const uses: Extract<ESTree.Node, { type: "Identifier" }>[] = [];
  walk(program, {
    Identifier(node) {
      if (node.type === "Identifier" && ["value", "local"].includes(node.name)) uses.push(node);
    },
  });
  return { program, uses };
}

function resolveScopeFixture(fixture: ReturnType<typeof scopeFixture>): void {
  const tree = buildScopeTree(fixture.program);
  for (const node of fixture.uses) assert.ok(tree.resolve(node.name, node));
}

function sequenceSelectorFixture(count: number): string {
  let condition = "true";
  for (let depth = 0; depth < 8; depth += 1) condition = `(0, ${condition})`;
  return Array.from(
    { length: count },
    (_, index) => `function selector${index}() {
  var queried = new GlideRecord("incident");
  if (${condition}) queried.query();
  queried.next();
  var unopened${index} = new GlideRecord("task");
  unopened${index}.next();
}
selector${index}();`,
  ).join("\n");
}

function lintSequenceSelectors(source: string, count: number): void {
  const { messages, analysis } = lintWithAnalysis(source, "require-query-before-next", {
    filename: "selectors.br.js",
  });
  assert.equal(analysis.pathBudgetExhausted, false, "path budget exhausted; not a valid sample");
  assert.equal(messages.length, count);
  const reported = new Set(
    messages.map(({ message, messageId }) => {
      assert.equal(messageId, "missingQuery");
      return /^`(unopened\d+)\.next\(\)`/u.exec(message)?.[1];
    }),
  );
  assert.equal(reported.size, count);
  for (let index = 0; index < count; index += 1) assert.ok(reported.has(`unopened${index}`));
}

// @lat: [[tests#Analysis behavior#Alias resolution scales linearly]]
describe("alias scaling (FINDINGS.md PER-005)", () => {
  it("stays sub-quadratic when aliases and call sites quadruple", () => {
    const small = aliasFixture(100);
    const large = aliasFixture(400);
    assertSubQuadratic({
      label: "alias scaling",
      smallLabel: "100 aliases",
      largeLabel: "400",
      small: () => void lint(small, "require-fluent-id", { filename: "file.now.ts" }),
      large: () => void lint(large, "require-fluent-id", { filename: "file.now.ts" }),
    });
  });

  // @lat: [[tests#Analysis behavior#Known-node scope construction and lookup scale together]]
  it("stays sub-quadratic when scope construction and ancestor-free lookups quadruple", () => {
    const small = scopeFixture(500);
    const large = scopeFixture(2000);
    assertSubQuadratic({
      label: "indexed scope construction and lookup",
      smallLabel: "500 functions",
      largeLabel: "2000 functions",
      small: () => resolveScopeFixture(small),
      large: () => resolveScopeFixture(large),
    });
  });

  // @lat: [[tests#Analysis behavior#Nested sequence selectors scale with complete findings]]
  it("stays sub-quadratic when nested sequence selectors quadruple with analysis active", () => {
    const small = sequenceSelectorFixture(50);
    const large = sequenceSelectorFixture(200);
    assertSubQuadratic({
      label: "nested sequence selector scaling",
      smallLabel: "50 functions",
      largeLabel: "200 functions",
      small: () => lintSequenceSelectors(small, 50),
      large: () => lintSequenceSelectors(large, 200),
    });
  });
});
