import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function bulkCalls(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  return messages.length;
}

function missingQueries(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "require-query-before-next");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Known construction evaluates instance field initializers]]
describe("constructed class fields", () => {
  for (const target of ["class Eraser", "var Eraser = class", "var Eraser = class Local"]) {
    it(`runs an initializer-local operation in ${target}`, () => {
      assert.equal(
        bulkCalls(`${target} { field = new GlideRecord("task").deleteMultiple(); }; new Eraser();`),
        1,
      );
    });
    it(`keeps unconstructed fields deferred in ${target}`, () => {
      assert.equal(
        bulkCalls(`${target} { field = new GlideRecord("task").deleteMultiple(); };`),
        0,
      );
    });
  }
  it("constructs a class selected through an alias", () => {
    assert.equal(
      bulkCalls(
        'class Eraser { field = new GlideRecord("task").deleteMultiple(); } var Alias = Eraser; new Alias();',
      ),
      1,
    );
  });
  it("retains the selected constructor before arguments rebind it", () => {
    assert.equal(
      bulkCalls(
        'var C = class { field = new GlideRecord("task").deleteMultiple(); }; new C(C = class {});',
      ),
      1,
    );
  });
  it("leaves fields deferred after abrupt argument evaluation", () => {
    assert.equal(
      bulkCalls(
        'class Eraser { field = new GlideRecord("task").deleteMultiple(); } function fail() { throw 1; } new Eraser(fail());',
      ),
      0,
    );
  });
  for (const [initial, assigned, expected] of [
    [false, true, 1],
    [true, false, 0],
  ] as const) {
    it(`evaluates ordered scalar fields from ${initial} to ${assigned}`, () => {
      assert.equal(
        bulkCalls(
          `var run = ${initial}; class Eraser { first = (run = ${assigned}); second = run &&= new GlideRecord("task").deleteMultiple(); } new Eraser();`,
        ),
        expected,
      );
    });
  }
  it("skips later fields after an initializer throws", () => {
    assert.equal(
      bulkCalls(
        'function fail() { throw 0; } class Eraser { first = fail(); second = new GlideRecord("task").deleteMultiple(); } try { new Eraser(); } catch (error) {}',
      ),
      0,
    );
  });
  it("retains earlier field effects when a later initializer throws", () => {
    assert.equal(
      bulkCalls(
        'function fail() { throw 0; } class Eraser { first = new GlideRecord("task").deleteMultiple(); second = fail(); } try { new Eraser(); } catch (error) {}',
      ),
      1,
    );
  });
  it("replays every possible saved constructor", () => {
    assert.equal(
      bulkCalls(
        'var C = external ? class { field = new GlideRecord("task").deleteMultiple(); } : class {}; new C();',
      ),
      1,
    );
  });
  it("keeps constructor selection correlated with scalar field selectors", () => {
    assert.equal(
      bulkCalls(
        'var run = false; var C; if (external) { run = true; C = class { field = run &&= new GlideRecord("task").deleteMultiple(); }; } else { run = false; C = class {}; } new C();',
      ),
      1,
    );
  });
  it("terminates recursive field construction conservatively", () => {
    assert.equal(
      bulkCalls(
        'class Eraser { first = new Eraser(); second = new GlideRecord("task").deleteMultiple(); } new Eraser();',
      ),
      1,
    );
  });
  it("keeps a locally queried initializer quiet", () => {
    assert.equal(
      bulkCalls(
        'class Eraser { field = (() => { var gr = new GlideRecord("task"); gr.addQuery("active", true); gr.deleteMultiple(); })(); } new Eraser();',
      ),
      0,
    );
  });
  it("does not repeat static initializers on construction", () => {
    assert.equal(
      bulkCalls(
        'class Eraser { static field = new GlideRecord("task").deleteMultiple(); } new Eraser(); new Eraser();',
      ),
      1,
    );
  });
  it("does not repeat a computed field key on construction", () => {
    assert.equal(
      bulkCalls(
        'class Eraser { [new GlideRecord("task").deleteMultiple()] = 0; } new Eraser(); new Eraser();',
      ),
      1,
    );
  });
  it("releases transient selector values between fifty independent fields", () => {
    const names = Array.from({ length: 50 }, (_, index) => `selector${index}`);
    const declarations = names.map((name) => `${name} = external`).join(", ");
    const fields = names.map((name, index) => `field${index} = (${name} ||= true);`).join(" ");
    assert.equal(
      bulkCalls(
        `var ${declarations}; class Eraser { ${fields} operation = new GlideRecord("task").deleteMultiple(); } new Eraser();`,
      ),
      1,
    );
  });
  it("exports the selected field object before later initializer operations", () => {
    assert.equal(
      missingQueries(
        'var gr = new GlideRecord("task"); var alias = gr; class C { field = (alias ||= new GlideRecord("incident")); later = gr.next(); } new C();',
      ),
      0,
    );
  });
  for (const [callback, expected] of [
    ["function() { gr.query(); }", 0],
    ["function() {}", 1],
  ] as const) {
    it(`exports only the selected field callback ${callback}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var cb = ${callback}; class C { field = (cb ||= function() { gr.query(); }); later = gr.next(); } new C();`,
        ),
        expected,
      );
    });
  }
  it("retains saved argument objects across field result cleanup", () => {
    assert.equal(
      missingQueries(
        'var gr = new GlideRecord("task"); var prior = gr; var run = false; class C { field = (run &&= true); } new C(gr, gr = new GlideRecord("incident")); prior.next();',
      ),
      0,
    );
  });
  it("keeps a skipped constructor deferred", () => {
    assert.equal(
      bulkCalls(
        'class Eraser { field = new GlideRecord("task").deleteMultiple(); } false && new Eraser();',
      ),
      0,
    );
  });
});
