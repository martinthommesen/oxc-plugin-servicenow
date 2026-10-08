import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import { lintWithAnalysis } from "../helpers/rule-tester.js";
import { applyRules } from "../helpers/apply-rules.js";
import type { FileAnalysis } from "../../src/analysis/file-analysis.js";
import { analyzePathBindings } from "../../src/analysis/path-state.js";
import { isNode } from "../../src/utils/ast.js";

function findings(code: string, expected: number, filename = "server.js"): void {
  const { messages, analysis } = lintWithAnalysis(
    code,
    "no-unfiltered-gliderecord-bulk-operation",
    { filename },
  );
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  assert.equal(messages.length, expected);
}

function fieldQueries(code: string, filename = "with.js"): number {
  const parsed = parseSync(filename, code, {
    sourceType: "script",
    lang: filename.endsWith(".ts") ? "ts" : "js",
  });
  assert.deepEqual(parsed.errors, []);
  assert.ok(isNode(parsed.program));
  let analysis: FileAnalysis | undefined;
  const messages = applyRules(
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
  assert.equal(messages.length, 0);
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
const derivedField = 'derived = new GlideRecord("derived").deleteMultiple();';

// @lat: [[tests#Analysis behavior#Safe super arguments preserve field initialization]]
describe("safe super argument field replay", () => {
  for (const [name, argument] of [
    ["zero", "0"],
    ["false", "false"],
    ["true", "true"],
    ["null", "null"],
    ["string", '"safe"'],
    ["bigint", "0n"],
    ["wrapped primitive", "(((0)))"],
    ["empty object", "{}"],
    ["empty array", "[]"],
    ["empty function", "function() {}"],
    ["empty generator function", "function*() {}"],
    ["empty arrow function", "() => {}"],
    ["wrapped creation", "(({}))"],
  ] as const) {
    it(`replays the derived field after super receives a safe ${name}`, () => {
      findings(
        `class Base {} class Derived extends Base { constructor() { super(${argument}); } ${derivedField} } new Derived();`,
        1,
      );
    });
  }
  it("keeps base-before-derived order with multiple safe arguments", () => {
    findings(
      `class Base { ${baseField} constructor(first, second) {} } class Derived extends Base { constructor() { super(0, {}, [], function() {}); } ${derivedField} } new Derived();`,
      2,
    );
  });
  it("keeps ordinary parameters and harmless prefix statements replayable", () => {
    findings(
      `class Base { ${baseField} } class Derived extends Base { constructor(value) { ; "safe"; super(0); ; } ${derivedField} } new Derived(false);`,
      2,
    );
  });
  it("accepts TypeScript transparent wrappers without reading asserted values", () => {
    assert.equal(
      fieldQueries(
        'class Base {} class Derived extends Base { constructor() { super(((0 as number)!)); } field = new GlideRecord("task").query(); } new Derived();',
        "server.ts",
      ),
      1,
    );
  });
  it("does not execute defaults on a function created as a super argument", () => {
    findings(
      `var run = false; class Base {} class Derived extends Base { constructor() { super(function(value = (run = true)) {}); } field = run &&= new GlideRecord("skipped").deleteMultiple(); ${derivedField} } new Derived();`,
      1,
    );
  });
  it("replays base and own fields before opaque post-super code", () => {
    findings(
      `class Base { ${baseField} } class Parent extends Base { constructor() { super(0); throw 0; } ${derivedField} } class Grandchild extends Parent { field = new GlideRecord("grandchild").deleteMultiple(); } new Grandchild();`,
      2,
    );
  });
  it("invalidates captures only after fields precede opaque post-super writes", () => {
    findings(
      'var run = false; class Base {} class Derived extends Base { constructor() { super(0); run = true; } field = run &&= new GlideRecord("skipped").deleteMultiple(); } new Derived(); run &&= new GlideRecord("later").deleteMultiple();',
      1,
    );
  });
  it("skips later fields and post-super capture invalidation after an abrupt initializer", () => {
    findings(
      `var run = false; function fail() { throw 0; } class Base { ${baseField} } class Derived extends Base { constructor() { super(0); run = true; } stop = fail(); ${derivedField} } try { new Derived(); } catch {} run &&= new GlideRecord("skipped").deleteMultiple();`,
      1,
    );
  });
  it("retains the selected constructor while outer arguments replace its binding", () => {
    findings(
      `class Base { ${baseField} } var Derived = class extends Base { constructor() { super(0); } ${derivedField} }; new Derived(Derived = class {});`,
      2,
    );
  });
  it("retains the frozen safe superclass after its binding is replaced", () => {
    findings(
      `class Base {} var Parent = class extends Base { constructor() { super(0); } ${baseField} }; class Derived extends Parent { ${derivedField} } Parent = class { constructor() { throw 0; } }; new Derived();`,
      2,
    );
  });
  it("does not replace an opaque selected superclass with a later safe one", () => {
    findings(
      `function fail() { throw 0; } class Base {} var Parent = class extends Base { constructor() { super(fail()); } ${baseField} }; class Derived extends Parent { ${derivedField} } Parent = class extends Base { constructor() { super(0); } }; new Derived();`,
      0,
    );
  });
  it("keeps normal and opaque selected superclass alternatives separate", () => {
    findings(
      `class Base {} class Safe extends Base { constructor() { super(0); } } class Opaque extends Base { constructor() { throw 0; } } class Derived extends (external ? Safe : Opaque) { ${derivedField} } new Derived();`,
      1,
    );
  });
  for (const [name, argument] of [
    ["throwing call", "fail()"],
    ["unknown lookup", "unknown"],
    ["TDZ lookup", "value"],
    ["member lookup", "external.value"],
    ["spread", "...[]"],
    ["computed object key", "{ [fail()]: 0 }"],
    ["array call", "[fail()]"],
    ["assignment", "(run = true)"],
    ["void call", "void fail()"],
  ] as const) {
    it(`keeps a ${name} argument outside the safe forwarding proof`, () => {
      findings(
        `var run = false; function fail() { throw 0; } class Base { ${baseField} } class Derived extends Base { constructor() { super(${argument}); let value = 0; } ${derivedField} } new Derived();`,
        0,
      );
    });
  }
  for (const constructor of [
    "constructor(value = 0) { super(0); }",
    "constructor({value}) { super(0); }",
    "constructor() { throw 0; super(0); }",
    "constructor() { external(); super(0); }",
    "constructor() { return {}; super(0); }",
  ]) {
    it(`preserves the earlier opaque boundary for ${constructor}`, () => {
      findings(
        `class Base { ${baseField} } class Derived extends Base { ${constructor} ${derivedField} } new Derived(null);`,
        0,
      );
    });
  }
  it("replays safe super arguments after plain rest parameter allocation", () => {
    findings(
      `class Base { ${baseField} } class Derived extends Base { constructor(...values) { super(0); } ${derivedField} } new Derived();`,
      2,
    );
  });
  it("does not use safe super arguments to interpret opaque base defaults", () => {
    findings(
      `class Base { ${baseField} constructor(value = fail()) {} } class Derived extends Base { constructor() { super(0); } ${derivedField} } function fail() { throw 0; } new Derived();`,
      1,
    );
  });
  it("does not turn a second super call into another field initialization", () => {
    findings(
      `class Base { ${baseField} } class Parent extends Base { constructor() { super(0); super(0); } ${derivedField} } class Derived extends Parent { field = new GlideRecord("skipped").deleteMultiple(); } new Derived();`,
      2,
    );
  });
  it("keeps literal arguments safe inside a dynamic enclosing scope", () => {
    assert.equal(
      fieldQueries(
        'with ({ value: 0 }) { class Base {} class Derived extends Base { constructor() { super(0); } field = new GlideRecord("task").query(); } new Derived(); }',
      ),
      1,
    );
  });
  it("does not prove a dynamically intercepted argument lookup", () => {
    assert.equal(
      fieldQueries(
        'var value = 0; with ({ value: 0 }) { class Base {} class Derived extends Base { constructor() { super(value); } field = new GlideRecord("task").query(); } new Derived(); }',
      ),
      0,
    );
  });
  for (const count of [129, 1024]) {
    it(`completes a ${count}-level safe argument forwarding chain`, () => {
      const chain = Array.from(
        { length: count },
        (_, index) =>
          `class Derived${index} extends ${index ? `Derived${index - 1}` : "Base"} { constructor() { super(0); } ${derivedField} }`,
      ).join(" ");
      findings(`class Base { ${baseField} } ${chain} new Derived${count - 1}();`, count + 1);
    });
  }
  it("charges and completes fifteen hundred safe super arguments", () => {
    findings(
      `class Base {} class Derived extends Base { constructor() { super(${Array.from({ length: 1500 }, () => "0").join(",")}); } ${derivedField} } new Derived();`,
      1,
    );
  });
});
