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

const base =
  'function Base(run) { run &&= new GlideRecord("task").deleteMultiple(); } Base(false);';

// @lat: [[tests#Analysis behavior#Ordinary superclasses receive saved constructor arguments]]
describe("ordinary superclass argument forwarding", () => {
  for (const [name, argument, expected] of [
    ["true", "true", 1],
    ["false", "false", 0],
    ["zero", "0", 0],
    ["null", "null", 0],
    ["missing", "", 0],
  ] as const) {
    it(`forwards ${name} through an implicit derived constructor`, () => {
      findings(`${base} class Derived extends Base {} new Derived(${argument});`, expected);
    });
  }
  for (const [value, expected] of [
    ["true", 1],
    ["false", 0],
  ] as const) {
    it(`retains the saved ${value} argument before a later argument replaces its alias`, () => {
      findings(
        `${base} class Derived extends Base {} var input = ${value}; new Derived(input, input = ${value === "true" ? "false" : "true"});`,
        expected,
      );
    });
    it(`forwards the ${value} alias through multiple implicit constructors`, () => {
      findings(
        `${base} class First extends Base {} class Second extends First {} class Third extends Second {} var input = ${value}; new Third(input);`,
        expected,
      );
    });
    it(`uses explicit super(${value}) instead of the outer argument`, () => {
      findings(
        `${base} class Derived extends Base { constructor() { super(${value}); } } new Derived(${value === "true" ? "false" : "true"});`,
        expected,
      );
    });
  }
  it("retains the superclass selected before its binding is replaced", () => {
    findings(`${base} class Derived extends Base {} Base = function() {}; new Derived(true);`, 1);
  });
  it("retains the class selected before later argument evaluation replaces it", () => {
    findings(`${base} class Derived extends Base {} new Derived(true, Derived = class {});`, 1);
  });
  it("replaces outer arguments at an explicit super prefix in a deeper chain", () => {
    findings(
      `${base} class First extends Base { constructor() { super(false); } } class Second extends First {} new Second(true);`,
      0,
    );
  });
  it("uses a missing argument for an explicit zero-argument super default", () => {
    findings(
      'function Base(run = true) { run &&= new GlideRecord("task").deleteMultiple(); } Base(false); class Derived extends Base { constructor() { super(); } } new Derived(false);',
      1,
    );
  });
  it("uses a missing argument for an implicit superclass default", () => {
    findings(
      'function Base(run = true) { run &&= new GlideRecord("task").deleteMultiple(); } Base(false); class Derived extends Base {} new Derived();',
      1,
    );
  });
  it("keeps null supplied to a superclass default defined", () => {
    findings(
      'function Base(run = true) { run &&= new GlideRecord("task").deleteMultiple(); } Base(false); class Derived extends Base {} new Derived(null);',
      0,
    );
  });
  it("replays a captured record query before derived fields", () => {
    findings(
      'var records = new GlideRecord("task"); function Base() { records.query(); } class Derived extends Base { field = records.next(); } new Derived();',
      0,
      "require-query-before-next",
    );
  });
  it("retains a superclass body operation before a thrown completion", () => {
    findings(
      `${base} function Throwing(run) { Base(run); throw 0; } try { Throwing(false); } catch {} class Derived extends Throwing {} try { new Derived(true); } catch {}`,
      1,
    );
  });
  it("skips derived fields when a superclass body throws", () => {
    findings(
      'function Base() { throw 0; } class Derived extends Base { field = new GlideRecord("task").deleteMultiple(); } try { new Derived(); } catch {}',
      0,
    );
  });
  it("skips derived fields when a superclass default throws", () => {
    findings(
      'function fail() { throw 0; } function Base(value = fail()) {} Base(false); class Derived extends Base { field = new GlideRecord("task").deleteMultiple(); } try { new Derived(); } catch {}',
      0,
    );
  });
  it("does not invoke the superclass after an outer argument throws", () => {
    findings(
      `${base} function fail() { throw 0; } class Derived extends Base {} try { new Derived(true, fail()); } catch {}`,
      0,
    );
  });
  it("keeps impure super argument evaluation opaque", () => {
    findings(
      `${base} function fail() { throw 0; } class Derived extends Base { constructor() { super(fail()); } } try { new Derived(); } catch {}`,
      0,
    );
  });
  it("keeps a pre-super throwing prefix opaque", () => {
    findings(
      `${base} class Derived extends Base { constructor() { throw 0; super(true); } } try { new Derived(); } catch {}`,
      0,
    );
  });
  it("forwards safe returned-super arguments", () => {
    findings(
      `${base} class Derived extends Base { constructor() { return super(true); } } new Derived(false);`,
      1,
    );
  });
  it("retains ordinary superclass execution before opaque code after super", () => {
    findings(
      `${base} class Derived extends Base { constructor() { super(true); throw 0; } } try { new Derived(false); } catch {}`,
      1,
    );
  });
  it("keeps ordinary superclass parameter captures through rest-only forwarding", () => {
    findings(
      `${base} class Derived extends Base { constructor(...rest) { super(false); } } new Derived(true);`,
      0,
    );
  });
  it("keeps an ignored function argument's captures deferred before derived fields", () => {
    findings(
      'var run = false; function Base(value) {} class Derived extends Base { constructor(flag) { super(() => { run = true; flag = true; }); } field = run &&= new GlideRecord("task").deleteMultiple(); } new Derived(false);',
      0,
    );
  });
  it("consumes a creation argument only when the ordinary superclass calls it", () => {
    findings(
      'var run = false; function Base(value) { value(); } Base(function() {}); class Derived extends Base { constructor() { super(() => { run = true; }); } field = run &&= new GlideRecord("task").deleteMultiple(); } new Derived();',
      1,
    );
  });
  it("retains exact scalar writes before derived fields", () => {
    findings(
      'var run = true; function Base() { run = false; } class Derived extends Base { field = run &&= new GlideRecord("task").deleteMultiple(); } new Derived();',
      0,
    );
  });
});
