import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ESTree } from "@oxlint/plugins";
import { getAnalysisPassCount, resetAnalysisPassCount } from "../../src/analysis/internal.js";
import { buildScopeTree } from "../../src/analysis/bindings.js";
import {
  getPathBudgetExceededCount,
  resetPathBudgetExceededCount,
} from "../../src/analysis/path-state.js";
import { applyRules } from "../../src/runtime/apply-rules.js";
import { walk } from "../../src/utils/ast.js";
import { ctorProvenanceKind } from "../../src/analysis/provenance.js";
import { assertInvalid, assertValid, lint, parse } from "../helpers/rule-tester.js";

describe("shared file analysis", () => {
  it("returns no provenance kind for Object.prototype member names (FINDINGS.md MNT-003)", () => {
    for (const name of ["constructor", "toString", "valueOf", "__proto__", "hasOwnProperty"]) {
      assert.equal(ctorProvenanceKind(name), null);
    }
    assert.equal(ctorProvenanceKind("GlideRecord"), "GlideRecord");
    assert.equal(ctorProvenanceKind("GlideRecordSecure"), "GlideRecord");
  });

  it("coalesces duplicate var declarations into one ordered binding", () => {
    const parsed = parse("var rec; var rec = 1;", "duplicates.js");
    const binding = buildScopeTree(parsed.ast as unknown as ESTree.Node).root?.bindings.get("rec");
    assert.ok(binding);
    assert.equal(binding.declarations.length, 2);
    assert.equal(binding.declarations[0]?.start, 4);
    assert.equal(binding.declarations[1]?.start, 13);
  });

  it("keeps static-block var declarations inside the static block", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
class Cache {
  static { var rec = {}; }
}
rec.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("builds lexical and provenance analysis once per source object", () => {
    resetAnalysisPassCount();
    const code = `var gr = new GlideRecord("incident");\ngr.query();\ngr.next();`;
    const parsed = parse(code, "once.br.js");
    applyRules(code, parsed, { filename: "once.br.js" });
    assert.equal(getAnalysisPassCount(), 1);
  });

  it("keeps cached analysis distinct for each filename", () => {
    resetAnalysisPassCount();
    const code = `var gr = new GlideRecord("incident");\ncurrent.update();`;
    const parsed = parse(code, "shared.js");
    assert.equal(
      applyRules(code, parsed, { filename: "form.client.js", ruleNames: ["no-client-gliderecord"] })
        .length,
      1,
    );
    assert.equal(
      applyRules(code, parsed, { filename: "incident.br.js", ruleNames: ["no-br-current-update"] })
        .length,
      1,
    );
    assert.equal(getAnalysisPassCount(), 2);
  });

  it("keeps sibling aliases after one name is reassigned", () => {
    assertInvalid(
      `var ajax = new GlideAjax("UserLookup");
var original = ajax;
ajax = {};
original.getAnswer();`,
      "no-glideajax-getanswer",
      { messageId: "getAnswer" },
      { filename: "form.client.js" },
    );
  });

  it("does not let a later reassignment change an earlier use", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
gr.next();
gr = {};`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("does not let a later closure capture change an earlier use", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
rec.next();
var later = function () { return rec; };`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("does not execute an uncalled capturing function", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
function openLater() { rec.query(); }
rec.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("propagates direct helper effects at invocation time", () => {
    assertValid(
      `function open(record) { record.query(); }
var rec = new GlideRecord("incident");
open(rec);
rec.next();`,
      "require-query-before-next",
    );
  });

  it("binds fresh records into directly invoked helpers", () => {
    assertInvalid(
      `function read(record) { record.next(); }
read(new GlideRecord("incident"));`,
      "require-query-before-next",
      { messageId: "missingQuery", count: 1 },
    );
  });

  it("keeps direct helper invocations state-specific", () => {
    assertInvalid(
      `function read(record) { record.next(); }
var ready = new GlideRecord("incident");
ready.query();
read(ready);
var unopened = new GlideRecord("problem");
read(unopened);`,
      "require-query-before-next",
      { messageId: "missingQuery", count: 1 },
    );
  });

  it("escapes closure captures only when the closure escapes", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
rec.next();
var later = function () { rec.query(); };
handoff(later);
rec.next();`,
      "require-query-before-next",
      { messageId: "missingQuery", count: 1 },
    );
  });

  it("does not treat a default parameter as an outer escape", () => {
    assertInvalid(
      `function wrap(rec = other) {
  return rec;
}
var rec = new GlideRecord("incident");
rec.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("marks destructuring of a record as escaped", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
var { sys_id } = rec;
rec.next();`,
      "require-query-before-next",
    );
  });

  it("does not treat a shadowed parameter as an outer escape", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
function identity(gr) {
  return gr;
}
gr.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("does not let a for-of binding shadow GlideRecord after the loop", () => {
    assertInvalid(
      `for (let GlideRecord of constructors) {
  inspect(GlideRecord);
}
var gr = new GlideRecord("incident");
gr.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("keeps named function-expression bindings inside the function", () => {
    assertInvalid(
      `var local = function GlideRecord() {
  var inner = new GlideRecord("problem");
  inner.next();
};
var outer = new GlideRecord("incident");
outer.next();`,
      "require-query-before-next",
      { messageId: "missingQuery", count: 1 },
    );
  });

  it("keeps named class-expression bindings inside the class", () => {
    assertInvalid(
      `var Local = class GlideRecord {
  read() {
    var inner = new GlideRecord("problem");
    inner.next();
  }
};
var outer = new GlideRecord("incident");
outer.next();`,
      "require-query-before-next",
      { messageId: "missingQuery", count: 1 },
    );
  });
});

describe("path identity and completion", () => {
  it("prunes branches behind constant conditions (FINDINGS.md COR-003)", () => {
    const RULE = "require-query-before-next" as const;
    const SERVER = { filename: "a.br.js" };
    const gr = 'var gr = new GlideRecord("x");';
    // Constant-true: the query always runs, the impossible false path is gone.
    assertValid(`${gr} if (true) { gr.query(); } while (gr.next()) {}`, RULE, SERVER);
    assertValid(`${gr} if (1) { gr.query(); } while (gr.next()) {}`, RULE, SERVER);
    assertValid(`${gr} if (!false) { gr.query(); } while (gr.next()) {}`, RULE, SERVER);
    assertValid(`${gr} true ? gr.query() : null; while (gr.next()) {}`, RULE, SERVER);
    assertValid(`${gr} if (false) {} else { gr.query(); } while (gr.next()) {}`, RULE, SERVER);
    assertValid(`${gr} true && gr.query(); while (gr.next()) {}`, RULE, SERVER);
    assertValid(`${gr} false || gr.query(); while (gr.next()) {}`, RULE, SERVER);
    // Constant-false: the query can never run.
    assertInvalid(`${gr} if (false) { gr.query(); } while (gr.next()) {}`, RULE, {}, SERVER);
    assertInvalid(`${gr} false && gr.query(); while (gr.next()) {}`, RULE, {}, SERVER);
    // Unknown conditions keep the every-path contract.
    assertInvalid(`${gr} if (c) { gr.query(); } while (gr.next()) {}`, RULE, {}, SERVER);
  });

  it("keeps diagnostics invariant under sibling-branch reordering (FINDINGS.md COR-003)", () => {
    const RULE = "require-query-before-next" as const;
    const SERVER = { filename: "a.br.js" };
    const forward = `var gr; if (c) { gr = new GlideRecord("a"); gr.query(); } else { gr = new GlideRecord("b"); gr.query(); } while (gr.next()) {}`;
    const reversed = `var gr; if (c) { gr = new GlideRecord("b"); gr.query(); } else { gr = new GlideRecord("a"); gr.query(); } while (gr.next()) {}`;
    assert.equal(lint(forward, RULE, SERVER).length, lint(reversed, RULE, SERVER).length);
  });

  it("keeps the return completion through finally (FINDINGS.md COR-003)", () => {
    const RULE = "require-query-before-next" as const;
    const SERVER = { filename: "a.br.js" };
    // The fallthrough path always queried; the return path never reaches next.
    assertValid(
      `function f(c) {
  var gr = new GlideRecord("x");
  try {
    if (c) { return null; }
    gr.query();
  } finally { gs.info(1); }
  while (gr.next()) {}
}
f(true);`,
      RULE,
      SERVER,
    );
  });

  it("caps generic AST traversal depth", () => {
    let node: Record<string, unknown> = { type: "Identifier", name: "value" };
    for (let depth = 0; depth < 1_000; depth += 1) {
      node = { type: "ExpressionStatement", expression: node };
    }
    let visited = 0;
    walk(node, { ExpressionStatement: () => (visited += 1) });
    assert.equal(visited, 512);
  });

  it("degrades pathological nested loops to unknown within the work budget", () => {
    resetPathBudgetExceededCount();
    const code = `var rec = new GlideRecord("incident");\n${"while (flag) {".repeat(400)}rec.next();${"}".repeat(400)}`;
    const started = Date.now();
    applyRules(code, parse(code, "nested.br.js"), {
      filename: "nested.br.js",
      ruleNames: ["require-query-before-next"],
    });
    assert.ok(getPathBudgetExceededCount() > 0);
    assert.ok(Date.now() - started < 5_000, "path analysis exceeded five seconds");
  });

  it("shares query state across aliases", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
var alias = gr;
gr.query();
alias.next();`,
      "require-query-before-next",
    );
  });

  it("does not treat a short-circuit query as definite", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
ready && gr.query();
gr.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("lets a definite query recover after a branch join", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
if (preload) gr.query();
gr.query();
gr.next();`,
      "require-query-before-next",
    );
  });

  it("reports next on the unopened path after an early return", () => {
    assertInvalid(
      `function run(ready) {
  var gr = new GlideRecord("incident");
  if (ready) {
    gr.query();
    return;
  }
  gr.next();
}`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("still reports when an unrelated nested function exists", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
function unrelated() {
  return 42;
}
gr.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("does not merge different branch objects as one identity", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
if (flag) {
  gr = new GlideRecord("problem");
}
gr.deleteMultiple();`,
      "no-unfiltered-gliderecord-bulk-operation",
    );
  });

  it("preserves alias identity across a no-op join", () => {
    assertValid(
      `var gr = new GlideRecord("task");
var alias = gr;
if (debug) {
  gs.info("debug");
}
gr.addQuery("active", true);
alias.deleteMultiple();`,
      "no-unfiltered-gliderecord-bulk-operation",
    );
  });

  it("does not treat a block-scoped record as the outer binding", () => {
    assertValid(
      `var gr = { deleteMultiple: function () {} };
{
  let gr = new GlideRecord("task");
}
gr.deleteMultiple();`,
      "no-unfiltered-gliderecord-bulk-operation",
    );
  });

  it("marks object and array storage as escaped", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
var bag = { rec: rec };
var list = [rec];
rec.next();`,
      "require-query-before-next",
    );
  });

  it("reports when a switch path may skip query", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
switch (mode) {
  case "ready":
    rec.query();
    break;
}
rec.next();`,
      "require-query-before-next",
    );
  });

  it("reports next after a switch that never queries", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
switch (mode) {
  case "ready":
    gs.info("ready");
    break;
}
rec.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("marks a stored inline constructor as escaped", () => {
    assertValid(
      `var rec;
var bag = { rec: (rec = new GlideRecord("incident")) };
rec.next();`,
      "require-query-before-next",
    );
  });

  it("retains loop-test side effects on the zero-iteration path", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
while ((rec.query(), false)) {}
rec.next();`,
      "require-query-before-next",
    );
  });

  it("executes a for update after continue", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
rec.query();
for (; rec.next(); rec.query()) {
  continue;
}
rec.next();`,
      "require-query-before-next",
    );
  });

  it("executes a do-while test after continue", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
do {
  continue;
} while ((rec.query(), false));
rec.next();`,
      "require-query-before-next",
    );
  });

  it("reaches a loop fixed point before evaluating later iterations", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
rec.query();
while (more) {
  rec.next();
  rec.addQuery("active", true);
}`,
      "no-gliderecord-query-modifier-after-query",
      { messageId: "lateModifier", count: 1 },
    );
  });

  it("preserves object identity through equivalent expression results", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
var conditional = flag ? rec : rec;
var logical = rec && rec;
var sequence = (sideEffect(), rec);
var assigned;
(assigned = rec).query();
conditional.query();
logical.next();
sequence.next();
assigned.next();`,
      "require-query-before-next",
    );
  });

  it("does not infer identity through a fallback-only logical result", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
var alias = flag || rec;
alias.next();`,
      "require-query-before-next",
    );
  });

  it("evaluates call arguments before applying the outer call", () => {
    assertValid(
      `var ajax = new GlideAjax("Lookup");
ajax.getXMLAnswer(ajax.addParam("sysparm_name", "lookup"));`,
      "require-glideajax-sysparm-name",
      { filename: "form.client.js" },
    );
  });

  it("evaluates computed assignment targets", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
cache[rec.query()] = true;
rec.next();`,
      "require-query-before-next",
    );
  });

  it("does not treat a logical-assignment right side as definite", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
ready &&= rec.query();
rec.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("does not treat a destructuring default as definite", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
var { value = rec.query() } = source;
rec.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("evaluates computed destructuring keys before the binding write", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
var { [rec.query()]: value } = source;
rec.next();`,
      "require-query-before-next",
    );
  });

  it("does not erase a value for an uninitialized var redeclaration", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
var rec;
rec.deleteMultiple();`,
      "no-unfiltered-gliderecord-bulk-operation",
      { messageId: "unfiltered" },
    );
  });

  it("invalidates an existing for-of assignment target", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
for (rec of records) {}
rec.deleteMultiple();`,
      "no-unfiltered-gliderecord-bulk-operation",
    );
  });

  it("does not fabricate a catch path when no handler exists", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
try {
  rec.query();
} finally {}
rec.next();`,
      "require-query-before-next",
    );
  });

  it("runs a catch handler only for a reachable throw", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
try {
  throw (rec.query(), new Error("stop"));
} catch (error) {}
rec.next();`,
      "require-query-before-next",
    );
  });

  it("does not run a catch handler on a normal-only path", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
try {
  rec.query();
} catch (error) {
  rec = new GlideRecord("problem");
}
rec.next();`,
      "require-query-before-next",
    );
  });

  it("lets an abrupt finalizer override an earlier normal completion", () => {
    assertValid(
      `function run() {
  var rec = new GlideRecord("incident");
  try {
    rec.query();
  } finally {
    return;
  }
  rec.next();
}`,
      "require-query-before-next",
    );
  });

  it("preserves an earlier abrupt completion through a normal finalizer", () => {
    assertValid(
      `function run() {
  var rec = new GlideRecord("incident");
  try {
    return;
  } finally {
    rec.query();
  }
  rec.next();
}`,
      "require-query-before-next",
    );
  });

  it("accepts an exhaustive switch when every case opens the cursor", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
switch (mode) {
  case "one":
    rec.query();
    break;
  default:
    rec.query();
}
rec.next();`,
      "require-query-before-next",
    );
  });

  it("keeps switch fallthrough entry paths distinct", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
switch (mode) {
  case "one":
    rec.query();
  default:
    rec.next();
}`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("keeps code after an exhaustive abrupt switch unreachable", () => {
    assertValid(
      `function run(mode) {
  var rec = new GlideRecord("incident");
  switch (mode) {
    case "ready":
      return rec.query();
    default:
      throw new Error("unsupported");
  }
  rec.next();
}`,
      "require-query-before-next",
    );
  });

  it("continues after a break consumed by its label", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
done: {
  break done;
}
rec.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("keeps code after a provably infinite loop unreachable", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
while (true) {}
rec.next();`,
      "require-query-before-next",
    );
  });

  it("analyzes one finally body across normal and return paths", () => {
    assertInvalid(
      `function run(stop) {
  var rec = new GlideRecord("incident");
  try {
    if (stop) return;
  } finally {
    rec.next();
  }
}`,
      "require-query-before-next",
      { messageId: "missingQuery", count: 1 },
    );
  });
});

describe("unknown context", () => {
  it("does not classify comments or strings as client", () => {
    assertInvalid(
      `// Documentation: g_form exists only in client scripts.
var gr = new GlideRecord("task");
gr.deleteMultiple();`,
      "no-unfiltered-gliderecord-bulk-operation",
      { messageId: "unfiltered" },
      { filename: "src/server/util.js" },
    );
  });

  it("stays silent on ordinary JavaScript without ServiceNow context", () => {
    const code = `var gr = new GlideRecord("task");\ngr.deleteMultiple();`;
    const parsed = parse(code, "util.js");
    const messages = applyRules(code, parsed, {
      filename: "util.js",
      ruleNames: ["no-unfiltered-gliderecord-bulk-operation"],
    });
    assert.deepEqual(messages, []);
  });
});
