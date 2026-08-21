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

  it("flags uppercase sys_ids", () => {
    assertInvalid('var f = "D41D8CD98F00B204E9800998ECF8427E";', RULE, {
      messageId: "hardcoded",
    });
  });

  it("flags statically assembled sys_ids", () => {
    assertInvalid('var id = "97c04b3b" + "1b121000" + "43ab85e5" + "bd0713e2";', RULE, {
      messageId: "hardcoded",
      count: 1,
    });
    assertInvalid('var id = `97c04b3b${"1b12100043ab85e5bd0713e2"}`;', RULE, {
      messageId: "hardcoded",
      count: 1,
    });
  });

  it("reports template quasi and interpolation sys_ids independently", () => {
    const other = "46f3e38e2f7710004f58e7d9d5d0e0b8";
    assertInvalid(`var id = \`${ID}-\${"${other}"}\`;`, RULE, {
      messageId: "hardcoded",
      count: 2,
    });
  });

  it("reports a cross-boundary sys_id beside a complete child sys_id", () => {
    assertInvalid(
      `var id = "${ID}" + "-97c04b3b" + "1b12100043ab85e5bd0713e2";`,
      RULE,
      { messageId: "hardcoded", count: 2 },
    );
  });

  it("does not suppress a sys_id for a generic hash-like name", () => {
    assertInvalid(`var userHash = "${ID}";`, RULE, { messageId: "hardcoded" });
  });

  it("rejects an unknown rule option", () => {
    assert.throws(
      () => lint(`var id = "${ID}";`, RULE, { options: { [RULE]: [{ notARealOption: true }] } }),
      /unknown option/,
    );
  });
});
