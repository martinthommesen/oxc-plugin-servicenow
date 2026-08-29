import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-unfiltered-gliderecord-bulk-operation";

// A for-in or for-of head rebinds its declared name on every iteration, so a
// tracked GlideRecord shadowed by the loop variable must not keep its object
// identity inside the body, whatever the declaration kind. The `var` form
// regressed because a bare `var` declarator is a runtime no-op
// (FINDINGS.md COR-013).
describe("loop-head rebinding (FINDINGS.md COR-013)", () => {
  it("does not carry a tracked object into a shadowing for-of body", () => {
    assertValid("var gr = new GlideRecord('task');\nfor (var gr of items) { gr.deleteMultiple(); }", RULE);
    assertValid("var gr = new GlideRecord('task');\nfor (let gr of items) { gr.deleteMultiple(); }", RULE);
    assertValid("var gr = new GlideRecord('task');\nfor (var gr in items) { gr.deleteMultiple(); }", RULE);
  });

  it("still reports the unshadowed bulk operation", () => {
    assertInvalid("var gr = new GlideRecord('task');\ngr.deleteMultiple();", RULE);
  });

  it("does not analyze code after an infinite do-while as reachable", () => {
    assertValid(
      "var gr = new GlideRecord('incident');\ndo { gs.info(1); } while (true);\ngr.next();",
      "require-query-before-next",
    );
    assertInvalid(
      "var gr = new GlideRecord('incident');\ndo { gs.info(1); } while (cond);\ngr.next();",
      "require-query-before-next",
    );
  });
});
