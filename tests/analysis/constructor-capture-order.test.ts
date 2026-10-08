import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function missingQueries(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "require-query-before-next");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Constructor capture effects follow argument evaluation]]
describe("constructor capture evaluation order", () => {
  it("retains an old record alias replaced by an argument before construction", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); var prior = gr; class C { constructor() { gr.query(); } } new C((gr = new GlideRecord("incident"), 0)); prior.next();`,
      ),
      1,
    );
  });

  it("escapes the record installed by an argument before construction", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); class C { constructor() { gr.query(); } } new C((gr = new GlideRecord("incident"), 0)); gr.next();`,
      ),
      0,
    );
  });

  it("keeps the selected constructor when an argument replaces its binding", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); class C { constructor() { gr.query(); } } new C((C = class {}, gr = new GlideRecord("incident"), 0)); gr.next();`,
      ),
      0,
    );
  });

  it("applies constructor captures to each completed argument path", () => {
    assert.equal(
      missingQueries(
        `var left = new GlideRecord("task"); var right = new GlideRecord("incident"); var gr = left; var choice = external; class C { constructor() { gr.query(); } } (new C(choice ||= (gr = right, 0)), left.next(), right.next());`,
      ),
      2,
    );
  });

  it("does not escape captures when an argument throws before construction", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); class C { constructor() { gr.query(); } } function fail() { throw 0; } try { new C(fail()); } catch (error) {} gr.next();`,
      ),
      1,
    );
  });

  it("applies captures after spread arguments replace a captured record", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); class C { constructor() { gr.query(); } } new C(...[(gr = new GlideRecord("incident"), 0)]); gr.next();`,
      ),
      0,
    );
  });

  it("keeps an unknown constructor when an argument installs a captured class", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); var C = external; new C((C = class { constructor() { gr.query(); } }, 0)); gr.next();`,
      ),
      1,
    );
  });

  it("keeps an unknown sequence constructor when an argument installs a captured class", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); var C = external; new (0, C)((C = class { constructor() { gr.query(); } }, 0)); gr.next();`,
      ),
      1,
    );
  });

  it("does not invalidate scalar captures when an argument throws before construction", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); var flag = false; function C() { flag = true; } function fail() { throw 0; } try { new C(fail()); } catch (error) {} flag &&= (gr.next(), gr);`,
      ),
      0,
    );
  });

  it("retains records when the selected constructor has no captures", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); var prior = gr; class C {} new C((gr = new GlideRecord("incident"), 0)); prior.next(); gr.next();`,
      ),
      2,
    );
  });
});
