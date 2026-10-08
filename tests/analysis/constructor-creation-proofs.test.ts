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

function typedFindings(code: string, expected: number): void {
  const parsed = parseSync("proof.br.js", code, { sourceType: "module", lang: "ts" });
  assert.deepEqual(parsed.errors, []);
  assert.ok(isNode(parsed.program));
  let analysis: FileAnalysis | undefined;
  const messages = applyRules(
    code,
    { ast: parsed.program },
    {
      filename: "proof.br.js",
      ruleNames: ["no-unfiltered-gliderecord-bulk-operation"],
      onFileAnalysis: (value) => {
        analysis = value;
      },
    },
  );
  assert.ok(analysis);
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  assert.equal(messages.length, expected);
}

function sharedCalls(body: string, expected: number, lang: "js" | "ts" = "js"): void {
  const code = `var gr = new GlideRecord("task"); var alias; ${body} alias.deleteMultiple();`;
  const parsed = parseSync("proof.br.js", code, { sourceType: "script", lang });
  assert.deepEqual(parsed.errors, []);
  assert.ok(isNode(parsed.program));
  let analysis: FileAnalysis | undefined;
  applyRules(
    code,
    { ast: parsed.program },
    {
      filename: "proof.br.js",
      ruleNames: ["no-unfiltered-gliderecord-bulk-operation"],
      onFileAnalysis: (value) => {
        analysis = value;
      },
    },
  );
  assert.ok(analysis);
  assert.equal(analysis.pathBudgetExhausted, false);
  let calls = 0;
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
      if (rec && property === "deleteMultiple") calls += 1;
    },
  });
  assert.equal(result.outcome, "complete");
  assert.equal(calls, expected);
}

function lookupFindings(body: string, expected: number): void {
  findings(
    `var gr = new GlideRecord("task"); var alias; ${body} alias.deleteMultiple();`,
    expected,
  );
}

const baseField = 'base = new GlideRecord("base").deleteMultiple();';
const derivedField = 'derived = new GlideRecord("derived").deleteMultiple();';

// @lat: [[tests#Analysis behavior#Harmless class creation preserves constructor proof]]
describe("harmless class constructor creation proof", () => {
  for (const expression of ["class {}", "class Returned {}", "((class {}))"]) {
    it(`continues derived initialization after returning ${expression}`, () => {
      findings(
        `class Base { constructor() { return ${expression}; } } class Derived extends Base { ${derivedField} } new Derived();`,
        1,
      );
    });
    it(`retains completed arguments before constructing ${expression}`, () => {
      lookupFindings(`try { new (${expression})((alias = gr, 0)); } catch {}`, 1);
    });
  }
  it("keeps base and derived fields around an empty class return", () => {
    findings(
      `class Base { ${baseField} constructor() { return class {}; } } class Derived extends Base { ${derivedField} } new Derived();`,
      2,
    );
  });
  it("recognizes empty class creation as a harmless super argument", () => {
    findings(
      `class Base { ${baseField} } class Derived extends Base { constructor() { super(class {}); } ${derivedField} } new Derived();`,
      2,
    );
  });
  it("keeps normal and opaque base-return alternatives separate", () => {
    findings(
      `class Safe { constructor() { return class {}; } } class Opaque { constructor() { throw 0; } } class Derived extends (external ? Safe : Opaque) { ${derivedField} } new Derived();`,
      1,
    );
  });
  it("retains the selected returning base after replacement", () => {
    findings(
      `var Base = class { constructor() { return class {}; } }; class Derived extends Base { ${derivedField} } Base = class { constructor() { throw 0; } }; new Derived();`,
      1,
    );
  });
  it("retains earlier argument assignment before a later argument throws", () => {
    lookupFindings(
      "function fail() { throw 0; } try { new (class {})((alias = gr, fail())); } catch {}",
      1,
    );
  });
  it("skips later arguments when the first argument throws", () => {
    lookupFindings(
      "function fail() { throw 0; } try { new (class {})(fail(), (alias = gr, 0)); } catch {}",
      0,
    );
  });
  it("retains a possible invocation throw after normal arguments", () => {
    lookupFindings("try { new (class {})(); alias = gr; } catch {}", 0);
  });
  it("preserves existing object argument exposure", () => {
    lookupFindings("try { new (class {})(alias = gr); } catch {}", 0);
  });
  it("does not treat calling a class without new as nonthrowing invocation", () => {
    lookupFindings("try { (class {})((alias = gr, 0)); } catch {}", 1);
  });
  for (const expression of [
    "class extends fail() {}",
    "class { [fail()]() {} }",
    "class { static { throw 0; } }",
    "class { static field = fail(); }",
  ]) {
    it(`keeps ${expression} header or static effects before arguments`, () => {
      lookupFindings(
        `function fail() { throw 0; } try { new (${expression})((alias = gr, 0)); } catch {}`,
        0,
      );
    });
  }
  for (const expression of ["class extends external {}", "class { static { throw 0; } }"]) {
    it(`does not widen the return proof for ${expression}`, () => {
      findings(
        `class Base { constructor() { return ${expression}; } } class Derived extends Base { ${derivedField} } new Derived();`,
        0,
      );
    });
  }
  for (const [name, expression] of [
    ["method", "class { method() { external(); } }"],
    ["static method", "class { static method() { external(); } }"],
    [
      "getter and setter",
      "class { get value() { return external(); } set value(next) { external(next); } }",
    ],
    ["static getter", "class { static get value() { return external(); } }"],
    ["throwing constructor", "class { constructor() { throw 0; } }"],
    ["constructor default", "class { constructor(value = fail()) {} }"],
    ["deferred instance field", "class { field = fail(); }"],
    ["deferred private field", "class { #field = fail(); }"],
    [
      "async and generator methods",
      "class { async method() { external(); } *generate() { external(); } }",
    ],
  ] as const) {
    it(`continues fields when a returned class contains deferred ${name}`, () => {
      findings(
        `function fail() { throw 0; } class Base { constructor() { return ${expression}; } } class Derived extends Base { ${derivedField} } new Derived();`,
        1,
      );
    });
    it(`continues fields when a super argument contains deferred ${name}`, () => {
      findings(
        `function fail() { throw 0; } class Base {} class Derived extends Base { constructor() { super(${expression}); } ${derivedField} } new Derived();`,
        1,
      );
    });
  }
  it("retains earlier argument effects before an instance field throws", () => {
    lookupFindings(
      "function fail() { throw 0; } try { new (class { method() {} field = fail(); })((alias = gr, 0)); } catch {}",
      1,
    );
  });
  it("does not execute returned class methods, defaults or instance fields while proving creation", () => {
    findings(
      `var run = false; class Base { constructor() { return class { constructor(value = (run = true)) { run = true; } method() { run = true; } field = (run = true); }; } } class Derived extends Base { quiet = run &&= new GlideRecord("skipped").deleteMultiple(); ${derivedField} } new Derived();`,
      1,
    );
  });
  it("does not execute class methods or instance fields used as a super argument", () => {
    findings(
      `var run = false; class Base {} class Derived extends Base { constructor() { super(class { method() { run = true; } field = (run = true); }); } quiet = run &&= new GlideRecord("skipped").deleteMultiple(); ${derivedField} } new Derived();`,
      1,
    );
  });
  it("proves a returned non-static auto-accessor initializer remains deferred", () => {
    typedFindings(
      `function fail() { throw 0; } class Base { constructor() { return class { accessor field = fail(); }; } } class Derived extends Base { ${derivedField} } new Derived();`,
      1,
    );
  });
  it("proves a non-static auto-accessor creation used as a super argument", () => {
    typedFindings(
      `function fail() { throw 0; } class Base {} class Derived extends Base { constructor() { super(class { accessor field = fail(); }); } ${derivedField} } new Derived();`,
      1,
    );
  });
  it("keeps computed instance field keys outside the creation proof", () => {
    findings(
      `function fail() { throw 0; } class Base { constructor() { return class { [fail()] = 0; }; } } class Derived extends Base { ${derivedField} } new Derived();`,
      0,
    );
  });
  it("keeps member decorators outside the creation proof", () => {
    typedFindings(
      `function fail() { throw 0; } class Base { constructor() { return class { @fail() method() {} }; } } class Derived extends Base { ${derivedField} } new Derived();`,
      0,
    );
  });
  for (const method of [
    "method(@fail() value: unknown) {}",
    "constructor(@fail() value: unknown) {}",
    "method(@fail() value = 0) {}",
    "constructor(@fail() public value: unknown) {}",
    "method(@fail() ...values: unknown[]) {}",
  ]) {
    it(`keeps ${method} parameter decorators outside the creation proof`, () => {
      typedFindings(
        `function fail() { throw 0; } class Base { constructor() { return class { ${method} }; } } class Derived extends Base { ${derivedField} } new Derived();`,
        0,
      );
    });
  }
  it("does not invent certain preargument capture after a class method parameter decorator", () => {
    sharedCalls(
      "function fail() { throw 0; } try { new (class { method(@fail() value: unknown) {} })((alias = gr, 0)); } catch {}",
      0,
      "ts",
    );
  });
  it("keeps undecorated method defaults and destructuring deferred", () => {
    typedFindings(
      `function fail() { throw 0; } class Base { constructor() { return class { method({value} = fail()) {} }; } } class Derived extends Base { ${derivedField} } new Derived();`,
      1,
    );
  });
  it("charges a wide class element scan once for repeated constructor proof", () => {
    const methods = Array.from({ length: 500 }, (_, index) => `method${index}() {}`).join(" ");
    findings(
      `class Base { constructor() { return class { ${methods} field = 0; }; } } class Derived extends Base { ${derivedField} } new Derived(); new Derived();`,
      1,
    );
  });
  it("keeps decorator effects outside the class lookup proof", () => {
    sharedCalls(
      "function fail() { throw 0; } try { new (@fail() class {})((alias = gr, 0)); } catch {}",
      0,
      "ts",
    );
  });
  it("keeps a literal class safe despite an unused dynamic-scope hazard", () => {
    sharedCalls("if (false) { with ({}) {} } try { new (class {})((alias = gr, 0)); } catch {}", 1);
  });
  it("keeps captured class identifier lookup uncertain through With", () => {
    sharedCalls(
      "var C = class {}; var callback; with ({ get C() { throw 0; } }) { callback = function() { try { new C((alias = gr, 0)); } catch {} }; } callback();",
      0,
    );
  });
  it("keeps non-simple constructor parameters outside the return proof", () => {
    findings(
      `class Base { ${baseField} constructor(value = fail()) { return class {}; } } class Derived extends Base { ${derivedField} } function fail() { throw 0; } new Derived(null);`,
      1,
    );
  });
  it("does not use an empty class return before super to initialize fields", () => {
    findings(
      `class Base { ${baseField} } class Derived extends Base { constructor() { return class {}; } ${derivedField} } new Derived();`,
      0,
    );
  });
  it("charges five hundred independent harmless class literal lookups", () => {
    lookupFindings(
      Array.from({ length: 500 }, () => "try { new (class {})((alias = gr, 0)); } catch {}").join(
        " ",
      ),
      1,
    );
  });
});

// @lat: [[tests#Analysis behavior#Function creation keeps constructor bodies deferred]]
describe("function constructor creation proof", () => {
  for (const [name, expression] of [
    ["nonempty function", "function() { external(); }"],
    ["expression arrow", "() => external()"],
    ["nonempty generator", "function*() { external(); }"],
    ["nonempty async function", "async function() { external(); }"],
    ["deferred default", "function(value = fail()) { external(); }"],
  ] as const) {
    it(`continues after a returned ${name} without executing it`, () => {
      findings(
        `function fail() { throw 0; } class Base { constructor() { return ${expression}; } } class Derived extends Base { ${derivedField} } new Derived();`,
        1,
      );
    });
    it(`continues after creating a ${name} super argument without executing it`, () => {
      findings(
        `function fail() { throw 0; } class Base {} class Derived extends Base { constructor() { super(${expression}); } ${derivedField} } new Derived();`,
        1,
      );
    });
  }
  for (const expression of [
    "function() { run = true; }",
    "() => (run = true)",
    "function(value = (run = true)) { run = true; }",
  ]) {
    it(`keeps the selector false before fields when returning ${expression}`, () => {
      findings(
        `var run = false; class Base { constructor() { return ${expression}; } } class Derived extends Base { quiet = run &&= new GlideRecord("skipped").deleteMultiple(); ${derivedField} } new Derived();`,
        1,
      );
    });
    it(`keeps the selector false before fields when passing ${expression} to super`, () => {
      findings(
        `var run = false; class Base {} class Derived extends Base { constructor() { super(${expression}); } quiet = run &&= new GlideRecord("skipped").deleteMultiple(); ${derivedField} } new Derived();`,
        1,
      );
    });
  }
});
