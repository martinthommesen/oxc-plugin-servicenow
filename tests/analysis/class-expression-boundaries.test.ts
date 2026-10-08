import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import type { ESTree } from "@oxlint/plugins";
import { analyzePathBindings } from "../../src/analysis/path-state.js";
import { isNode } from "../../src/utils/ast.js";
import { applyRules } from "../helpers/apply-rules.js";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function missingQueries(body: string): number {
  const { messages, analysis } = lintWithAnalysis(
    `var gr = new GlideRecord("task"); ${body}`,
    "require-query-before-next",
  );
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  return messages.length;
}

function decoratorMissingQueries(body: string): number {
  const code = `var gr = new GlideRecord("task"); ${body}`;
  const parsed = parseSync("decorators.br.js", code, { sourceType: "module", lang: "ts" });
  assert.deepEqual(parsed.errors, []);
  let exhausted: boolean | undefined;
  const skipped: string[] = [];
  const messages = applyRules(
    code,
    { ast: parsed.program },
    {
      filename: "decorators.br.js",
      ruleNames: ["require-query-before-next"],
      onRuleSkipped: (rule) => skipped.push(rule),
      onFileAnalysis: (analysis) => {
        exhausted = analysis.pathBudgetExhausted;
      },
    },
  );
  assert.equal(exhausted, false);
  assert.deepEqual(skipped, []);
  assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  return messages.length;
}

function decoratorCursorCalls(body: string): number {
  const code = `var gr = new GlideRecord("task"); ${body}`;
  const parsed = parseSync("decorators.br.js", code, { sourceType: "module", lang: "ts" });
  assert.deepEqual(parsed.errors, []);
  assert.ok(isNode(parsed.program));
  const program = parsed.program;
  const calls = new Set<ESTree.CallExpression>();
  let outcome: "complete" | "exhausted" | undefined;
  applyRules(
    code,
    { ast: program },
    {
      filename: "decorators.br.js",
      ruleNames: ["require-query-before-next"],
      onFileAnalysis: (analysis) => {
        outcome = analyzePathBindings<null>({
          program,
          analysis: analysis.provenance,
          kinds: ["GlideRecord"],
          emptyData: () => null,
          cloneData: () => null,
          mergeData: () => null,
          equalsData: () => true,
          analyzeUncalledFunctions: false,
          onCall: ({ call, property }) => {
            if (property === "next") calls.add(call);
          },
        }).outcome;
        assert.equal(analysis.pathBudgetExhausted, false);
      },
    },
  );
  assert.equal(outcome, "complete");
  return calls.size;
}

// @lat: [[tests#Analysis behavior#Class expressions consume headers and initialize names in order]]
describe("class expression boundaries", () => {
  for (const heritage of ["", "extends (base ||= function Base() {})"]) {
    it(`finishes independent computed headers ${heritage || "without heritage"}`, () => {
      const names = Array.from({ length: 50 }, (_, index) => `key${index}`);
      const declarations = names.map((name) => `${name} = external`).join(", ");
      const keys = names.map((name) => `[${name} ||= "key"]() {}`).join("\n");
      assert.equal(
        missingQueries(
          `var base = false, ${declarations}; var ctor = class ${heritage} { ${keys} }; gr.next();`,
        ),
        1,
      );
    });
  }

  for (const [form, effect, expected] of [
    ["var ctor = class C", "static { C ||= (gr.next(), C); }", 0],
    ["var ctor = class C", "static { C ??= (gr.next(), C); }", 0],
    ["var ctor = class C", "static { C &&= (gr.next(), C); }", 1],
    ["var ctor = class C", "static value = (C ||= (gr.next(), C));", 0],
    ["class C", "static { C ||= (gr.next(), C); }", 0],
    ["class C", '[C ||= (gr.next(), "key")]() {}', 1],
  ] as const) {
    it(`selects the class name at ${form} { ${effect} }`, () => {
      assert.equal(missingQueries(`${form} { ${effect} }`), expected);
    });
  }

  it("keeps declaration heritage selectors unknown before name initialization", () => {
    assert.equal(missingQueries(`class C extends (C ||= (gr.next(), function () {})) {}`), 1);
  });
  it("keeps an unknown selected heritage conservative", () => {
    assert.equal(
      missingQueries(
        `var base = external; var ctor = class extends (base ||= function () {}) { [external || "key"]() {} }; gr.next();`,
      ),
      1,
    );
  });
  it("keeps the named expression binding separate from its enclosing name", () => {
    assert.equal(
      missingQueries(
        `var C = false; var ctor = class C { static { C ||= (gr.next(), C); } }; C &&= gr.next();`,
      ),
      0,
    );
  });
  it("keeps the declaration outer binding uncertain until static initialization completes", () => {
    assert.equal(
      missingQueries(`function read() { C ||= (gr.next(), C); } class C { static { read(); } }`),
      1,
    );
  });
  it("initializes the declaration outer binding after class definition completes", () => {
    assert.equal(missingQueries(`class C {} C ||= (gr.next(), C);`), 0);
  });
  it("preserves earlier scalar argument values through computed keys", () => {
    assert.equal(
      missingQueries(
        `var flag = false; function use(value, unused) { value &&= (gr.next(), gr); } use(flag, class { [flag = true]() {} });`,
      ),
      0,
    );
  });
  for (const [initial, replacement, expected] of [
    ["function () { gr.query(); }", "function () {}", 0],
    ["function () {}", "function () { gr.query(); }", 1],
  ] as const) {
    it(`preserves the earlier callback before class keys replace it with ${replacement}`, () => {
      assert.equal(
        missingQueries(
          `var cb = ${initial}; function expose(fn, unused) { return (fn ||= function () {}); } expose(cb, class { [(cb = ${replacement}, "key")]() {} }); gr.next();`,
        ),
        expected,
      );
    });
  }
  it("preserves an outer logical assignment value after its binding changes in a key", () => {
    assert.equal(
      missingQueries(
        `var alias = gr; function expose(value, unused) { return value; } expose(alias ||= new GlideRecord("task"), class { [(alias = {}, "key")]() {} }); gr.next();`,
      ),
      0,
    );
  });
});

// @lat: [[tests#Analysis behavior#Class decorator expressions preserve evaluation effects]]
describe("class decorator expression effects", () => {
  for (const [name, body, expected] of [
    ["class declaration decorator", "@decorate(gr.query()) class C {} gr.next();", 0],
    ["class expression decorator", "var ctor = @decorate(gr.query()) class C {}; gr.next();", 0],
    ["member method decorator", "class C { @decorate(gr.query()) method() {} } gr.next();", 0],
    ["member field decorator", "class C { @decorate(gr.query()) value: string; } gr.next();", 0],
    ["decorator cursor effects", "class C { @decorate(gr.next()) method() {} }", 1],
    [
      "class decorators before heritage",
      "@decorate(gr.query()) class C extends (gr.next(), Object) {}",
      0,
    ],
    [
      "member decorators before their computed keys",
      "class C { @decorate(gr.query()) [gr.next()]() {} }",
      0,
    ],
    [
      "member expressions keep source order",
      "class C { [gr.next()]() {} @decorate(gr.query()) later() {} }",
      1,
    ],
    [
      "member decorators before static initialization",
      "class C { static value = gr.next(); @decorate(gr.query()) later() {} }",
      0,
    ],
  ] as const) {
    it(name, () => {
      assert.equal(decoratorMissingQueries(body), expected);
    });
  }
});

// @lat: [[tests#Analysis behavior#Decorator applications retain saved captures through static initialization]]
describe("class decorator application effects", () => {
  for (const [name, body, expected] of [
    [
      "named decorator application invalidates scalar captures",
      "var flag = false; function decorate(value) { flag = true; } @decorate class C {} flag &&= (gr.next(), gr);",
      1,
    ],
    [
      "member application invalidates scalar captures",
      "var flag = false; function decorate(value) { flag = true; } class C { @decorate method() {} } flag &&= (gr.next(), gr);",
      1,
    ],
    [
      "saved decorator survives computed-key replacement",
      'var flag = false; var decorate = function () { flag = true; }; @decorate class C { [(decorate = function () {}, "key")]() {} } flag &&= (gr.next(), gr);',
      1,
    ],
    [
      "later replacement cannot give an empty saved decorator new captures",
      'var flag = false; var decorate = function () {}; @decorate class C { [(decorate = function () { flag = true; }, "key")]() {} } flag &&= (gr.next(), gr);',
      0,
    ],
    [
      "opaque factory decorators retain possible captures after key replacement",
      'var flag = false; var decorate = function () { flag = true; }; function factory() { return decorate; } @factory() class C { [(decorate = function () {}, "key")]() {} } flag &&= (gr.next(), gr);',
      1,
    ],
    [
      "opaque factory results keep possible decorator effects conservative",
      'var flag = false; var decorate = function () {}; function factory() { return decorate; } @factory() class C { [(decorate = function () { flag = true; }, "key")]() {} } flag &&= (gr.next(), gr);',
      1,
    ],
    [
      "initializer captures stay uncertain after static assignments",
      "var flag = false; function decorate(value, context) { context.addInitializer(function () { flag = true; }); } @decorate class C { static { flag = false; } } flag &&= (gr.next(), gr);",
      1,
    ],
    [
      "unknown class decorators expose deferred class captures",
      "var flag = false; @external class C { method() { flag = true; } } flag &&= (gr.next(), gr);",
      1,
    ],
    [
      "unknown member decorators expose deferred member captures",
      "var flag = false; class C { @external method() { flag = true; } } flag &&= (gr.next(), gr);",
      1,
    ],
    [
      "empty zero-parameter decorators retain unused class captures",
      "var flag = false; function decorate() {} @decorate class C { method() { flag = true; } } flag &&= (gr.next(), gr);",
      0,
    ],
    ...[
      "function decorate(value) {}",
      "function decorate(value, context) {}",
      "var decorate = function (value) {};",
      "var decorate = (value, context) => {};",
      "function decorate(value: unknown, context: unknown) {}",
    ].map(
      (declaration) =>
        [
          `empty decorators with unused ordinary parameters preserve records: ${declaration}`,
          `${declaration} @decorate class C { method() { gr.query(); } } gr.next();`,
          1,
        ] as const,
    ),
    [
      "empty ordinary-parameter member decorators preserve records",
      "function decorate(value, context) {} class C { @decorate method() { gr.query(); } } gr.next();",
      1,
    ],
    [
      "empty ordinary-parameter decorators preserve scalar captures",
      "var flag = false; function decorate(value, context) {} @decorate class C { method() { flag = true; } } flag &&= (gr.next(), gr);",
      0,
    ],
    [
      "empty ordinary-parameter decorators do not invent catch paths",
      "function decorate(value, context) {} try { @decorate class C {} } catch (error) { gr.next(); }",
      0,
    ],
    [
      "default parameter effects stay conservative",
      "var flag = false; function decorate(value, context, extra = (flag = true)) {} @decorate class C {} flag &&= (gr.next(), gr);",
      1,
    ],
    [
      "destructured decorator parameters keep target effects conservative",
      "function decorate({ prototype }) {} @decorate class C { method() { gr.query(); } } gr.next();",
      0,
    ],
    [
      "rest decorator parameters keep target effects conservative",
      "function decorate(...values) {} @decorate class C { method() { gr.query(); } } gr.next();",
      0,
    ],
    [
      "application invalidates the current captured record after keys",
      'function decorate(value) { gr.query(); } var prior = gr; @decorate class C { [(gr = new GlideRecord("task"), "key")]() {} } prior.next(); gr.next();',
      1,
    ],
    [
      "unknown saved decorator remains unknown after binding replacement",
      'var flag = false, decorate = external; @decorate class C { [(decorate = function () {}, "key")]() {} method() { flag = true; } } flag &&= (gr.next(), gr);',
      1,
    ],
    [
      "possible decorator throws retain the owning catch path",
      "function decorate() { throw 0; } try { @decorate class C {} } catch (error) { gr.next(); }",
      1,
    ],
    [
      "an empty decorator does not invent a catch path",
      "function decorate() {} try { @decorate class C {} } catch (error) { gr.next(); }",
      0,
    ],
    [
      "an empty async decorator does not imply a valid undefined return",
      "async function decorate() {} try { @decorate class C {} } catch (error) { gr.next(); }",
      1,
    ],
    [
      "an empty generator decorator does not imply a valid undefined return",
      "function* decorate() {} try { @decorate class C {} } catch (error) { gr.next(); }",
      1,
    ],
    [
      "possible decorator throws retain capture effects on the catch path",
      "var flag = false; function decorate() { flag = true; throw 0; } try { @decorate class C {} } catch (error) { flag &&= (gr.next(), gr); }",
      1,
    ],
  ] as const) {
    it(name, () => assert.equal(decoratorMissingQueries(body), expected));
  }

  for (const [decorator, expected] of [
    ["function decorate(value) { flag = true; }", 1],
    ["function decorate() {}", 0],
  ] as const) {
    it(`evaluates static selectors after ${decorator}`, () => {
      // The raw call hook proves execution even when class exposure suppresses rule authority.
      assert.equal(
        decoratorCursorCalls(
          `var flag = false; ${decorator} @decorate class C { static { flag &&= (gr.next(), gr); } }`,
        ),
        expected,
      );
    });
  }

  it("keeps fifty discarded keys bounded while retaining a decorator value", () => {
    const names = Array.from({ length: 50 }, (_, index) => `key${index}`);
    const declarations = names.map((name) => `${name} = external`).join(", ");
    const keys = names.map((name) => `[${name} ||= "key"]() {}`).join("\n");
    assert.equal(
      decoratorMissingQueries(
        `var ${declarations}; function decorate() {} @decorate class C { ${keys} } gr.next();`,
      ),
      1,
    );
  });
});
