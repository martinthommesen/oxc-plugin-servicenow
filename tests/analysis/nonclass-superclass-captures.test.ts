import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";
import type { RuleName } from "../../src/rules/index.js";

function findings(
  code: string,
  expected: number,
  rule: RuleName = "no-unfiltered-gliderecord-bulk-operation",
): void {
  const { messages, analysis } = lintWithAnalysis(code, rule);
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.equal(messages.length, expected);
}

const selectedField = 'field = run &&= new GlideRecord("task").deleteMultiple();';

// @lat: [[tests#Analysis behavior#Opaque superclass captures precede derived fields]]
describe("non-class superclass capture boundaries", () => {
  it("retains a field operation reachable after an ordinary superclass writes its selector", () => {
    findings(
      `var run = false; function Base() { run = true; } class Derived extends Base { ${selectedField} } new Derived();`,
      1,
    );
  });
  it("uses the ordinary superclass saved before its binding is replaced", () => {
    findings(
      `var run = false; function Base() { run = true; } class Derived extends Base { ${selectedField} } Base = function() {}; new Derived();`,
      1,
    );
  });
  it("includes superclass parameter-default effects before derived fields", () => {
    findings(
      `var run = false; function Base(value = (run = true)) {} class Derived extends Base { ${selectedField} } new Derived();`,
      1,
    );
  });
  it("preserves the represented function alternative beside a known class base", () => {
    findings(
      `var run = false; function Base() { run = true; } class Other {} class Derived extends (external ? Base : Other) { ${selectedField} } new Derived();`,
      1,
    );
  });
  it("invalidates captured selectors after constructor arguments complete", () => {
    findings(
      `var run = true; function Base() { run = true; } class Derived extends Base { ${selectedField} } new Derived(run = false);`,
      1,
    );
  });
  it("retains possible own-field execution through an unknown superclass", () => {
    findings(
      `var run = false; class Derived extends unknownBase { ${selectedField} } new Derived();`,
      1,
    );
  });
  it("covers descendant captures above an unknown superclass boundary", () => {
    findings(
      `var run = false; class Base extends unknownBase {} class Derived extends Base { ${selectedField} } new Derived();`,
      1,
    );
  });
  it("keeps a saved unknown heritage graph when its class binding is replaced", () => {
    findings(
      `var run = false; class Base extends unknownBase {} class Derived extends Base { ${selectedField} } Base = class {}; new Derived();`,
      1,
    );
  });
  it("keeps an unknown base path alongside a precise known base path", () => {
    findings(
      `var run = false; class Base {} class Derived extends (external ? unknownBase : Base) { ${selectedField} } new Derived();`,
      1,
    );
  });
  it("drops stale record lifecycle certainty before an ordinary superclass's derived fields", () => {
    findings(
      'var records = new GlideRecord("task"); function Base() { records.query(); } class Derived extends Base { field = records.next(); } new Derived();',
      0,
      "require-query-before-next",
    );
  });
  it("retains possible superclass throws before a derived field replaces its selector", () => {
    findings(
      'var run = false; function Base() { run = true; throw 0; } class Derived extends Base { field = (run = false); } try { new Derived(); } catch {} run &&= new GlideRecord("task").deleteMultiple();',
      1,
    );
  });
  it("keeps a base class without heritage precise", () => {
    findings(`var run = false; class Base { ${selectedField} } new Base();`, 0);
  });
  for (const [kind, declaration] of [
    ["arrow", "var Base = () => { run = true; };"],
    ["async", "async function Base() { run = true; }"],
    ["generator", "function* Base() { run = true; }"],
  ] as const) {
    it(`preserves prior selector certainty for a known nonconstructible ${kind} base`, () => {
      findings(
        `var run = false; ${declaration} class Derived extends Base { ${selectedField} } new Derived();`,
        0,
      );
    });
  }
  it("keeps an empty ordinary superclass's unrelated selector precise", () => {
    findings(
      `var run = false; function Base() {} class Derived extends Base { ${selectedField} } new Derived();`,
      0,
    );
  });
  it("invalidates only a represented ordinary superclass's own captures", () => {
    findings(
      'var run = false; var quiet = false; function Base() { run = true; } class Derived extends Base { field = quiet &&= new GlideRecord("task").deleteMultiple(); } new Derived();',
      0,
    );
  });
  it("keeps a trivial known class superclass precise", () => {
    findings(
      `var run = false; class Base {} class Derived extends Base { ${selectedField} } new Derived();`,
      0,
    );
  });
  it("does not expose superclass captures for an unconstructed class", () => {
    findings(
      `var run = false; function Base() { run = true; } class Derived extends Base { ${selectedField} } run &&= new GlideRecord("task").deleteMultiple();`,
      0,
    );
  });
  it("skips the superclass capture boundary after an abrupt argument", () => {
    findings(
      `var run = false; function Base() { run = true; } function fail() { throw 0; } class Derived extends Base { ${selectedField} } try { new Derived(fail()); } catch {} run &&= new GlideRecord("task").deleteMultiple();`,
      0,
    );
  });
  it("does not invent isolated body replay after a prior precise superclass invocation", () => {
    findings(
      'function Base(run) { run &&= new GlideRecord("base").deleteMultiple(); } Base(false); class Derived extends Base { field = new GlideRecord("task").deleteMultiple(); } new Derived(false);',
      1,
    );
  });
  it("retains a fresh field record beside an uncertain captured record", () => {
    findings(
      'var records = new GlideRecord("task"); function Base() { records.query(); } class Derived extends Base { field = new GlideRecord("task").deleteMultiple(); } new Derived();',
      1,
    );
  });
  it("preserves the existing possible direct field policy for unknown heritage", () => {
    findings(
      'class Derived extends unknownBase { field = new GlideRecord("task").deleteMultiple(); } new Derived();',
      1,
    );
  });
  it("retains descendant selectors through a long unknown heritage graph within budget", () => {
    const classes = ["class C0 extends unknownBase {}"];
    for (let index = 1; index <= 129; index += 1)
      classes.push(`class C${index} extends C${index - 1} {}`);
    findings(
      `var run = false; ${classes.join("\n")} class Derived extends C129 { ${selectedField} } new Derived();`,
      1,
    );
  });
});
