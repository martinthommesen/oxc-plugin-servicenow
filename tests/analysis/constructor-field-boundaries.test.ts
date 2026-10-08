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

// @lat: [[tests#Analysis behavior#Explicit constructor boundaries constrain field replay]]
describe("explicit constructor field boundaries", () => {
  for (const [name, constructor] of [
    ["throw before super", "constructor() { throw 0; }"],
    ["missing super", "constructor() {}"],
    ["object return before super", "constructor() { return {}; }"],
    ["throwing parameter default", "constructor(value = fail()) { super(); }"],
    ["destructured parameter", "constructor({value}) { super(); }"],
    ["rest parameter", "constructor(...values) { super(); }"],
  ] as const) {
    it(`keeps superclass and own fields opaque after ${name}`, () => {
      findings(
        `function fail() { throw 0; } class Base { ${baseField} } class Derived extends Base { ${constructor} ${derivedField} } new Derived();`,
        0,
      );
    });
  }
  it("does not select a derived field before an opaque derived body changes its selector", () => {
    findings(
      'var run = true; class Base {} class Derived extends Base { constructor() { run = false; super(); } field = run &&= new GlideRecord("task").deleteMultiple(); } new Derived();',
      0,
    );
  });
  for (const [name, constructor] of [
    ["body throw", "constructor() { throw 0; }"],
    ["parameter default throw", "constructor(value = fail()) {}"],
    ["object return", "constructor() { return {}; }"],
    ["destructured parameter", "constructor({value}) {}"],
    ["rest parameter", "constructor(...values) {}"],
  ] as const) {
    it(`retains base fields before an opaque ${name} but stops derived replay`, () => {
      findings(
        `function fail() { throw 0; } class Base { ${baseField} ${constructor} } class Derived extends Base { ${derivedField} } new Derived();`,
        1,
      );
    });
  }
  it("does not select a derived field before an opaque base body changes its selector", () => {
    findings(
      'var run = true; class Base { constructor() { run = false; } } class Derived extends Base { field = run &&= new GlideRecord("task").deleteMultiple(); } new Derived();',
      0,
    );
  });
  for (const [name, constructor] of [
    ["implicit", ""],
    ["empty", "constructor() {}"],
    ["ordinary parameter", "constructor(value) {}"],
    ["empty statements", "constructor() { ; ; }"],
    ["harmless directive", 'constructor() { "use strict"; }'],
  ] as const) {
    it(`continues a known chain through a trivial ${name} base constructor`, () => {
      findings(
        `class Base { ${baseField} ${constructor} } class Derived extends Base { ${derivedField} } new Derived(false);`,
        2,
      );
    });
  }
  for (const [name, constructor] of [
    ["ordinary", "constructor() { super(); }"],
    ["ordinary parameter", "constructor(value) { super(); }"],
    ["empty statements", "constructor() { ; super(); ; }"],
    ["harmless directive", 'constructor() { "use strict"; super(); }'],
  ] as const) {
    it(`continues a known chain through ${name} zero-argument super forwarding`, () => {
      findings(
        `class Base { ${baseField} constructor(value) {} } class Derived extends Base { ${constructor} ${derivedField} } new Derived(false);`,
        2,
      );
    });
  }
  it("keeps super arguments outside the trivial forwarding proof", () => {
    findings(
      `function fail() { throw 0; } class Base { ${baseField} } class Derived extends Base { constructor() { super(fail()); } ${derivedField} } new Derived();`,
      0,
    );
  });
  it("keeps nontrivial statements after super outside deterministic field replay", () => {
    findings(
      `class Base { ${baseField} } class Derived extends Base { constructor() { super(); throw 0; } ${derivedField} } new Derived();`,
      0,
    );
  });
  it("retains the existing unknown-superclass field policy for implicit construction", () => {
    findings(`class Derived extends unknownBase { ${derivedField} } new Derived();`, 1);
  });
  it("retains the existing unknown-superclass field policy for trivial forwarding", () => {
    findings(
      `class Derived extends unknownBase { constructor() { super(); } ${derivedField} } new Derived();`,
      1,
    );
  });
  it("skips base fields when constructor arguments throw first", () => {
    findings(
      `function fail() { throw 0; } class Base { ${baseField} constructor() { throw 0; } } class Derived extends Base { ${derivedField} } new Derived(fail());`,
      0,
    );
  });
  it("retains earlier base fields when an initializer throws before the opaque body", () => {
    findings(
      `function fail() { throw 0; } class Base { ${baseField} stop = fail(); constructor() { throw 0; } } class Derived extends Base { ${derivedField} } new Derived();`,
      1,
    );
  });
  it("retains a replayable base alternative alongside an opaque alternative", () => {
    findings(
      `class Opaque { constructor() { throw 0; } } class Trivial {} class Derived extends (external ? Opaque : Trivial) { ${derivedField} } new Derived();`,
      1,
    );
  });
  it("keeps scalar selections correlated with opaque and replayable base alternatives", () => {
    findings(
      'var run = false; var Base; if (external) { run = true; Base = class { constructor() { throw 0; } }; } else { Base = class {}; } class Derived extends Base { field = run &&= new GlideRecord("task").deleteMultiple(); } new Derived();',
      0,
    );
  });
  it("retains a reachable scalar operation only on the replayable base alternative", () => {
    findings(
      'var run = false; var Base; if (external) { Base = class { constructor() { throw 0; } }; } else { run = true; Base = class {}; } class Derived extends Base { field = run &&= new GlideRecord("task").deleteMultiple(); } new Derived();',
      1,
    );
  });
  it("uses only a replayable base alternative to prove an initializer-local query", () => {
    const { messages, analysis } = lintWithAnalysis(
      'var records = new GlideRecord("task"); class Opaque { constructor() { throw 0; } } class Queried { ready = records.query(); } class Derived extends (external ? Opaque : Queried) { field = records.next(); } new Derived();',
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.deepEqual(messages, []);
  });
  it("retains the saved opaque constructor when an argument replaces its binding", () => {
    findings(
      `class Base { ${baseField} } var Derived = class extends Base { constructor() { throw 0; } ${derivedField} }; new Derived(Derived = class {});`,
      0,
    );
  });
  it("retains the saved opaque superclass after the base binding changes", () => {
    findings(
      `var Base = class { ${baseField} constructor() { throw 0; } }; class Derived extends Base { ${derivedField} } Base = class {}; new Derived();`,
      1,
    );
  });
  it("retains the saved trivial superclass after an opaque replacement", () => {
    findings(
      `var Base = class { ${baseField} }; class Derived extends Base { ${derivedField} } Base = class { constructor() { throw 0; } }; new Derived();`,
      2,
    );
  });
  it("keeps ordinary outer continuation opaque instead of inventing constructor completion", () => {
    findings(
      `class Base {} class Derived extends Base { constructor() { throw 0; } ${derivedField} } new Derived(); new GlideRecord("later").deleteMultiple();`,
      1,
    );
  });
  it("forgets captured scalar certainty at an opaque base constructor boundary", () => {
    findings(
      'var run = false; class Base { constructor() { run = true; } } class Derived extends Base {} new Derived(); run &&= new GlideRecord("task").deleteMultiple();',
      1,
    );
  });
  it("keeps saved constructor capture effects after later arguments replace a record", () => {
    const { messages, analysis } = lintWithAnalysis(
      'var records = new GlideRecord("task"); var prior = records; class Base { constructor() { records.query(); } } class Derived extends Base {} new Derived((records = new GlideRecord("incident"), 0)); prior.next(); records.next();',
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(messages.length, 1);
    assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  });
  for (const count of [129, 1024]) {
    it(`keeps opaque base eligibility through ${count} derived classes without losing later findings`, () => {
      const chain = Array.from(
        { length: count },
        (_, index) =>
          `class Derived${index} extends ${index === 0 ? "Base" : `Derived${index - 1}`} { ${derivedField} }`,
      ).join(" ");
      findings(
        `class Base { ${baseField} constructor() { throw 0; } } ${chain} new Derived${count - 1}(); new GlideRecord("later").deleteMultiple();`,
        2,
      );
    });
  }
});
