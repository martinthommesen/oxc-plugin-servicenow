import { describe, it } from "node:test";
import { assertValid } from "../helpers/rule-tester.js";

describe("stateful lifecycle regressions", () => {
  it("lets an unconditional query restore the cursor state", () => {
    assertValid(
      `var gr = new GlideRecord("incident"); if (ready) gr.query(); gr.query(); gr.next();`,
      "require-query-before-next",
    );
  });
});
