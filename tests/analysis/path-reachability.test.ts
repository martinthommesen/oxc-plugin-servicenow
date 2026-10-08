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
