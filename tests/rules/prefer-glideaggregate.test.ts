import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertInvalid, assertValid, lint } from "../helpers/rule-tester.js";

const RULE = "prefer-glideaggregate" as const;

describe(RULE, () => {
  it("flags getRowCount", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");\ngr.query();\nvar n = gr.getRowCount();`,
      RULE,
      { messageId: "getRowCount" },
    );
  });

  it("flags getRowCount on GlideRecordSecure", () => {
    assertInvalid(
      `var gr = new GlideRecordSecure("incident");\ngr.query();\nvar n = gr.getRowCount();`,
      RULE,
      { messageId: "getRowCount" },
    );
  });

  it("allows GlideAggregate", () => {
    assertValid(
      `var ga = new GlideAggregate("incident");\nga.addAggregate("COUNT");\nga.query();`,
      RULE,
    );
  });

  it("flags iterate-to-count loops", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");\ngr.query();\nvar n = 0;\nwhile (gr.next()) { n++; }`,
      RULE,
      { messageId: "iterateCount" },
    );
  });

  it("does not treat if (gr.next()) as iterate-to-count", () => {
    assertValid(
      `var gr = new GlideRecord("incident");\ngr.query();\nif (gr.next()) {\n  gs.info(gr.number);\n}`,
      RULE,
    );
  });

  it("does not flag a loop that reads fields", () => {
    assertValid(
      `var gr = new GlideRecord("incident");\ngr.query();\nwhile (gr.next()) {\n  gs.info(gr.number);\n}`,
      RULE,
    );
  });

  it("allows post-loop reads and reports each count-only loop", () => {
    const code = `var first = new GlideRecord("incident");
var firstCount = 0;
while (first.next()) firstCount++;
gs.info(firstCount);
var second = new GlideRecord("task");
var secondCount = 0;
while (second.next()) secondCount += 1;
gs.info(secondCount);`;
    assert.equal(
      lint(code, RULE).filter((message) => message.messageId === "iterateCount").length,
      2,
    );
  });
});
