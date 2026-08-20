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
