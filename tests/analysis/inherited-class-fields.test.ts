import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function bulkCalls(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Known construction retains evaluated superclass field chains]]
describe("inherited class fields", () => {
  it("executes a known base field through an implicit derived constructor", () => {
    assert.equal(
      bulkCalls(
        'class Base { field = new GlideRecord("task").deleteMultiple(); } class Derived extends Base {} new Derived();',
      ),
      1,
    );
  });
  it("executes three levels of fields from base to derived", () => {
    assert.equal(
      bulkCalls(
        'var run = false; class Base { first = (run = true); } class Middle extends Base { second = run &&= new GlideRecord("task").deleteMultiple(); } class Derived extends Middle { third = (run = false); } new Derived();',
      ),
      1,
    );
  });
  it("applies a base scalar effect before a derived selector", () => {
    assert.equal(
      bulkCalls(
        'var run = true; class Base { first = (run = false); } class Derived extends Base { second = run &&= new GlideRecord("task").deleteMultiple(); } new Derived();',
      ),
      0,
    );
  });
  it("retains heritage before its binding is replaced", () => {
    assert.equal(
      bulkCalls(
        'var Base = class { field = new GlideRecord("task").deleteMultiple(); }; class Derived extends Base {} Base = class {}; new Derived();',
      ),
      1,
    );
  });
  it("does not acquire fields from a later heritage replacement", () => {
    assert.equal(
      bulkCalls(
        'var Base = class {}; class Derived extends Base {} Base = class { field = new GlideRecord("task").deleteMultiple(); }; new Derived();',
      ),
      0,
    );
  });
  it("saves heritage before a computed key replaces its binding", () => {
    assert.equal(
      bulkCalls(
        'var Base = class { field = new GlideRecord("task").deleteMultiple(); }; class Derived extends Base { [Base = class {}] = 0; } new Derived();',
      ),
      1,
    );
  });
  it("saves heritage before static initialization replaces its binding", () => {
    assert.equal(
      bulkCalls(
        'var Base = class { field = new GlideRecord("task").deleteMultiple(); }; class Derived extends Base { static { Base = class {}; } } new Derived();',
      ),
      1,
    );
  });
  it("retains anonymous class heritage through aliases", () => {
    assert.equal(
      bulkCalls(
        'var Base = class Local { field = new GlideRecord("task").deleteMultiple(); }; var Alias = Base; var Derived = class extends Alias {}; var Selected = Derived; new Selected();',
      ),
      1,
    );
  });
  it("retains a class heritage value created inside a helper", () => {
    assert.equal(
      bulkCalls(
        'class Base { field = new GlideRecord("task").deleteMultiple(); } var Derived; function define() { Derived = class extends Base {}; } define(); new Derived();',
      ),
      1,
    );
  });
  it("replays alternative known bases separately", () => {
    assert.equal(
      bulkCalls(
        'var run = false; class Yes { field = (run = true); } class No { field = (run = false); } class Derived extends (external ? Yes : No) { field = run &&= new GlideRecord("task").deleteMultiple(); } new Derived();',
      ),
      1,
    );
  });
  it("retains scalar and heritage correlations", () => {
    assert.equal(
      bulkCalls(
        'var run = false; var Base; if (external) { run = true; Base = class {}; } else { run = false; Base = class { field = (run = false); }; } class Derived extends Base { field = run &&= new GlideRecord("task").deleteMultiple(); } new Derived();',
      ),
      1,
    );
  });
  it("does not replay an unselected constant base", () => {
    assert.equal(
      bulkCalls(
        'class Yes { field = new GlideRecord("task").deleteMultiple(); } class No {} class Derived extends (false ? Yes : No) {} new Derived();',
      ),
      0,
    );
  });
  it("keeps known origins alongside unknown base alternatives", () => {
    assert.equal(
      bulkCalls(
        'class Base { field = new GlideRecord("task").deleteMultiple(); } class Derived extends (external ? Base : unknownBase) {} new Derived();',
      ),
      1,
    );
  });
  it("keeps an unknown base opaque while evaluating own fields", () => {
    assert.equal(
      bulkCalls(
        'class Derived extends unknownBase { field = new GlideRecord("task").deleteMultiple(); } new Derived();',
      ),
      1,
    );
  });
  it("skips all inherited fields when an argument throws", () => {
    assert.equal(
      bulkCalls(
        'function fail() { throw 0; } class Base { field = new GlideRecord("task").deleteMultiple(); } class Derived extends Base { field = new GlideRecord("incident").deleteMultiple(); } new Derived(fail());',
      ),
      0,
    );
  });
  it("skips derived fields after a base initializer throws", () => {
    assert.equal(
      bulkCalls(
        'function fail() { throw 0; } class Base { field = fail(); } class Derived extends Base { field = new GlideRecord("task").deleteMultiple(); } try { new Derived(); } catch (error) {}',
      ),
      0,
    );
  });
  it("retains completed base effects before an abrupt later base field", () => {
    assert.equal(
      bulkCalls(
        'function fail() { throw 0; } class Base { first = new GlideRecord("task").deleteMultiple(); second = fail(); } class Derived extends Base { field = new GlideRecord("incident").deleteMultiple(); } try { new Derived(); } catch (error) {}',
      ),
      1,
    );
  });
  it("does not replay base static fields or computed keys", () => {
    assert.equal(
      bulkCalls(
        'class Base { static field = new GlideRecord("task").deleteMultiple(); [new GlideRecord("incident").deleteMultiple()] = 0; } class Derived extends Base {} new Derived(); new Derived();',
      ),
      2,
    );
  });
  it("leaves an unconstructed hierarchy deferred", () => {
    assert.equal(
      bulkCalls(
        'class Base { field = new GlideRecord("task").deleteMultiple(); } class Derived extends Base {}',
      ),
      0,
    );
  });
  it("bounds recursive construction through an inherited field", () => {
    assert.equal(
      bulkCalls(
        'class Base { first = new Derived(); second = new GlideRecord("task").deleteMultiple(); } class Derived extends Base {} new Derived();',
      ),
      1,
    );
  });
  it("retains earlier class instances when the same class expression runs again", () => {
    assert.equal(
      bulkCalls(
        'var Base = class { field = new GlideRecord("task").deleteMultiple(); }; var Prior; function install() { Prior = class extends Base {}; } install(); var Saved = Prior; Base = class {}; install(); new Saved();',
      ),
      1,
    );
  });
  it("keeps fifty known hierarchy levels within the work budget", () => {
    const classes = Array.from(
      { length: 50 },
      (_, index) =>
        `class C${index} ${index ? `extends C${index - 1}` : ""} { field${index} = ${index ? "0" : 'new GlideRecord("task").deleteMultiple()'}; }`,
    ).join(" ");
    assert.equal(bulkCalls(`${classes} new C49();`), 1);
  });
  it("bounds a heritage cycle represented by a repeated class site", () => {
    assert.equal(
      bulkCalls(
        'var Base = class {}; var Derived; function install() { Derived = class extends Base { field = new GlideRecord("task").deleteMultiple(); }; Base = Derived; } install(); install(); new Derived();',
      ),
      1,
    );
  });
  it("preserves enclosing saved constructor and argument values through inherited fields", () => {
    const { messages, analysis } = lintWithAnalysis(
      'var gr = new GlideRecord("task"); var prior = gr; var run = false; class Base { field = (run &&= true); } class Derived extends Base {} new Derived(gr, gr = new GlideRecord("incident")); prior.next();',
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(messages.length, 0);
  });
});
