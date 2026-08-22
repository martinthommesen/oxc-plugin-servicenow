import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

describe("stateful lifecycle regressions", () => {
  it("lets an unconditional query restore the cursor state", () => {
    assertValid(
      `var gr = new GlideRecord("incident"); if (ready) gr.query(); gr.query(); gr.next();`,
      "require-query-before-next",
    );
  });

  it("keeps deleteRecord return checking in the compatibility rule", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident"); gr.deleteRecord();`,
      "validate-gliderecord-calls",
      { messageId: "unusedReturn" },
    );
  });
});
