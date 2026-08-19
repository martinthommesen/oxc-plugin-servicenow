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
});
