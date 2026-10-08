import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ESTree } from "@oxlint/plugins";
import { parseSync } from "oxc-parser";
import { buildScopeTree } from "../../src/analysis/bindings.js";
import type { FileAnalysis } from "../../src/analysis/file-analysis.js";
import { analyzePathBindings } from "../../src/analysis/path-state.js";
import { isNode, walk } from "../../src/utils/ast.js";
import { lint, lintWithAnalysis, parse } from "../helpers/rule-tester.js";
import { assertSubQuadratic } from "../helpers/scaling.js";
import { applyRules } from "../helpers/apply-rules.js";

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

function privateConstructorPrototypes(count: number): string {
  return `${"({ constructor: { prototype: {} } }).constructor.prototype.value = true;\n".repeat(count)}
var records = new GlideRecord("task"); records.deleteMultiple();`;
}

function inheritedStaticAccessorLookups(count: number): string {
  const classes = Array.from(
    { length: count },
    (_, index) =>
      `class Child${index + 1} extends ${index === 0 ? "Base" : `Child${index}`} { ${index === count - 1 ? "static flag = false;" : ""} }`,
  );
  return `class Base { static get flag() { return false; } }
${classes.join("\n")}
var Alias = Child${count}; var read = Alias.flag; gs.info(read);
delete Alias.flag;
${"read = Alias.flag; gs.info(read);\n".repeat(count)}
var records = new GlideRecord("task"); records.deleteMultiple();`;
}

function lintCompleteBulk(source: string): void {
  const { messages, analysis } = lintWithAnalysis(
    source,
    "no-unfiltered-gliderecord-bulk-operation",
  );
  assert.equal(analysis.pathBudgetExhausted, false, "path budget exhausted; not a valid sample");
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.messageId, "unfiltered");
}

function withSelectorScopes(count: number): string {
  return `var run = true; var records = new GlideRecord("task");
${"with ({ run: 0 }) { run = false; }\n".repeat(count)}
run &&= records.query(); gs.info(run); records.deleteMultiple();`;
}

function completeWithCalls(source: string): void {
  const parsed = parseSync("with.br.js", source, { sourceType: "script", lang: "js" });
  assert.deepEqual(parsed.errors, []);
  assert.ok(isNode(parsed.program));
  let analysis: FileAnalysis | undefined;
  const messages = applyRules(
    source,
    { ast: parsed.program },
    {
      filename: "with.br.js",
      ruleNames: ["no-unfiltered-gliderecord-bulk-operation"],
      onFileAnalysis: (value) => {
        analysis = value;
      },
    },
  );
  assert.ok(analysis);
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.equal(messages.length, 0, "with keeps public platform-method authority opaque");
  let queries = 0;
  let bulkCalls = 0;
  const outcome = analyzePathBindings({
    program: parsed.program,
    analysis: analysis.provenance,
    kinds: ["GlideRecord"],
    emptyData: () => 0,
    cloneData: (value) => value,
    mergeData: (left, right) => Math.max(left, right),
    equalsData: (left, right) => left === right,
    analyzeUncalledFunctions: false,
    onCall: ({ rec, property }) => {
      if (rec && property === "query") queries += 1;
      if (rec && property === "deleteMultiple") bulkCalls += 1;
    },
  });
  assert.equal(outcome.outcome, "complete");
  assert.equal(queries, 1);
  assert.equal(bulkCalls, 1);
}

function guardedHelperLookups(count: number): string {
  return `function helper(run) { run &&= new GlideRecord("task").deleteMultiple(); }
var gr = new GlideRecord("incident"); var alias; var constructed;
${"try { new (class { method(value) { return value; } field = 0; })((constructed = gr, 0)); } catch {} try { helper((alias = gr, false)); helper.call(null, true); void helper``; } catch {}\n".repeat(count)}
alias.deleteMultiple();
constructed.deleteMultiple();`;
}

function lintGuardedHelperLookups(source: string): void {
  const { messages, analysis } = lintWithAnalysis(
    source,
    "no-unfiltered-gliderecord-bulk-operation",
  );
  assert.equal(analysis.pathBudgetExhausted, false, "path budget exhausted; not a valid sample");
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  assert.deepEqual(
    messages.map((message) => message.line).sort((left, right) => left - right),
    [1, source.split("\n").length - 1, source.split("\n").length],
  );
}

function safeSuperArguments(count: number): string {
  return `class Base {}
${Array.from(
  { length: count },
  (_, index) =>
    `class Derived${index} extends Base { constructor() { super(0, false, null, {}, [], function() {}); } field = new GlideRecord("task").deleteMultiple(); } new Derived${index}();`,
).join("\n")}
var records = new GlideRecord("later"); records.deleteMultiple();`;
}

function lintSafeSuperArguments(source: string, count: number): void {
  const { messages, analysis } = lintWithAnalysis(
    source,
    "no-unfiltered-gliderecord-bulk-operation",
  );
  assert.equal(analysis.pathBudgetExhausted, false, "path budget exhausted; not a valid sample");
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  assert.deepEqual(
    messages.map(({ line }) => line).sort((left, right) => left - right),
    Array.from({ length: count + 1 }, (_, index) => index + 2),
  );
}

function prunedHelperDensity(count: number): string {
  const lines = ["var f0 = function() {}; f0(false);"];
  for (let index = 1; index <= 64; index += 1) {
    lines.push(`var f${index} = function(flag) { flag &&= f${index - 1}(); }; f${index}(false);`);
  }
  lines.push("f64(false);\n".repeat(count));
  lines.push('var records = new GlideRecord("task"); records.deleteMultiple();');
  return lines.join("\n");
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

  // @lat: [[tests#Analysis behavior#Literal prototype and inherited accessor walks scale with complete findings]]
  it("keeps literal prototype and inherited accessor walks sub-quadratic with a later finding", () => {
    for (const [label, fixture] of [
      ["private own-constructor prototype accesses", privateConstructorPrototypes],
      ["inherited static accessor hierarchy and lookups", inheritedStaticAccessorLookups],
    ] as const) {
      const small = fixture(125);
      const large = fixture(500);
      assertSubQuadratic({
        label,
        smallLabel: "125",
        largeLabel: "500",
        small: () => lintCompleteBulk(small),
        large: () => lintCompleteBulk(large),
      });
    }
  });
  // @lat: [[tests#Analysis behavior#With body walks scale with complete operation reachability]]
  it("keeps cached with-body walks sub-quadratic with possible query and bulk operations", () => {
    const small = withSelectorScopes(125);
    const large = withSelectorScopes(500);
    assertSubQuadratic({
      label: "with body capture walks",
      smallLabel: "125 bodies",
      largeLabel: "500 bodies",
      small: () => completeWithCalls(small),
      large: () => completeWithCalls(large),
    });
  });

  // @lat: [[tests#Analysis behavior#Guarded local and opaque helper paths scale with complete findings]]
  it("keeps guarded direct and opaque helper paths sub-quadratic with all findings", () => {
    const small = guardedHelperLookups(125);
    const large = guardedHelperLookups(500);
    assertSubQuadratic({
      label: "guarded helper lookup and inspection",
      smallLabel: "125 handlers",
      largeLabel: "500 handlers",
      small: () => lintGuardedHelperLookups(small),
      large: () => lintGuardedHelperLookups(large),
    });
  });

  // @lat: [[tests#Analysis behavior#Safe super argument proofs scale with every reached field finding]]
  it("keeps cached safe super argument proofs sub-quadratic with all field findings", () => {
    const small = safeSuperArguments(125);
    const large = safeSuperArguments(500);
    assertSubQuadratic({
      label: "safe literal super argument proofs",
      smallLabel: "125 classes",
      largeLabel: "500 classes",
      small: () => lintSafeSuperArguments(small, 125),
      large: () => lintSafeSuperArguments(large, 500),
    });
  });

  // @lat: [[tests#Analysis behavior#Pruned helper call density scales with complete findings]]
  it("keeps pruned helper call density sub-quadratic with a later finding", () => {
    const small = prunedHelperDensity(125);
    const large = prunedHelperDensity(500);
    assertSubQuadratic({
      label: "pruned helper calls with direct capture snapshots",
      smallLabel: "125 calls",
      largeLabel: "500 calls",
      small: () => lintCompleteBulk(small),
      large: () => lintCompleteBulk(large),
    });
  });
});
