import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import { lintWithAnalysis } from "../helpers/rule-tester.js";
import { applyRules } from "../helpers/apply-rules.js";
import type { FileAnalysis } from "../../src/analysis/file-analysis.js";
import { analyzePathBindings } from "../../src/analysis/path-state.js";
import { isNode } from "../../src/utils/ast.js";

function findings(code: string, expected: number): void {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  assert.equal(messages.length, expected);
}

function queryEvents(code: string, filename: string): number {
  const parsed = parseSync(filename, code, {
    sourceType: "script",
    lang: filename.endsWith(".ts") ? "ts" : "js",
  });
  assert.deepEqual(parsed.errors, []);
  assert.ok(isNode(parsed.program));
  let analysis: FileAnalysis | undefined;
  applyRules(
    code,
    { ast: parsed.program },
    {
      filename,
      ruleNames: ["no-unfiltered-gliderecord-bulk-operation"],
      onFileAnalysis: (value) => {
        analysis = value;
      },
    },
  );
  assert.ok(analysis);
  assert.equal(analysis.pathBudgetExhausted, false);
  let queries = 0;
  const result = analyzePathBindings({
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
    },
  });
  assert.equal(result.outcome, "complete");
  return queries;
}

const baseField = 'base = new GlideRecord("base").deleteMultiple();';
const ownField = 'own = new GlideRecord("derived").deleteMultiple();';
const childField = 'child = new GlideRecord("child").deleteMultiple();';

// @lat: [[tests#Analysis behavior#Returned super completes field initialization]]
describe("returned super constructor prefix", () => {
  it("reports the exact returned-super derived field", () => {
    findings(
      `class Base {} class Derived extends Base { constructor() { return super(); } ${ownField} } new Derived();`,
      1,
    );
  });
  for (const [name, constructor] of [
    ["bare call", "constructor() { return super(); }"],
    ["ordinary parameter", "constructor(value) { return super(); }"],
    ["harmless prefix", 'constructor() { ; "harmless"; return super(); }'],
    ["parentheses", "constructor() { return (((super(0)))); }"],
    ["literal arguments", 'constructor() { return super(0, false, null, "safe"); }'],
    [
      "creation arguments",
      "constructor() { return super({}, [], function(value = fail()) { fail(); }, class { method() {} }); }",
    ],
    ["unreachable throw", "constructor() { return super(); throw 0; }"],
    ["unreachable second super", "constructor() { return super(); super(); }"],
  ] as const) {
    it(`continues base, own and descendant fields after a ${name}`, () => {
      findings(
        `function fail() { throw 0; } class Base { ${baseField} } class Parent extends Base { ${constructor} ${ownField} } class Child extends Parent { ${childField} } new Child(false);`,
        3,
      );
    });
  }
  it("keeps a false capture during fields before unreachable post-return code", () => {
    findings(
      `var run = false; class Base {} class Derived extends Base { constructor() { return super(); run = true; } skipped = run &&= new GlideRecord("skipped").deleteMultiple(); ${ownField} } new Derived();`,
      1,
    );
  });
  it("keeps completed fields before a reachable second super opaque to descendants", () => {
    findings(
      `class Base { ${baseField} } class Parent extends Base { constructor() { super(); return super(); } ${ownField} } class Child extends Parent { ${childField} } new Child();`,
      2,
    );
  });
  it("retains a returned-super constructor when an outer argument replaces it", () => {
    findings(
      `class Base { ${baseField} } var Parent = class extends Base { constructor() { return super(); } ${ownField} }; new Parent(Parent = class { constructor() { throw 0; } });`,
      2,
    );
  });
  it("uses the frozen returned-super base instead of a replacement", () => {
    findings(
      `class Base { ${baseField} } var Parent = class extends Base { constructor() { return super(); } ${ownField} }; class Child extends Parent { ${childField} } Parent = class { constructor() { throw 0; } }; new Child();`,
      3,
    );
  });
  it("keeps normal returned-super and opaque base alternatives separate", () => {
    findings(
      `class Base {} class Safe extends Base { constructor() { return super(); } } class Opaque extends Base { constructor() { throw 0; } } class Child extends (external ? Safe : Opaque) { ${childField} } new Child();`,
      1,
    );
  });
  it("does not replay own or descendant fields after an abrupt base initializer", () => {
    findings(
      `function fail() { throw 0; } class Base { ${baseField} stop = fail(); } class Parent extends Base { constructor() { return super(); } ${ownField} } class Child extends Parent { ${childField} } new Child();`,
      1,
    );
  });
  it("accepts transparent TypeScript return wrappers under direct traversal", () => {
    assert.equal(
      queryEvents(
        'class Base {} class Derived extends Base { constructor() { return ((super(0) as object)!); } field = new GlideRecord("task").query(); } new Derived();',
        "server.ts",
      ),
      1,
    );
  });
  it("keeps direct harmless returned super safe inside with", () => {
    assert.equal(
      queryEvents(
        'with ({ value: 0 }) { class Base {} class Derived extends Base { constructor() { return super(0); } field = new GlideRecord("task").query(); } new Derived(); }',
        "with.js",
      ),
      1,
    );
  });
  for (const constructor of [
    "constructor() { return {}; }",
    "constructor() { return 0; }",
    "constructor() { return; }",
    "constructor(value = fail()) { return super(); }",
    "constructor({value}) { return super(); }",
    "constructor() { throw 0; return super(); }",
    "constructor() { external(); return super(); }",
    "constructor() { return super(fail()); }",
    "constructor() { return super(value); let value = 0; }",
    "constructor() { return super(...[]); }",
    "constructor() { return (super(), {}); }",
    "constructor() { return external ? super() : {}; }",
  ]) {
    it(`retains the unproven derived prefix for ${constructor}`, () => {
      findings(
        `function fail() { throw 0; } class Base { ${baseField} } class Derived extends Base { ${constructor} ${ownField} } new Derived();`,
        0,
      );
    });
  }
  it("does not prove a returned-super argument intercepted by with", () => {
    assert.equal(
      queryEvents(
        'var value = 0; with ({ value: 0 }) { class Base {} class Derived extends Base { constructor() { return super(value); } field = new GlideRecord("task").query(); } new Derived(); }',
        "with.js",
      ),
      0,
    );
  });
  for (const count of [129, 1024]) {
    it(`completes a ${count}-level returned-super hierarchy`, () => {
      const chain = Array.from(
        { length: count },
        (_, index) =>
          `class Child${index} extends ${index ? `Child${index - 1}` : "Base"} { constructor() { return super(0); } ${ownField} }`,
      ).join("\n");
      findings(`class Base { ${baseField} } ${chain} new Child${count - 1}();`, count + 1);
    });
  }
});

// @lat: [[tests#Analysis behavior#Plain rest constructor parameters preserve field replay]]
describe("plain rest constructor parameters", () => {
  for (const [name, constructor] of [
    ["plain rest", "constructor(...values) { super(); }"],
    ["ordinary and rest", "constructor(value, ...values) { super(0); }"],
    ["standalone safe arguments", "constructor(...values) { super(0); }"],
    ["returned super", "constructor(...values) { return super(0); }"],
    ["harmless prefix", 'constructor(...values) { ; "harmless"; return super(); }'],
  ] as const) {
    it(`replays all known fields after ${name} parameter binding`, () => {
      findings(
        `class Base { ${baseField} } class Parent extends Base { ${constructor} ${ownField} } class Child extends Parent { ${childField} } new Child(0, false, null);`,
        3,
      );
    });
  }
  for (const constructor of [
    "constructor(...values) {}",
    "constructor(first, ...values) { return {}; }",
  ]) {
    it(`continues through a safe base ${constructor}`, () => {
      findings(
        `class Base { ${constructor} ${baseField} } class Derived extends Base { ${ownField} } new Derived(0, false);`,
        2,
      );
    });
  }
  it("retains the post-super capture boundary and stops grandchildren", () => {
    findings(
      `class Base { ${baseField} } class Parent extends Base { constructor(...values) { super(); throw 0; } ${ownField} } class Child extends Parent { ${childField} } new Child();`,
      2,
    );
  });
  it("keeps earlier arguments and rest parameters selected without evaluating a rest body", () => {
    findings(
      `var run = false; class Base {} class Derived extends Base { constructor(...values) { return super(); run = true; } skipped = run &&= new GlideRecord("skipped").deleteMultiple(); ${ownField} } new Derived(run = false, 0);`,
      1,
    );
  });
  for (const constructor of [
    "constructor(value = fail(), ...values) { super(); }",
    "constructor({value}, ...values) { super(); }",
    "constructor(...[value = fail()]) { super(); }",
    "constructor(...{length: value}) { super(); }",
    "constructor(...values) { super(...values); }",
    "constructor(...values) { return super(...values); }",
    "constructor(...values) { external(); super(); }",
    "constructor(...values) { return {}; }",
  ]) {
    it(`retains opaque binding or prefix semantics for ${constructor}`, () => {
      findings(
        `function fail() { throw 0; } class Base { ${baseField} } class Derived extends Base { ${constructor} ${ownField} } new Derived();`,
        0,
      );
    });
  }
  it("skips construction when an outer argument throws before rest binding", () => {
    findings(
      `function fail() { throw 0; } class Base { ${baseField} } class Derived extends Base { constructor(...values) { return super(); } ${ownField} } new Derived(fail());`,
      0,
    );
  });
});
