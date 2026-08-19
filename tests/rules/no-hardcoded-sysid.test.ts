import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertInvalid, assertValid, lint } from "../helpers/rule-tester.js";

const RULE = "no-hardcoded-sysid" as const;
const ID = "97c04b3b1b12100043ab85e5bd0713e2";

describe(RULE, () => {
  it("flags a string literal sys_id", () => {
    assertInvalid(`var id = "${ID}";`, RULE, { messageId: "hardcoded" });
  });

  it("flags a sys_id inside a template literal", () => {
    assertInvalid(`var id = \`${ID}\`;`, RULE, { messageId: "hardcoded" });
  });

  it("allows gs.getProperty", () => {
    assertValid(`var id = gs.getProperty("x_acme.group");`, RULE);
  });

  it("honours allowedSysIds", () => {
    assertValid(`var id = "${ID}";`, RULE, { options: { [RULE]: [{ allowedSysIds: [ID] }] } });
  });

  it("ignores obvious hash bindings by default", () => {
    assertValid(`var md5 = "${ID}";`, RULE);
  });

  it("does not treat uppercase 32-hex as a sys_id", () => {
    assertValid('var f = "D41D8CD98F00B204E9800998ECF8427E";', RULE);
  });

  it("rejects an unknown rule option", () => {
    assert.throws(
      () => lint(`var id = "${ID}";`, RULE, { options: { [RULE]: [{ notARealOption: true }] } }),
      /unknown option/,
    );
  });
});
