import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lint } from "../helpers/rule-tester.js";

const RULE = "prefer-glideaggregate" as const;

describe(RULE, () => {
  const { expectInvalid, expectActive } = ruleTester(
    "prefer-glideaggregate",
    {},
    { messageId: "iterateCount" },
  );

  it("flags getRowCount", () =>
    void expectInvalid(
      `var gr = new GlideRecord("incident");\ngr.query();\nvar n = gr.getRowCount();`,
      {
        messageId: "getRowCount",
      },
    ));

  it("flags getRowCount on GlideRecordSecure", () =>
    void expectInvalid(
      `var gr = new GlideRecordSecure("incident");\ngr.query();\nvar n = gr.getRowCount();`,
      { messageId: "getRowCount" },
    ));

  it("allows GlideAggregate", () =>
    void expectActive(
      `var ga = new GlideAggregate("incident");\nga.addAggregate("COUNT");\nga.query();`,
    ));

  it("flags iterate-to-count loops", () => {
    expectInvalid(
      `var gr = new GlideRecord("incident");\ngr.query();\nvar n = 0;\nwhile (gr.next()) { n++; }`,
    );
    expectInvalid(`var gr = new GlideRecord("incident");
gr._query();
var n = 0;
while (gr["_next"]()) { n++; }`);
  });

  it("does not treat if (gr.next()) as iterate-to-count", () =>
    void expectActive(
      `var gr = new GlideRecord("incident");\ngr.query();\nif (gr.next()) {\n  gs.info(gr.number);\n}`,
    ));

  it("requires an actual stable numeric counter proof", () => {
    expectActive(`var gr = new GlideRecord("incident");
var n = 0;
while (gr.next()) {}`);
    expectActive(`var gr = new GlideRecord("incident");
var n = 0;
while (gr.next()) { n += calculateRisk(gr); }`);
    expectActive(`var gr = new GlideRecord("incident");
var n = 0;
while (gr.next()) { n++; gs.info(gr.number); }`);
    expectActive(`var gr = new GlideRecord("incident");
var n = 0;
log(n);
while (gr.next()) { n++; }`);
    expectInvalid(`var gr = new GlideRecord("incident");
var n = 0;
while (gr.next()) { ++n; }`);
    expectInvalid(`var gr = new GlideRecord("incident");
var n = 0;
while (gr.next()) { n += 1; }`);
  });

  it("does not flag a loop that reads fields", () =>
    void expectActive(
      `var gr = new GlideRecord("incident");\ngr.query();\nwhile (gr.next()) {\n  gs.info(gr.number);\n}`,
    ));

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
