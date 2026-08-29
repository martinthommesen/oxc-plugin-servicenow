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

  it("ignores every digest-like binding name by default (FINDINGS.md COR-002)", () => {
    for (const name of ["checksum", "digest", "etag", "fileHash", "sha1Value"]) {
      assertValid(`var ${name} = "${ID}";`, RULE);
    }
    assertValid(`var payload = { checksum: "${ID}" };`, RULE);
  });

  it("reports digest-named values when ignoreHashNames is false", () => {
    for (const name of ["md5", "checksum"]) {
      assertInvalid(`var ${name} = "${ID}";`, RULE, { messageId: "hardcoded" }, {
        options: { [RULE]: [{ ignoreHashNames: false }] },
      });
    }
  });

  it("keeps the enclosing digest name after a nested property exits", () => {
    assertValid(`var checksum = [{ note: 1 }, "${ID}"];`, RULE);
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

  it("does not suppress a sys_id for a name without a digest word", () => {
    assertInvalid(`var groupId = "${ID}";`, RULE, { messageId: "hardcoded" });
  });

  it("rejects an unknown rule option", () => {
    assert.throws(
      () => lint(`var id = "${ID}";`, RULE, { options: { [RULE]: [{ notARealOption: true }] } }),
      /unknown option/,
    );
  });
});
