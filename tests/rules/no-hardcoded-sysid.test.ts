import { ruleTester } from "../helpers/rule-tester.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lint } from "../helpers/rule-tester.js";

const RULE = "no-hardcoded-sysid" as const;
const ID = "97c04b3b1b12100043ab85e5bd0713e2";

describe(RULE, () => {
  const { expectInvalid, expectActive, expectValid } = ruleTester(
    "no-hardcoded-sysid",
    {},
    { messageId: "hardcoded" },
  );

  it("flags a string literal sys_id", () => void expectInvalid(`var id = "${ID}";`));

  it("flags a sys_id inside a template literal", () => void expectInvalid(`var id = \`${ID}\`;`));

  // @lat: [[tests#Analysis behavior#Template tokens require known boundaries]]
  it("checks static template runs after unknown interpolations", () => {
    for (const code of [
      `var url = \`\${prefix}/${ID}\`;`,
      `var url = \`\${prefix}/${ID}/\${suffix}\`;`,
      `var url = \`\${prefix}/\${middle}/${ID}\`;`,
      'var url = `${prefix}/97c04b3b${"1b12100043ab85e5bd0713e2"}`;',
    ]) {
      expectInvalid(code, { messageId: "hardcoded", count: 1 });
    }
  });

  it("requires known token boundaries at dynamic template edges", () => {
    for (const code of [
      `var url = \`\${prefix}${ID}\`;`,
      `var url = \`${ID}\${suffix}\`;`,
      `var url = \`\${prefix}${ID}\${suffix}\`;`,
      "var url = `97c04b3b${unknown}1b12100043ab85e5bd0713e2`;",
    ]) {
      expectActive(code);
    }
    expectInvalid(`var url = \`${ID}/\${suffix}\`;`, { messageId: "hardcoded", count: 1 });
    expectInvalid(`var digest = \`\${prefix}/${ID}\`;`, { messageId: "hardcoded", count: 1 });
  });

  it("allows gs.getProperty", () => void expectValid(`var id = gs.getProperty("x_acme.group");`));

  it("honours allowedSysIds", () =>
    void expectValid(`var id = "${ID}";`, { options: { [RULE]: [{ allowedSysIds: [ID] }] } }));

  it("ignores obvious hash bindings by default", () => void expectActive(`var md5 = "${ID}";`));

  it("ignores every digest-like binding name by default (FINDINGS.md COR-002)", () => {
    for (const name of [
      "checksum",
      "digest",
      "etag",
      "fileHash",
      "sha1Value",
      "sha256Digest",
      "contentChecksum",
      "MD5_SUM",
    ]) {
      expectActive(`var ${name} = "${ID}";`);
    }
    expectActive(`var payload = { checksum: "${ID}" };`);
  });

  it("does not suppress a sys_id for a name without a digest word", () =>
    void expectInvalid(`var groupId = "${ID}";`));

  it("does not treat a digest word inside a name component as a digest (FINDINGS.md COR-008)", () => {
    for (const name of ["sharedSysId", "shardId", "betaGroupId", "shadowRecordId", "dashboardId"]) {
      expectInvalid(`var ${name} = "${ID}";`);
      expectInvalid(`var payload = { ${name}: "${ID}" };`);
    }
  });

  it("resolves hash owners structurally across nested sibling expressions", () => {
    expectValid(`var expectedMd5 = choose({ encoding: "hex" }, "${ID}");`);
    expectValid(`hashes.md5 = choose({ encoding: "hex" }, "${ID}");`);
  });

  it("uses the nearest value owner", () => {
    expectInvalid(`var md5 = { sys_id: "${ID}" };`);
    expectInvalid(`hashes.md5 = { sys_id: "${ID}" };`);
  });

  it("does not inherit a hash owner across an execution boundary", () => {
    expectInvalid(`var md5 = function () {
  return "${ID}";
};`);
    expectInvalid(`var md5 = class {
  value() {
    return "${ID}";
  }
};`);
  });

  it("recognizes direct and member assignment owners", () => {
    expectValid(`md5 = "${ID}";`);
    expectValid(`hashes.md5 = "${ID}";`);
    expectInvalid(`record.sys_id = "${ID}";`);
  });

  it("recognizes parameter-default and class-field owners without guessing dynamic keys", () => {
    expectValid(`function digest(md5 = "${ID}") { return md5; }`);
    expectInvalid(`function lookup(sysId = "${ID}") { return sysId; }`);
    expectValid(`class Digests { md5 = "${ID}"; }`);
    expectValid(`class Digests { ["md5"] = "${ID}"; }`);
    expectInvalid(`var md5 = "u_target_field";
class Configuration { [md5] = "${ID}"; }`);
  });

  it("does not inherit a hash owner into a static block", () =>
    void expectInvalid(`var md5 = class {
  static { consume("${ID}"); }
};`));

  it("can disable hash-name suppression", () =>
    void expectInvalid(`var md5 = "${ID}";`, undefined, {
      options: { [RULE]: [{ ignoreHashNames: false }] },
    }));

  it("flags uppercase sys_ids", () =>
    void expectInvalid('var f = "D41D8CD98F00B204E9800998ECF8427E";'));

  it("flags statically assembled sys_ids", () => {
    expectInvalid('var id = "97c04b3b" + "1b121000" + "43ab85e5" + "bd0713e2";', {
      messageId: "hardcoded",
      count: 1,
    });
    expectInvalid('var id = `97c04b3b${"1b12100043ab85e5bd0713e2"}`;', {
      messageId: "hardcoded",
      count: 1,
    });
  });

  it("applies hash-owner suppression to statically assembled values", () => {
    expectValid('var md5 = "97c04b3b" + "1b121000" + "43ab85e5" + "bd0713e2";');
    expectValid('var md5 = `97c04b3b${"1b12100043ab85e5bd0713e2"}`;');
  });

  it("reports template quasi and interpolation sys_ids independently", () => {
    const other = "46f3e38e2f7710004f58e7d9d5d0e0b8";
    expectInvalid(`var id = \`${ID}-\${"${other}"}\`;`, {
      messageId: "hardcoded",
      count: 2,
    });
  });

  it("reports a cross-boundary sys_id beside a complete child sys_id", () =>
    void expectInvalid(`var id = "${ID}" + "-97c04b3b" + "1b12100043ab85e5bd0713e2";`, {
      messageId: "hardcoded",
      count: 2,
    }));

  it("suppresses a generic hash-like name by default and reports when disabled", () => {
    expectValid(`var userHash = "${ID}";`);
    expectInvalid(`var userHash = "${ID}";`, undefined, {
      options: { [RULE]: [{ ignoreHashNames: false }] },
    });
  });

  it("rejects an unknown rule option", () =>
    void assert.throws(
      () => lint(`var id = "${ID}";`, RULE, { options: { [RULE]: [{ notARealOption: true }] } }),
      /unknown option/,
    ));
});
