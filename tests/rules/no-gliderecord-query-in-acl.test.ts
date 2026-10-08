import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import { ACL } from "../helpers/rule-tester.js";

describe("no-gliderecord-query-in-acl", () => {
  const { expectInvalid, expectValid, expectSkipped, expectActive } = ruleTester(
    "no-gliderecord-query-in-acl",
    ACL,
    { messageId: "query" },
  );

  it("reports documented GlideRecord query executors", () => {
    for (const method of ["query", "_query", "get"] as const) {
      expectInvalid(
        `var user = new GlideRecord("sys_user");
user.${method}("abc");`,
        { messageId: "query", includes: method },
      );
    }
  });

  it("reports GlideRecordSecure and GlideAggregate queries", () => {
    expectInvalid(
      `var user = new GlideRecordSecure("sys_user");
user.query();`,
      { messageId: "query", includes: "GlideRecord" },
    );
    expectInvalid(
      `var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
count.query();`,
      { messageId: "query", includes: "GlideAggregate" },
    );
  });

  it("reports query executors on the authoritative current record and its aliases", () =>
    void expectInvalid(
      `current.query();
var record = current;
record.get("abc");`,
      { messageId: "query", count: 2, includes: "GlideRecord" },
    ));

  it("tracks aliases, static computed members, and all-path object joins", () => {
    expectInvalid(`var user = new GlideRecord("sys_user");
var record = user;
record["query"]();`);
    expectInvalid(`var record;
if (active) record = new GlideRecord("incident");
else record = new GlideRecord("task");
record.query();`);
  });

  it("follows directly invoked helpers with call-time aliases", () => {
    expectInvalid(`function load(record) { record.query(); }
var user = new GlideRecord("sys_user");
load(user);`);
    expectInvalid(`(function (record) { record.get("abc"); })(new GlideRecord("sys_user"));`);
  });

  it("uses filename and explicit ACL surface evidence", () => {
    for (const filename of [
      "read.acl.js",
      "incident.access-control.cjs",
      "sys_security_acl_read.mjs",
      "src/access-controls/read.js",
    ]) {
      expectInvalid(`var user = new GlideRecord("sys_user"); user.query();`, undefined, {
        filename,
      });
    }
    expectInvalid(`var user = new GlideRecord("sys_user"); user.query();`, undefined, {
      filename: "exported-script.js",
      settings: { surfaces: ["acl"] },
    });
  });

  it("recognizes global-only queryNoDomain only with proven scope and release", () => {
    const code = `var user = new GlideRecord("sys_user"); user.queryNoDomain();`;
    expectInvalid(code, undefined, {
      ...ACL,
      settings: { scope: "global", release: "australia" },
    });
    expectValid(code, {
      ...ACL,
      settings: { scope: "unknown", release: "australia" },
    });
    expectValid(code, {
      ...ACL,
      settings: { scope: "scoped", release: "australia" },
    });
  });

  it("stays silent outside a known ACL surface", () => {
    const code = `var user = new GlideRecord("sys_user"); user.query();`;
    expectSkipped(code, { filename: "helper.server.js" });
    expectSkipped(code, { filename: "unknown.js" });
    expectSkipped(code, { filename: "table.now.ts" });
  });

  it("ignores unrelated and shadowed constructors", () => {
    expectActive(`var user = { query: function () {} }; user.query();`);
    expectActive(`function GlideRecord() { this.query = function () {}; }
var user = new GlideRecord("sys_user");
user.query();`);
    expectActive(`function check(GlideAggregate) {
  var count = new GlideAggregate("incident");
  count.query();
}
check(LocalAggregate);`);
  });

  it("stays silent after reassignment or escape", () => {
    expectActive(`var user = new GlideRecord("sys_user");
user = customRecord;
user.query();`);
    expectActive(`var user = new GlideRecord("sys_user");
prepare(user);
user.query();`);
    expectActive(`var user = new GlideRecord("sys_user");
holder.record = user;
user.query();`);
  });

  it("skips uncalled, generator, and deferred helper bodies", () => {
    expectActive(`function load() {
  var user = new GlideRecord("sys_user");
  user.query();
}`);
    expectActive(`function* load() {
  var user = new GlideRecord("sys_user");
  user.query();
}
load();`);
    expectActive(`scheduleLater(function () {
  var user = new GlideRecord("sys_user");
  user.query();
});`);
  });

  it("stops directly invoked async helpers at their first suspension", () => {
    expectInvalid(
      `async function load() {
  var before = new GlideRecord("sys_user");
  before.query();
  await later();
  var after = new GlideRecord("sys_user");
  after.query();
}
load();`,
      { messageId: "query", count: 1, includes: "before" },
    );
    expectValid(`async function load() {
  await later();
  var user = new GlideRecord("sys_user");
  user.query();
}
load();`);
  });

  it("treats for-await iteration as an asynchronous suspension", () => {
    expectInvalid(
      `async function load() {
  var before = new GlideRecord("sys_user");
  before.query();
  for await (var row of rows) {
    current.query();
  }
  current.query();
}
load();`,
      { messageId: "query", count: 1, includes: "before" },
    );
    expectInvalid(
      `async function load() {
  for await (var row of (current.query(), rows)) {
    current.query();
  }
}
load();`,
      { messageId: "query", count: 1, includes: "current" },
    );
  });

  it("keeps suspended calls out of the immediate path and resumes the caller", () => {
    expectValid(`async function load() {
  var user = new GlideRecord("sys_user");
  try {
    await pending;
  } finally {
    user.query();
  }
}
load();`);
    expectValid(`async function load() {
  var user = new GlideRecord("sys_user");
  user.get(await id());
}
load();`);
    expectInvalid(
      `async function load() { await later(); }
load();
var user = new GlideRecord("sys_user");
user.query();`,
      { messageId: "query", count: 1, includes: "user" },
    );
    for (const assignment of [
      "user = await later()",
      "user &&= await later()",
      "user = condition ? await later() : user",
      "user &&= condition ? await later() : user",
      "user = first ? (second ? await later() : user) : user",
      "user = user && (condition ? await later() : user)",
    ]) {
      expectInvalid(
        `var user = new GlideRecord("sys_user");
async function replace() {
  ${assignment};
}
replace();
user.query();`,
        { messageId: "query", count: 1, includes: "user" },
      );
    }
    for (const operator of ["=", "&&="] as const) {
      expectValid(`var user = new GlideRecord("sys_user");
async function replace() {
  user ${operator} condition ? await later() : replacement;
}
replace();
user.query();`);
    }
    expectInvalid(
      `async function load() { throw failure; }
load();
var user = new GlideRecord("sys_user");
user.query();`,
      { messageId: "query", count: 1, includes: "user" },
    );
  });

  it("does not guess undocumented aggregate executors", () => {
    expectValid(`var count = new GlideAggregate("incident");
count.get("abc");
count._query();`);
    expectValid(`var user = new GlideRecord("sys_user");
user.getAsync("abc");`);
  });

  it("suppresses current diagnostics after its method authority is lost", () => {
    for (const code of [
      `current = localRecord;
current.query();`,
      `current.query = localQuery;
current.query();`,
      `prepare(current);
current.query();`,
      `function check(current) { current.query(); }
check(localRecord);`,
    ]) {
      expectValid(code);
    }
  });

  it("preserves escaped current uncertainty across unrelated joins", () => {
    for (const code of [
      `current[method]();
if (condition) gs.info("branch");
current.query();`,
      `prepare(current);
if (condition) gs.info("branch");
current.query();`,
    ]) {
      expectValid(code);
    }
  });

  it("does not report unreachable query calls", () => {
    expectValid(`if (false) {
  var user = new GlideRecord("sys_user");
  user.query();
}`);
    expectValid(`(function () {
  return;
  var user = new GlideRecord("sys_user");
  user.query();
})();`);
  });
});
