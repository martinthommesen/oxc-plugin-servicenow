import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-gliderecord-query-in-acl" as const;
const ACL = { filename: "incident.acl.js" } as const;

describe("no-gliderecord-query-in-acl", () => {
  it("reports documented GlideRecord query executors", () => {
    for (const method of ["query", "_query", "get"] as const) {
      assertInvalid(
        `var user = new GlideRecord("sys_user");
user.${method}("abc");`,
        RULE,
        { messageId: "query", includes: method },
        ACL,
      );
    }
  });

  it("reports GlideRecordSecure and GlideAggregate queries", () => {
    assertInvalid(
      `var user = new GlideRecordSecure("sys_user");
user.query();`,
      RULE,
      { messageId: "query", includes: "GlideRecord" },
      ACL,
    );
    assertInvalid(
      `var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
count.query();`,
      RULE,
      { messageId: "query", includes: "GlideAggregate" },
      ACL,
    );
  });

  it("tracks aliases, static computed members, and all-path object joins", () => {
    assertInvalid(
      `var user = new GlideRecord("sys_user");
var record = user;
record["query"]();`,
      RULE,
      { messageId: "query" },
      ACL,
    );
    assertInvalid(
      `var record;
if (active) record = new GlideRecord("incident");
else record = new GlideRecord("task");
record.query();`,
      RULE,
      { messageId: "query" },
      ACL,
    );
  });

  it("follows directly invoked helpers with call-time aliases", () => {
    assertInvalid(
      `function load(record) { record.query(); }
var user = new GlideRecord("sys_user");
load(user);`,
      RULE,
      { messageId: "query" },
      ACL,
    );
    assertInvalid(
      `(function (record) { record.get("abc"); })(new GlideRecord("sys_user"));`,
      RULE,
      { messageId: "query" },
      ACL,
    );
  });

  it("uses filename and explicit ACL surface evidence", () => {
    for (const filename of [
      "read.acl.js",
      "incident.access-control.cjs",
      "sys_security_acl_read.mjs",
      "src/access-controls/read.js",
    ]) {
      assertInvalid(
        `var user = new GlideRecord("sys_user"); user.query();`,
        RULE,
        { messageId: "query" },
        { filename },
      );
    }
    assertInvalid(
      `var user = new GlideRecord("sys_user"); user.query();`,
      RULE,
      { messageId: "query" },
      { filename: "exported-script.js", settings: { surfaces: ["acl"] } },
    );
  });

  it("recognizes global-only queryNoDomain only with proven scope and release", () => {
    const code = `var user = new GlideRecord("sys_user"); user.queryNoDomain();`;
    assertInvalid(
      code,
      RULE,
      { messageId: "query" },
      {
        ...ACL,
        settings: { scope: "global", release: "australia" },
      },
    );
    assertValid(code, RULE, {
      ...ACL,
      settings: { scope: "unknown", release: "australia" },
    });
    assertValid(code, RULE, {
      ...ACL,
      settings: { scope: "scoped", release: "australia" },
    });
  });

  it("stays silent outside a known ACL surface", () => {
    const code = `var user = new GlideRecord("sys_user"); user.query();`;
    assertValid(code, RULE, { filename: "helper.server.js" });
    assertValid(code, RULE, { filename: "unknown.js" });
    assertValid(code, RULE, { filename: "table.now.ts" });
  });

  it("ignores unrelated and shadowed constructors", () => {
    assertValid(`var user = { query: function () {} }; user.query();`, RULE, ACL);
    assertValid(
      `function GlideRecord() { this.query = function () {}; }
var user = new GlideRecord("sys_user");
user.query();`,
      RULE,
      ACL,
    );
    assertValid(
      `function check(GlideAggregate) {
  var count = new GlideAggregate("incident");
  count.query();
}
check(LocalAggregate);`,
      RULE,
      ACL,
    );
  });

  it("stays silent after reassignment or escape", () => {
    assertValid(
      `var user = new GlideRecord("sys_user");
user = customRecord;
user.query();`,
      RULE,
      ACL,
    );
    assertValid(
      `var user = new GlideRecord("sys_user");
prepare(user);
user.query();`,
      RULE,
      ACL,
    );
    assertValid(
      `var user = new GlideRecord("sys_user");
holder.record = user;
user.query();`,
      RULE,
      ACL,
    );
  });

  it("skips uncalled, generator, and deferred helper bodies", () => {
    assertValid(
      `function load() {
  var user = new GlideRecord("sys_user");
  user.query();
}`,
      RULE,
      ACL,
    );
    assertValid(
      `function* load() {
  var user = new GlideRecord("sys_user");
  user.query();
}
load();`,
      RULE,
      ACL,
    );
    assertValid(
      `scheduleLater(function () {
  var user = new GlideRecord("sys_user");
  user.query();
});`,
      RULE,
      ACL,
    );
  });

  it("does not guess undocumented aggregate executors", () => {
    assertValid(
      `var count = new GlideAggregate("incident");
count.get("abc");
count._query();`,
      RULE,
      ACL,
    );
    assertValid(
      `var user = new GlideRecord("sys_user");
user.getAsync("abc");`,
      RULE,
      ACL,
    );
  });

  it("suppresses diagnostics after relevant method authority is lost", () => {
    for (const code of [
      `GlideRecord = LocalRecord;
var user = new GlideRecord("sys_user");
user.query();`,
      `GlideRecord.prototype.query = localQuery;
var user = new GlideRecord("sys_user");
user.query();`,
      `var user = new GlideRecord("sys_user");
user.query = localQuery;
user.query();`,
      `eval("GlideRecord = LocalRecord");
var user = new GlideRecord("sys_user");
user.query();`,
    ]) {
      assertValid(code, RULE, ACL);
    }
  });

  it("does not report unreachable query calls", () => {
    assertValid(
      `if (false) {
  var user = new GlideRecord("sys_user");
  user.query();
}`,
      RULE,
      ACL,
    );
    assertValid(
      `(function () {
  return;
  var user = new GlideRecord("sys_user");
  user.query();
})();`,
      RULE,
      ACL,
    );
  });
});
