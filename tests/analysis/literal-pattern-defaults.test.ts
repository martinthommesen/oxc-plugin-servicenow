import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis, parse } from "../helpers/rule-tester.js";
import { assertSubQuadratic } from "../helpers/scaling.js";
import { applyRules } from "../helpers/apply-rules.js";
import { analyzePathBindings } from "../../src/analysis/path-state.js";
import type { FileAnalysis } from "../../src/analysis/file-analysis.js";
import { isNode } from "../../src/utils/ast.js";

function bulkFindings(code: string, expected: number): void {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.equal(messages.length, expected);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
}

function reachableBulkCalls(code: string, expected: number): void {
  const parsed = parse(code);
  let analysis: FileAnalysis | undefined;
  applyRules(code, parsed, {
    filename: "src/server/test.js",
    ruleNames: ["no-unfiltered-gliderecord-bulk-operation"],
    onFileAnalysis: (seen) => {
      analysis = seen;
    },
  });
  assert.ok(analysis);
  assert.ok(isNode(parsed.ast));
  let calls = 0;
  const outcome = analyzePathBindings({
    program: parsed.ast,
    analysis: analysis.provenance,
    kinds: [],
    emptyData: () => 0,
    cloneData: (data) => data,
    mergeData: (left, right) => Math.max(left, right),
    equalsData: (left, right) => left === right,
    onCall: ({ property }) => {
      if (property === "deleteMultiple") calls += 1;
    },
  });
  assert.equal(outcome.outcome, "complete");
  assert.equal(calls, expected);
}

// @lat: [[tests#Analysis behavior#Literal argument shapes skip impossible pattern defaults]]
describe("literal parameter pattern defaults", () => {
  it("keeps a record trusted when a supplied object property skips its default", () => {
    bulkFindings(
      'var records = new GlideRecord("task"); function use({value = [records]}) {} use({value: true}); records.deleteMultiple();',
      1,
    );
  });
  for (const [name, argument, expected] of [
    ["false", "{value: false}", 1],
    ["zero", "{value: 0}", 1],
    ["null", "{value: null}", 1],
    ["undefined", "{value: undefined}", 0],
    ["missing", "{}", 0],
    ["unknown property", "{value: external}", 0],
    ["unknown spread", "{value: true, ...external}", 0],
    ["known trailing property", "{...external, value: true}", 1],
    ["unknown computed property", "{value: true, [external]: 0}", 0],
    ["method value", "{value() {}}", 1],
    ["getter value", "{get value() { return true; }}", 0],
  ] as const) {
    it(`selects the ${name} object property default conservatively`, () => {
      bulkFindings(
        `var records = new GlideRecord("task"); function use({value = [records]}) {} use(${argument}); records.deleteMultiple();`,
        expected,
      );
    });
  }
  for (const [name, argument, expected] of [
    ["true", "[true]", 1],
    ["false", "[false]", 1],
    ["zero", "[0]", 1],
    ["null", "[null]", 1],
    ["undefined", "[undefined]", 0],
    ["hole", "[,]", 0],
    ["missing", "[]", 0],
    ["unknown element", "[external]", 0],
    ["unknown spread", "[...external]", 0],
    ["known prefix before spread", "[true, ...external]", 1],
  ] as const) {
    it(`selects the ${name} array element default conservatively`, () => {
      bulkFindings(
        `var records = new GlideRecord("task"); function use([value = [records]]) {} use(${argument}); records.deleteMultiple();`,
        expected,
      );
    });
  }
  for (const [name, parameter, argument, expected] of [
    ["nested object", "{nested: {value = [records]}}", "{nested: {value: true}}", 1],
    ["nested array", "[[value = [records]]]", "[[false]]", 1],
    ["object inside array", "[{value = [records]}, ...rest]", "[{value: 0}]", 1],
    ["array inside object", "{nested: [value = [records]], ...rest}", "{nested: [null]}", 1],
    ["nested literal default", "{nested: {value = [records]} = {value: true}}", "{}", 1],
    ["top-level literal default", "{value = [records]} = {value: true}", "", 1],
    ["unknown tail after array spread", "[first, second = [records]]", "[true, ...external]", 0],
  ] as const) {
    it(`preserves ${name} eligibility`, () => {
      bulkFindings(
        `var records = new GlideRecord("task"); function use(${parameter}) {} use(${argument}); records.deleteMultiple();`,
        expected,
      );
    });
  }
  it("saves a literal shape before a later argument replaces a capture binding", () => {
    bulkFindings(
      'var records = new GlideRecord("task"); function use({value = [records]}, replaced) {} use({value: true}, records = new GlideRecord("incident")); records.deleteMultiple();',
      1,
    );
  });
  it("keeps property identifiers uncertain after later argument replacements", () => {
    bulkFindings(
      'var records = new GlideRecord("task"); var value = external; function use({value = [records]}, replaced) {} use({value}, value = true); records.deleteMultiple();',
      0,
    );
  });
  it("runs a default for an accessor with only a setter", () => {
    const { messages, analysis } = lintWithAnalysis(
      'var records = new GlideRecord("task"); function use({value = records.query()}) {} use({set value(input) {}}); records.next();',
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.deepEqual(messages, []);
  });
  for (const [name, property, expected] of [
    ["undefined", "value: void 0", 0],
    ["missing", "other: true", 0],
    ["getter then setter", "get value() { return true; }, set value(input) {}", 1],
    ["setter then getter", "set value(input) {}, get value() { return true; }", 1],
    ["computed getter then setter", "get [external]() { return true; }, set value(input) {}", 1],
  ] as const) {
    it(`retains the correct query default boundary for ${name}`, () => {
      const { messages, analysis } = lintWithAnalysis(
        `var records = new GlideRecord("task"); function use({value = records.query()}) {} use({${property}}); records.next();`,
        "require-query-before-next",
      );
      assert.equal(analysis.pathBudgetExhausted, false);
      assert.equal(messages.length, expected);
    });
  }
  for (const [name, argument, expected] of [
    ["supplied", "{value: true}", 1],
    ["missing", "{}", 0],
    ["unknown", "{value: external}", 1],
  ] as const) {
    it(`preserves synchronous throwing defaults for ${name} properties`, () => {
      bulkFindings(
        `var records = new GlideRecord("task"); function fail() { throw 0; } function use({value = fail()}) {} use(${argument}); records.deleteMultiple();`,
        expected,
      );
    });
  }
  it("skips nested default effects after a computed pattern key throws", () => {
    bulkFindings(
      'var records = new GlideRecord("task"); function fail() { throw 0; } function use({[fail()]: value = [records]}) {} try { use({value: true}); } catch (error) {} records.deleteMultiple();',
      1,
    );
  });
  for (const name of ["constructor", "toString"]) {
    it(`keeps a possible inherited ${name} value from forcing a throwing default`, () => {
      bulkFindings(
        `var records = new GlideRecord("task"); function fail() { throw 0; } function use({${name} = fail()}) {} use({}); records.deleteMultiple();`,
        1,
      );
    });
    for (const [value, expected] of [
      ["true", 1],
      ["null", 1],
      ["undefined", 0],
    ] as const) {
      it(`uses the own ${name} property with ${value} before the inherited fallback`, () => {
        bulkFindings(
          `var records = new GlideRecord("task"); function fail() { throw 0; } function use({${name} = fail()}) {} use({${name}: ${value}}); records.deleteMultiple();`,
          expected,
        );
      });
    }
  }
  it("retains literal eligibility through unrelated argument correlations", () => {
    bulkFindings(
      'var records = new GlideRecord("task"); var selector = false; function use({value = [records]}) {} use({value: true, other: (selector ||= external)}); records.deleteMultiple();',
      1,
    );
  });
  it("retains every normal argument alternative when literal defaults differ", () => {
    bulkFindings(
      'var records = new GlideRecord("task"); var selector = false; function use({value = [records]}) {} use(selector ||= (external ? {value: true} : {})); records.deleteMultiple();',
      0,
    );
  });
  it("keeps literal shape depth within the existing AST traversal limit", () => {
    const nested = "[".repeat(100) + "true" + "]".repeat(100);
    bulkFindings(
      `var records = new GlideRecord("task"); function use([value = [records]]) {} use(${nested}); records.deleteMultiple();`,
      1,
    );
  });
  const repeatedCalls = (count: number): string =>
    'var records = new GlideRecord("task"); function use({value = [records]}) {} ' +
    "use({value: true});".repeat(count) +
    "records.deleteMultiple();";
  for (const [name, setup, invocation, expected] of [
    [
      "prototype iterator replacement",
      "Array.prototype[Symbol.iterator] = function* () { yield void 0; };",
      "use([true]);",
      1,
    ],
    [
      "later argument iterator replacement",
      "",
      "use([true], Array.prototype[Symbol.iterator] = function* () { yield void 0; });",
      1,
    ],
    [
      "prototype alias",
      "var proto = Array.prototype; proto[Symbol.iterator] = function* () { yield void 0; };",
      "use([true]);",
      1,
    ],
    [
      "defineProperty",
      "Object.defineProperty(Array.prototype, Symbol.iterator, {value: function* () { yield void 0; }});",
      "use([true]);",
      1,
    ],
    // Computed writes through an unknown receiver lose method authority even for unconditional calls.
    [
      "getPrototypeOf",
      "Object.getPrototypeOf([])[Symbol.iterator] = function* () { yield void 0; };",
      "use([true]);",
      0,
    ],
    [
      "iterator symbol alias",
      "var key = Symbol.iterator; Object.getPrototypeOf([])[key] = function* () { yield void 0; };",
      "use([true]);",
      0,
    ],
    ["prototype exposure", "external(Array.prototype);", "use([true]);", 1],
    [
      "constructor and symbol aliases",
      "var A = Array; var S = Symbol; A.prototype[S.iterator] = function* () { yield void 0; };",
      "use([true]);",
      1,
    ],
    ["constructor exposure", "external(Array);", "use([true]);", 1],
    [
      "aliased constructor prototype exposure",
      "var A = Array; external(A.prototype);",
      "use([true]);",
      1,
    ],
    ["unknown constructor member", "external(Array[external]);", "use([true]);", 1],
    ["symbol exposure", "external(Symbol);", "use([true]);", 1],
    // Qualified namespace writes/exposure also suppress unconditional platform diagnostics.
    [
      "qualified prototype replacement",
      "globalThis.Array.prototype[globalThis.Symbol.iterator] = function* () { yield void 0; };",
      "use([true]);",
      0,
    ],
    ["qualified constructor exposure", "external(globalThis.Array);", "use([true]);", 0],
    [
      "const namespace mutation",
      "const G = globalThis; G.Array.prototype[G.Symbol.iterator] = function* () { yield void 0; };",
      "use([true]);",
      0,
    ],
    [
      "var namespace mutation",
      "var G = globalThis; G.Array.prototype[G.Symbol.iterator] = function* () { yield void 0; };",
      "use([true]);",
      0,
    ],
    ["namespace exposure", "external(globalThis);", "use([true]);", 0],
    ["unknown namespace member", "external(globalThis[external]);", "use([true]);", 1],
    ["ordinary Array builtin", "Array.isArray([]);", "use([true]);", 0],
    ["qualified safe Array builtin", "globalThis.Array.isArray([]);", "use([true]);", 0],
    ["parenthesized safe Array builtin", "(Array).isArray([]);", "use([true]);", 0],
    ["nested safe Array builtin", "((Array)).isArray([]);", "use([true]);", 0],
    [
      "parenthesized qualified safe Array builtin",
      "(globalThis.Array).isArray([]);",
      "use([true]);",
      0,
    ],
    [
      "shadowed Array and Symbol",
      "var Array = {prototype: {}}; var Symbol = {iterator: 0}; external(Array.prototype, Symbol.iterator);",
      "use([true]);",
      0,
    ],
  ] as const) {
    it(`retains the array default boundary for ${name}`, () => {
      const code = `var run = false; ${setup} function use([value = (run = true)], replaced) {} ${invocation} run &&= new GlideRecord("task").deleteMultiple();`;
      bulkFindings(code, expected);
      if (
        name.includes("namespace") ||
        [
          "getPrototypeOf",
          "iterator symbol alias",
          "qualified prototype replacement",
          "qualified constructor exposure",
        ].includes(name)
      )
        reachableBulkCalls(code, 1);
    });
  }
  for (const [name, setup, argument, expected] of [
    ["object prototype mutation", "Object.prototype.value = true;", "{}", 1],
    ["object prototype exposure", "external(Object.prototype);", "{}", 1],
    ["object constructor alias", "var O = Object; O.prototype.value = true;", "{}", 1],
    ["object constructor exposure", "external(Object);", "{}", 1],
    ["qualified object prototype", "globalThis.Object.prototype.value = true;", "{}", 1],
    [
      "const object namespace mutation",
      "const G = globalThis; G.Object.prototype.value = true;",
      "{}",
      1,
    ],
    [
      "var object namespace mutation",
      "var G = globalThis; G.Object.prototype.value = true;",
      "{}",
      1,
    ],
    ["unknown object constructor member", "external(Object[external]);", "{}", 1],
    ["explicit own supplied value", "external(Object.prototype);", "{value: true}", 1],
    ["explicit own undefined value", "external(Object.prototype);", "{value: undefined}", 0],
    ["ordinary Object builtin", "Object.keys({});", "{}", 0],
    ["parenthesized safe Object builtin", "(Object).keys({});", "{}", 0],
    ["shadowed Object", "var Object = {prototype: {}}; external(Object.prototype);", "{}", 0],
    [
      "shadowed globalThis",
      "var globalThis = {Object: {prototype: {}}}; external(globalThis.Object.prototype);",
      "{}",
      0,
    ],
  ] as const) {
    it(`retains the object default boundary for ${name}`, () => {
      const code = `var records = new GlideRecord("task"); ${setup} function fail() { throw 0; } function use({value = fail()}) {} use(${argument}); records.deleteMultiple();`;
      bulkFindings(code, expected);
      if (name.includes("namespace")) reachableBulkCalls(code, 1);
    });
  }
  it("keeps five hundred literal pattern calls complete with the security finding", () => {
    bulkFindings(repeatedCalls(500), 1);
  });
  it("stays sub-quadratic when literal pattern calls quadruple", () => {
    assertSubQuadratic({
      label: "literal pattern defaults",
      smallLabel: "125 calls",
      largeLabel: "500 calls",
      small: () => bulkFindings(repeatedCalls(125), 1),
      large: () => bulkFindings(repeatedCalls(500), 1),
    });
  });
});
