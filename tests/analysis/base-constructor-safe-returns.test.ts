import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function findings(code: string, expected: number): void {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  assert.equal(messages.length, expected);
}

const baseField = 'base = new GlideRecord("base").deleteMultiple();';
const derivedField = 'derived = new GlideRecord("derived").deleteMultiple();';

// @lat: [[tests#Analysis behavior#Safe base constructor returns continue field replay]]
describe("safe base constructor returns", () => {
  for (const [name, statement] of [
    ["empty object", "return {};"],
    ["empty array", "return [];"],
    ["bare undefined", "return;"],
    ["null primitive", "return null;"],
    ["false primitive", "return false;"],
    ["zero primitive", "return 0;"],
    ["empty string primitive", 'return "";'],
    ["empty function", "return function() {};"],
    ["empty generator function", "return function*() {};"],
    ["empty arrow function", "return () => {};"],
    ["parenthesized object", "return (({}));"],
  ] as const) {
    it(`continues derived fields after a guaranteed ${name} return`, () => {
      findings(
        `class Base { constructor(value) { ${statement} } } class Derived extends Base { ${derivedField} } new Derived(false);`,
        1,
      );
    });
  }
  it("keeps base fields before the safe return and derived fields afterward", () => {
    findings(
      `class Base { ${baseField} constructor() { return {}; } } class Derived extends Base { ${derivedField} } new Derived();`,
      2,
    );
  });
  it("accepts a harmless prefix but does not inspect statements after the return", () => {
    findings(
      `class Base { constructor() { ; "safe"; return {}; new GlideRecord("unreachable").deleteMultiple(); } } class Derived extends Base { ${derivedField} } new Derived();`,
      1,
    );
  });
  it("does not execute a returned function body to establish constructor continuation", () => {
    findings(
      `var run = false; class Base { constructor() { return function() {}; } } class Derived extends Base { field = run &&= new GlideRecord("skipped").deleteMultiple(); ${derivedField} } new Derived();`,
      1,
    );
  });
  it("preserves the original safe constructor after an argument replaces its binding", () => {
    findings(
      `class Base { constructor() { return {}; } } class Derived extends Base { ${derivedField} } new Derived((Derived = class {}));`,
      1,
    );
  });
  it("preserves the selected safe superclass after replacement", () => {
    findings(
      `class Base { constructor() { return {}; } } class Derived extends Base { ${derivedField} } Base = class { constructor() { throw 0; } }; new Derived();`,
      1,
    );
  });
  it("does not replace a saved throwing superclass with a later safe return", () => {
    findings(
      `class Base { constructor() { throw 0; } } class Derived extends Base { ${derivedField} } Base = class { constructor() { return {}; } }; new Derived();`,
      0,
    );
  });
  it("keeps safe and definitely opaque alternatives separate", () => {
    findings(
      `class Safe { constructor() { return {}; } } class Opaque { constructor() { throw 0; } } var Base = external ? Safe : Opaque; class Derived extends Base { ${derivedField} } new Derived();`,
      1,
    );
  });
  for (const constructor of [
    "constructor() { throw 0; }",
    "constructor() { external(); return {}; }",
    "constructor(value = external()) { return {}; }",
    "constructor({value}) { return {}; }",
    "constructor() { return fail(); }",
    "constructor() { return { [fail()]: 0 }; }",
    "constructor() { return [fail()]; }",
  ]) {
    it(`retains the existing opaque boundary for ${constructor}`, () => {
      findings(
        `function fail() { throw 0; } class Base { ${baseField} ${constructor} } class Derived extends Base { ${derivedField} } new Derived();`,
        1,
      );
    });
  }
  it("continues a safe base return after plain rest parameter allocation", () => {
    findings(
      `class Base { constructor(...values) { return {}; } ${baseField} } class Derived extends Base { ${derivedField} } new Derived();`,
      2,
    );
  });
  it("does not make a safe object return before super initialize derived fields", () => {
    findings(
      `class Base { ${baseField} } class Derived extends Base { constructor() { return {}; } ${derivedField} } new Derived();`,
      0,
    );
  });
  it("continues safe super arguments through a safe base return", () => {
    findings(
      `class Base { constructor() { return {}; } ${baseField} } class Derived extends Base { constructor() { super(0); } ${derivedField} } new Derived();`,
      2,
    );
  });
  it("does not run constructor defaults to prove continuation", () => {
    findings(
      `class Base { ${baseField} constructor(value = fail()) { return {}; } } class Derived extends Base { ${derivedField} } new Derived(null); function fail() { throw 0; }`,
      1,
    );
  });
  for (const count of [129, 1024]) {
    it(`retains ordered fields through ${count} descendants after one safe base return`, () => {
      const chain = Array.from(
        { length: count },
        (_, index) =>
          `class Derived${index} extends ${index ? `Derived${index - 1}` : "Base"} { ${derivedField} }`,
      ).join(" ");
      findings(
        `class Base { ${baseField} constructor() { return {}; } } ${chain} new Derived${count - 1}();`,
        count + 1,
      );
    });
  }
});
