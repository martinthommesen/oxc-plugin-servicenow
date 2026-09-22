import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

describe("path budget exhaustion signal (FINDINGS.md PER-006)", () => {
  it("marks the shared analysis exhausted when the work budget fires", () => {
    const code = `var rec = new GlideRecord("incident");\n${"while (flag) {".repeat(400)}rec.next();${"}".repeat(400)}`;
    const started = Date.now();
    const { messages, analysis } = lintWithAnalysis(code, "require-query-before-next", {
      filename: "nested.br.js",
    });
    assert.equal(analysis.pathBudgetExhausted, true);
    assert.deepEqual(messages, []);
    assert.ok(Date.now() - started < 5_000, "path analysis exceeded five seconds");
  });

  it("leaves the flag clear on an ordinary completely analyzed file", () => {
    const { messages, analysis } = lintWithAnalysis(
      `var rec = new GlideRecord("incident");\nrec.query();\nrec.next();`,
      "require-query-before-next",
      { filename: "incident.br.js" },
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.deepEqual(messages, []);
  });
});
