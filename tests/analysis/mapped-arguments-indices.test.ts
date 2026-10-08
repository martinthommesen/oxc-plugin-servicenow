import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import { applyRules } from "../helpers/apply-rules.js";

function cursorFindings(code: string, expected: number): void {
  const parsed = parseSync("mapped.br.js", code, { sourceType: "script", lang: "js" });
  assert.deepEqual(parsed.errors, []);
  let exhausted: boolean | undefined;
  const messages = applyRules(
    code,
    { ast: parsed.program },
    {
      filename: "mapped.br.js",
      ruleNames: ["require-query-before-next"],
      onFileAnalysis: (analysis) => {
        exhausted = analysis.pathBudgetExhausted;
      },
    },
  );
  assert.equal(exhausted, false);
  assert.equal(messages.length, expected);
}

function cursorCalls(params: string, args: string, effect: string, expected: number): void {
  cursorFindings(
    `var gr = new GlideRecord("task"); function use(${params}) {
run = false; ${effect} run &&= gr.next(); } use(${args});`,
    expected,
  );
}

// @lat: [[tests#Analysis behavior#Mapped arguments retain positional ownership]]
describe("mapped arguments positional ownership", () => {
  for (const [name, params, args, effect, expected] of [
    ["earlier duplicate", "run, run", "true, false", "arguments[0] = true;", 0],
    ["last duplicate", "run, run", "true, false", "arguments[1] = true;", 1],
    ["unsupplied last duplicate", "run, run", "true", "arguments[0] = true;", 0],
    ["missing final slot", "run, run", "true", "arguments[1] = true;", 0],
    ["unknown arity earlier duplicate", "run, run", "...external", "arguments[0] = true;", 0],
    ["unknown arity last duplicate", "run, run", "...external", "arguments[1] = true;", 1],
    ["unrelated parameter", "run, other", "false, false", "arguments[1] = true;", 0],
    ["selected parameter", "other, run", "false, false", "arguments[1] = true;", 1],
    ["unknown key", "run, run", "true, false", "arguments[external] = true;", 1],
    [
      "unknown key without a mapped duplicate",
      "run, run",
      "true",
      "arguments[external] = true;",
      0,
    ],
    ["arguments escape", "run, run", "true, false", "external(arguments);", 1],
    ["escape without a mapped duplicate", "run, run", "true", "external(arguments);", 0],
    [
      "aliased earlier duplicate",
      "run, run",
      "true, false",
      "var alias = arguments; alias[0] = true;",
      0,
    ],
    [
      "aliased last duplicate",
      "run, run",
      "true, false",
      "var alias = arguments; alias[1] = true;",
      1,
    ],
    [
      "lexical arrow earlier duplicate",
      "run, run",
      "true, false",
      "(() => { arguments[0] = true; })();",
      0,
    ],
    [
      "lexical arrow last duplicate",
      "run, run",
      "true, false",
      "(() => { arguments[1] = true; })();",
      1,
    ],
    ["known non-index length", "run", "false", "arguments.length = 0;", 0],
    ["known non-index name", "run", "false", "arguments.extra = true;", 0],
    ["noncanonical numeric string", "run", "false", 'arguments["00"] = true;', 0],
    ["negative zero string", "run", "false", 'arguments["-0"] = true;', 0],
    ["zero string", "run", "false", 'arguments["0"] = true;', 1],
    ["numeric negative zero", "run", "false", "arguments[-0] = true;", 1],
    ["known unmapped computed string", "run", "false", "arguments[`1`] = true;", 0],
    [
      "rewritten unknown key",
      "run, run",
      "true, false",
      "var index = 1; arguments[index] = (index = 0, true);",
      1,
    ],
    [
      "saved unmapped receiver",
      "run, run",
      "true, false",
      "arguments[0] = (arguments = [], true);",
      0,
    ],
    [
      "saved mapped receiver",
      "run, run",
      "true, false",
      "arguments[1] = (arguments = [], true);",
      1,
    ],
    ["non-simple default", "run = false", "false", "arguments[0] = true;", 0],
    ["non-simple pattern", "{run}", "{run: false}", "arguments[0] = true;", 0],
    ["non-simple rest", "...run", "false", "arguments[0] = true;", 0],
  ] as const) {
    it(`handles ${name}`, () => cursorCalls(params, args, effect, expected));
  }

  for (const [index, expected] of [
    ["0", 1],
    ["1", 1],
    ["external", 2],
  ] as const) {
    it(`invalidates only the selected scalar among two mapped parameters for ${index}`, () => {
      cursorCalls(
        "run, keep",
        "false, false",
        `keep = false; arguments[${index}] = true; keep &&= gr.next();`,
        expected,
      );
    });
  }

  for (const [outer, inner] of [
    ["", '"use strict";'],
    ['"use strict";', ""],
  ] as const) {
    it(`keeps strict parameters independent for ${outer ? "program" : "function"} directives`, () => {
      cursorFindings(
        `${outer} var gr = new GlideRecord("task"); function use(run) { ${inner} run = false; arguments[0] = true; run &&= gr.next(); } use(false);`,
        0,
      );
    });
  }

  for (const operator of ["++", "+= 1", "= true"]) {
    for (const index of [0, 1]) {
      it(`invalidates only slot ${index} for ${operator}`, () => {
        cursorCalls("run, run", "true, false", `arguments[${index}] ${operator};`, index);
      });
    }
  }

  for (const [params, args, expected] of [
    ["run, run", "true, false", 0],
    ["run, run", "false, true", 1],
    ["run, run", "true", 0],
  ] as const) {
    it(`initializes the duplicate binding from the final position in use(${args})`, () => {
      cursorFindings(
        `var gr = new GlideRecord("task"); function use(${params}) { run &&= gr.next(); } use(${args});`,
        expected,
      );
    });
  }
});
