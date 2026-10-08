import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis, parse } from "../helpers/rule-tester.js";
import { constantValue } from "../../src/analysis/constant-value.js";

function missingQueries(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "require-query-before-next");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Constant loop entries respect runtime reachability]]
describe("constant loop reachability", () => {
  for (const loop of ["while (false)", "for (; false; gr.next())"]) {
    it(`skips an unreachable cursor advance in ${loop}`, () =>
      void assert.equal(
        missingQueries(`var gr = new GlideRecord("incident"); ${loop} { gr.next(); }`),
        0,
      ));

    it(`preserves the receiver after an unreachable mutation in ${loop}`, () =>
      void assert.equal(
        missingQueries(`var gr = new GlideRecord("incident"); ${loop} { gr = {}; } gr.next();`),
        1,
      ));
  }

  it("keeps header effects before a false while entry", () =>
    void assert.equal(
      missingQueries(
        `var gr = new GlideRecord("incident"); while ((gr.query(), false)) { gr.next(); } gr.next();`,
      ),
      0,
    ));

  it("executes a false do-while body once", () =>
    void assert.equal(
      missingQueries(
        `var gr = new GlideRecord("incident"); do { gr.next(); gr.query(); } while (false); gr.next();`,
      ),
      1,
    ));
});

// @lat: [[tests#Analysis behavior#Callable identities follow their execution paths]]
describe("callable execution state", () => {
  // @lat: [[tests#Analysis behavior#Callable alternatives retain branch state correlations]]
  it("keeps a branch query correlated with its no-op helper", () => {
    for (const [consequent, alternate] of [
      ["run = function () { gr.query(); };", "gr.query(); run = function () {};"],
      ["gr.query(); run = function () {};", "run = function () { gr.query(); };"],
    ]) {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("incident"); var run; if (flag) { ${consequent} } else { ${alternate} } var alias = run; alias(); gr.next();`,
        ),
        0,
      );
    }
  });

  it("retains an unopened path after optional helper replacement", () =>
    void assert.equal(
      missingQueries(
        `var gr = new GlideRecord("incident"); var run = function () {}; if (flag) { run = function () { gr.query(); }; } run(); gr.next();`,
      ),
      1,
    ));

  it("keeps conditional callable results correlated until their outer binding is assigned", () => {
    for (const expression of [
      "run = flag ? function () { gr.query(); } : (gr.query(), function () {}); run();",
      "run = flag ? (gr.query(), function () {}) : function () { gr.query(); }; run();",
      "var alias = flag ? (run = function () { gr.query(); }) : (gr.query(), run = function () {}); alias();",
      "var alias = flag ? (gr.query(), run = function () {}) : (run = function () { gr.query(); }); alias();",
      "alias = flag ? (run = function () { gr.query(); }) : (gr.query(), run = function () {}); alias();",
      "var alias = (flag ? function () { gr.query(); } : (gr.query(), function () {})); alias();",
    ]) {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("incident"); var run, alias; ${expression} gr.next();`,
        ),
        0,
      );
    }
    assert.equal(
      missingQueries(
        'var gr = new GlideRecord("incident"); var run = flag ? function () { gr.query(); } : function () {}; run(); gr.next();',
      ),
      1,
    );
  });

  it("binds helper parameters after arguments create callable alternatives", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("incident"); var run; function open(record) { record.query(); } open(flag ? (run = function () {}, gr) : (run = function () {}, gr)); gr.next();`,
      ),
      0,
    );
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("incident"); var run; gr.query(flag ? (run = function () {}) : (run = function () {})); gr.next();`,
      ),
      0,
    );
  });

  it("captures unknown and known callees before arguments replace their bindings", () => {
    for (const [init, expected] of [
      ["external", 0],
      ["function () {}", 1],
    ] as const)
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("incident"); var run = ${init}; run(run = function () { gr.query(); }); gr.next();`,
        ),
        expected,
      );
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("incident"); var run = function () { gr.query(); }; run(run = function () {}); gr.next();`,
      ),
      0,
    );
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("incident"); function open() { gr.query(); return 0; } var result = open(); gr.next();`,
      ),
      0,
    );
  });

  it("joins helper alternatives independently of branch order", () => {
    for (const [consequent, alternate] of [
      ["gr.query();", ""],
      ["", "gr.query();"],
    ]) {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("incident"); var run; if (flag) { run = function () { ${consequent} }; } else { run = function () { ${alternate} }; } run(); gr.next();`,
        ),
        1,
      );
    }
  });

  it("keeps a definite query when both helper alternatives open the cursor", () =>
    void assert.equal(
      missingQueries(
        `var gr = new GlideRecord("incident"); var run; if (flag) { run = function () { gr.query(); }; } else { run = function () { gr.get("sys_id"); }; } run(); gr.next();`,
      ),
      0,
    ));

  it("isolates helper writes in an uncalled body", () =>
    void assert.equal(
      missingQueries(
        `var gr = new GlideRecord("incident"); var run = function () {}; function deferred() { run = function () { gr.query(); }; } run(); gr.next();`,
      ),
      1,
    ));

  it("publishes captured helper replacement from a direct call", () =>
    void assert.equal(
      missingQueries(
        `var gr = new GlideRecord("incident"); var run = function () {}; function replace() { run = function () { gr.query(); }; } replace(); run(); gr.next();`,
      ),
      0,
    ));

  it("does not reinstall a hoisted declaration at its source position", () =>
    void assert.equal(
      missingQueries(
        `var gr = new GlideRecord("incident"); run = function () {}; function run() { gr.query(); } run(); gr.next();`,
      ),
      1,
    ));
});

// @lat: [[tests#Analysis behavior#Logical assignments export their selected values]]
describe("logical assignment values", () => {
  for (const completion of ["return", "throw"]) {
    for (const [setup, expression, expected] of [
      ["var alias = gr;", 'alias ||= new GlideRecord("task")', 0],
      ["var alias = gr;", 'alias ??= new GlideRecord("task")', 0],
      ["var alias = gr;", "alias &&= 0", 1],
      ["var flag = false;", "flag &&= gr", 1],
      ["var flag = true;", "flag ||= gr", 1],
      ["var flag = 0;", "flag ??= gr", 1],
      ["var flag = false;", "flag ||= gr", 0],
      ["var flag = true;", "flag &&= gr", 0],
      ["var flag = null;", "flag ??= gr", 0],
      ["var flag = true; flag = false;", "flag &&= gr", 1],
      ["var flag = false; flag = true;", "flag &&= gr", 0],
    ] as const) {
      it(`exports only the selected value in ${completion} (${expression}) after ${setup}`, () => {
        assert.equal(
          missingQueries(
            `var gr = new GlideRecord("task"); ${setup} function expose() { try { ${completion} (${expression}); } finally { gr.next(); } } try { expose(); } catch (error) {}`,
          ),
          expected,
        );
      });
    }

    for (const [setup, expression] of [
      ["var alias = gr;", "alias ||= (gr.next(), 0)"],
      ["var alias = gr;", "alias ??= (gr.next(), 0)"],
      ["var flag = false;", "flag &&= (gr.next(), gr)"],
      ["var flag = true;", "flag ||= (gr.next(), gr)"],
      ["var flag = 0;", "flag ??= (gr.next(), gr)"],
    ]) {
      it(`skips cursor advances in ${completion} (${expression}) after ${setup}`, () => {
        assert.equal(
          missingQueries(
            `var gr = new GlideRecord("task"); ${setup} function expose() { ${completion} (${expression}); } try { expose(); } catch (error) {}`,
          ),
          0,
        );
      });
    }

    for (const operator of ["||=", "??="]) {
      it(`escapes the retained callable in ${completion} (fn ${operator} function () {})`, () => {
        assert.equal(
          missingQueries(
            `var gr = new GlideRecord("task"); var fn = function () { gr.query(); }; function expose() { try { ${completion} (fn ${operator} function () {}); } finally { gr.next(); } } try { expose(); } catch (error) {}`,
          ),
          0,
        );
      });
      it(`ignores skipped callback captures in ${completion} (fn ${operator} function () { gr.query(); })`, () => {
        assert.equal(
          missingQueries(
            `var gr = new GlideRecord("task"); var fn = function () {}; function expose() { try { ${completion} (fn ${operator} function () { gr.query(); }); } finally { gr.next(); } } try { expose(); } catch (error) {}`,
          ),
          1,
        );
      });
    }
  }

  it("forgets a scalar selector captured by a named callback sent to an unknown callee", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); var flag = false; function flip() { flag = true; } external(flip); flag &&= (gr.next(), gr);`,
      ),
      1,
    );
  });

  for (const effect of [
    "external(flip); flag = false; external();",
    "function expose() { flip(); } expose();",
    "function expose() { external(flip); } expose();",
    "new flip();",
    "var C = flip; new C(C = function () {});",
    "flip.call(null);",
    "flip.apply(null, []);",
    "external(flip.bind(null));",
  ]) {
    it(`does not retain false certainty after ${effect}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var flag = false; function flip() { flag = true; } ${effect} flag &&= (gr.next(), gr);`,
        ),
        1,
      );
    });
  }

  for (const effect of [
    "function Wrapper() { flip(); } new Wrapper();",
    "function Wrapper() { flip(); } Wrapper.call(null);",
    "function Wrapper() { flip(); } Wrapper.apply(null, []);",
    "function Wrapper() { flip(); } external(Wrapper);",
    "function Wrapper() { flip(); } external(Wrapper); flag = false; external();",
    "class Wrapper { constructor() { flag = true; } } new Wrapper();",
    "class Wrapper { constructor() { flip(); } } new Wrapper();",
    "new (class { constructor() { flag = true; } })();",
    "class Wrapper { static flip() { flag = true; } } Wrapper.flip();",
    "class Wrapper { flip() { flag = true; } } new Wrapper().flip();",
    "function first() { second(); } function second() { flag = true; first(); } external(first);",
  ]) {
    it(`forgets transitive or opaque scalar effects after ${effect}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var flag = false; function flip() { flag = true; } ${effect} flag &&= (gr.next(), gr);`,
        ),
        1,
      );
    });
  }

  for (const declaration of [
    "class Wrapper { flip() { flag = true; } }",
    "if (false) { class Wrapper { flip() { flag = true; } } }",
    "class Wrapper { flip() { flip(); } }",
  ]) {
    it(`retains a false selector when class code is unused: ${declaration}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var flag = false; function flip() { flag = true; } ${declaration} flag &&= (gr.next(), gr);`,
        ),
        0,
      );
    });
  }

  it("forgets newly captured scalar bindings when an exposed helper is replaced", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); var flag = false; var mutate = function () {}; function Wrapper() { mutate(); } external(Wrapper); mutate = function () { flag = true; }; external(); flag &&= (gr.next(), gr);`,
      ),
      1,
    );
  });

  for (const [setup, expected] of [
    ["var flag = false; function flip() { flag = true; } flip();", 1],
    ["var flag = true; function flip() { flag = false; } flip();", 0],
    ["var flag = false; flag++;", 1],
    ["var flag = false; ({ flag } = external);", 1],
    ["var flag = false; if (condition) flag = true;", 1],
    ["var flag = false; external(function () { flag = true; });", 1],
  ] as const) {
    it(`keeps a conservative scalar selector after ${setup}`, () => {
      assert.equal(
        missingQueries(`var gr = new GlideRecord("task"); ${setup} flag &&= (gr.next(), gr);`),
        expected,
      );
    });
  }

  for (const operator of ["||=", "??="]) {
    it(`keeps the receiver binding after a skipped ${operator} assignment`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var alias = gr; alias ${operator} new GlideRecord("incident"); alias.next();`,
        ),
        1,
      );
    });
  }
});

// @lat: [[tests#Analysis behavior#Logical assignment headers release transient correlations]]
describe("logical assignment statement boundaries", () => {
  for (const statement of [
    (name: string) => `if (${name} ||= true) {}`,
    (name: string) => `switch (${name} ||= true) { default: break; }`,
    (name: string) => `while (${name} ||= true) { break; }`,
    (name: string) => `class ${name}Class { [${name} ||= "key"]() {} }`,
  ]) {
    it(`finishes independent headers in ${statement("selector")}`, () => {
      const names = Array.from({ length: 50 }, (_, index) => `selector${index}`);
      const declarations = names.map((name) => `${name} = external`).join(", ");
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var ${declarations}; ${names.map(statement).join("\n")} gr.next();`,
        ),
        1,
      );
    });
  }
});

// @lat: [[tests#Analysis behavior#Logical assignment parameters retain evaluated scalars]]
describe("logical assignment helper parameters", () => {
  for (const [params, argumentsCode, expected] of [
    ["flag", "false", 0],
    ["flag", "true", 1],
    ["flag", "external", 1],
    ["flag = false", "", 0],
    ["flag = false", "void 0", 0],
    ["flag = true", "null", 0],
    ["flag = true", "false", 0],
    ["flag = true", "external", 1],
    ["flag = false", "external", 1],
    ["flag = (outer = true)", "false", 0],
    ["flag = (outer = false)", "", 0],
  ] as const) {
    it(`selects the evaluated flag for (${params}) called with (${argumentsCode})`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var outer = false; function use(${params}) { flag &&= (gr.next(), gr); } use(${argumentsCode});`,
        ),
        expected,
      );
    });
  }
  for (const [initial, replacement, expected] of [
    ["false", "true", 0],
    ["true", "false", 1],
  ] as const) {
    it(`captures ${initial} before a later argument replaces it with ${replacement}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var flag = ${initial}; function use(value, unused) { value &&= (gr.next(), gr); } use(flag, flag = ${replacement});`,
        ),
        expected,
      );
    });
  }
  for (const [argument, expected] of [
    ["external", 1],
    ["...external", 1],
    ["false", 0],
    ["void 0", 1],
  ] as const) {
    it(`includes possible default effects for (${argument})`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var flag = false; function use(value = (flag = true)) {} use(${argument}); flag &&= (gr.next(), gr);`,
        ),
        expected,
      );
    });
  }
  for (const [initial, later, expected] of [
    ["function () { gr.query(); }", "function () {}", 0],
    ["function () {}", "function () { gr.query(); }", 1],
  ] as const) {
    it(`retains a callback parameter captured before replacement with ${later}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var cb = ${initial}; function expose(fn, unused) { return (fn ||= function () { gr.query(); }); } expose(cb, cb = ${later}); gr.next();`,
        ),
        expected,
      );
    });
  }
  it("retains a hoisted callback parameter selected by nullish assignment", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); function cb() { gr.query(); } function expose(fn) { return (fn ??= function () {}); } expose(cb); gr.next();`,
      ),
      0,
    );
  });
  for (const expression of ["(flag &&= true) ? gr : 0", "(flag &&= true) && gr"]) {
    it(`exports only the selected value from ${expression}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var flag = false; function expose() { return ${expression}; } expose(); gr.next();`,
        ),
        1,
      );
    });
  }
  it("keeps nullish aliases uncertain when a default may select true", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); var flag = void 0; function use(value = true) { value &&= (gr.next(), gr); } use(flag); flag ??= 0;`,
      ),
      1,
    );
  });
});

// @lat: [[tests#Analysis behavior#Hoisted callable logical selectors are defined values]]
describe("hoisted callable logical selectors", () => {
  for (const [operator, expected] of [
    ["||=", 0],
    ["??=", 0],
    ["&&=", 1],
  ] as const) {
    it(`selects the hoisted function value for ${operator}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); fn ${operator} (gr.next(), gr); function fn() {}`,
        ),
        expected,
      );
    });
  }
  for (const effect of [
    "fn = false;",
    "if (external) fn = false;",
    "function mutate() { fn = false; } external(mutate);",
  ]) {
    it(`retains uncertainty after ${effect}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); function fn() {} ${effect} fn ||= (gr.next(), gr);`,
        ),
        1,
      );
    });
  }
});

// @lat: [[tests#Analysis behavior#Class definitions evaluate only immediate class effects]]
describe("class evaluation boundaries", () => {
  for (const [element, expected] of [
    ["value = gr.query();", 1],
    ["value = gr.next();", 0],
    ["[gr.query()]() {}", 0],
    ["static value = gr.query();", 0],
    ["static { gr.query(); }", 0],
  ] as const) {
    it(`evaluates definition-time effects for ${element}`, () => {
      const tail = element === "value = gr.next();" ? "" : "gr.next();";
      assert.equal(
        missingQueries(`var gr = new GlideRecord("task"); class C { ${element} } ${tail}`),
        expected,
      );
    });
  }
  it("escapes unknown class instance effects at construction", () => {
    assert.equal(
      missingQueries(
        `var gr = new GlideRecord("task"); class C { value = gr.query(); } new C(); gr.next();`,
      ),
      0,
    );
  });
});

// @lat: [[tests#Analysis behavior#Logical member receivers retain path-specific values]]
describe("logical assignment member receivers", () => {
  for (const effect of [".next()", ".next(alias = {})", '["next"](alias = {})']) {
    it(`retains the selected receiver before ${effect}`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); var alias = external; (alias ||= gr)${effect};`,
        ),
        1,
      );
    });
  }
});

// @lat: [[tests#Analysis behavior#Return and throw escape evaluated values]]
describe("return and throw escape order", () => {
  for (const completion of ["return", "throw"]) {
    const invocation =
      completion === "return"
        ? "allocate(); gr.next();"
        : "try { allocate(); } catch (error) { gr.next(); }";
    for (const expression of [
      '(gr = new GlideRecord("task"))',
      '(gr = new GlideRecord("task"), gr)',
      'true ? (gr = new GlideRecord("task")) : 0',
      'false ? 0 : (gr = new GlideRecord("task"))',
      'true && (gr = new GlideRecord("task"))',
      'false || (gr = new GlideRecord("task"))',
      'null ?? (gr = new GlideRecord("task"))',
    ]) {
      it(`escapes a captured allocation in ${completion} ${expression}`, () => {
        assert.equal(
          missingQueries(
            `var gr; function allocate() { ${completion} ${expression}; } ${invocation}`,
          ),
          0,
        );
      });
    }

    it(`diagnoses cursor advances evaluated before ${completion} escapes the value`, () => {
      assert.equal(
        missingQueries(
          `var gr = new GlideRecord("task"); function expose() { ${completion} (gr.next(), gr); } try { expose(); } catch (error) {}`,
        ),
        1,
      );
    });

    for (const body of [
      `gr = new GlideRecord("task"); ${completion} 0;`,
      `${completion} (gr = new GlideRecord("task"), 0);`,
      `${completion} true ? (gr = new GlideRecord("task"), 0) : gr;`,
      `${completion} false ? gr : (gr = new GlideRecord("task"), 0);`,
      `${completion} ((gr = new GlideRecord("task"), true) || gr);`,
      `${completion} ((gr = new GlideRecord("task"), false) && gr);`,
      `${completion} ((gr = new GlideRecord("task"), 0) ?? gr);`,
      `${completion} ((0, (gr = new GlideRecord("task"), true)) || gr);`,
      `var scalar = 0; ${completion} (scalar += (gr = new GlideRecord("task")));`,
      `var scalar = 0; ${completion} (scalar -= (gr = new GlideRecord("task")));`,
    ]) {
      it(`retains a captured allocation in ${body}`, () => {
        assert.equal(missingQueries(`var gr; function allocate() { ${body} } ${invocation}`), 1);
      });
    }
  }

  it("recognizes nested sequence values within bounded work", () => {
    for (const [depth, expected] of [
      [3, { truthy: true, nullish: false }],
      [256, null],
    ] as const) {
      const statement = parse(`${"(0, ".repeat(depth)}true${")".repeat(depth)};`).ast.body[0];
      assert.ok(statement?.type === "ExpressionStatement");
      assert.deepEqual(constantValue(statement.expression), expected);
    }
  });

  for (const completion of ["return", "throw"]) {
    for (const closure of ["function () { gr.query(); }", "() => gr.query()"])
      it(`escapes captures when ${completion} selects ${closure}`, () => {
        assert.equal(
          missingQueries(
            `var gr = new GlideRecord("task"); var fn = function () { gr.query(); }; function expose() { try { ${completion} (fn, ${closure}); } finally { gr.next(); } } expose();`,
          ),
          0,
        );
      });
  }
});

// @lat: [[tests#Analysis behavior#Constant expressions retain the selected alias]]
describe("constant expression identities", () => {
  for (const expression of [
    "true ? gr : other",
    "false ? other : gr",
    "true && gr",
    "false || gr",
    "null ?? gr",
  ]) {
    it(`retains the selected identity of ${expression}`, () =>
      void assert.equal(
        missingQueries(
          `var gr = new GlideRecord("incident"); var alias = ${expression}; alias.next();`,
        ),
        1,
      ));
  }
});
