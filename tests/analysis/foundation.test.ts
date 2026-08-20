import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAnalysisPassCount, resetAnalysisPassCount } from "../../src/analysis/index.js";
import { applyRules } from "../../src/runtime/apply-rules.js";
import { assertInvalid, assertValid, parse } from "../helpers/rule-tester.js";

describe("shared file analysis", () => {
  it("builds lexical and provenance analysis once per source object", () => {
    resetAnalysisPassCount();
    const code = `var gr = new GlideRecord("incident");\ngr.query();\ngr.next();`;
    const parsed = parse(code, "once.br.js");
    applyRules(code, parsed, { filename: "once.br.js" });
    assert.equal(getAnalysisPassCount(), 1);
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
});

describe("path identity and completion", () => {
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
    assertValid(
      `var gr = new GlideRecord("incident");
ready && gr.query();
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

  it("stays silent when a switch path may skip query", () => {
    assertValid(
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
    const messages = applyRules(code, parsed, { filename: "util.js", ruleNames: ["no-unfiltered-gliderecord-bulk-operation"] });
    assert.deepEqual(messages, []);
  });
});
