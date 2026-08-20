import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

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

  it("requires an actual stable numeric counter proof", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
var n = 0;
while (gr.next()) {}`,
      RULE,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
var n = 0;
while (gr.next()) { n += calculateRisk(gr); }`,
      RULE,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
var n = 0;
while (gr.next()) { n++; gs.info(gr.number); }`,
      RULE,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
var n = 0;
log(n);
while (gr.next()) { n++; }`,
      RULE,
    );
    assertInvalid(
      `var gr = new GlideRecord("incident");
var n = 0;
while (gr.next()) { ++n; }`,
      RULE,
      { messageId: "iterateCount" },
    );
    assertInvalid(
      `var gr = new GlideRecord("incident");
var n = 0;
while (gr.next()) { n += 1; }`,
      RULE,
      { messageId: "iterateCount" },
    );
  });

  it("does not flag a loop that reads fields", () => {
    assertValid(
      `var gr = new GlideRecord("incident");\ngr.query();\nwhile (gr.next()) {\n  gs.info(gr.number);\n}`,
      RULE,
    );
  });
});
