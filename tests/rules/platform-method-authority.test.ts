import { describe, it } from "node:test";
import { ACL, assertInvalid, assertValidActive } from "../helpers/rule-tester.js";

describe("GlideRecord method authority", () => {
  it("suppresses cursor diagnostics after visible identity loss", () => {
    for (const code of [
      `var gr = new GlideRecord("incident");
gr.next();
gr.next = localNext;`,
      `var gr = new GlideRecord("incident");
var alias = gr;
alias.next = localNext;
gr.next();`,
      `var gr = new GlideRecord("incident");
Object.defineProperty(gr, "next", { value: localNext });
gr.next();`,
      `GlideRecord.prototype.next = localNext;
var gr = new GlideRecord("incident");
gr.next();`,
      `GlideRecordSecure.prototype.next = localNext;
var gr = new GlideRecord("incident");
gr.next();`,
      `GlideRecord = LocalRecord;
var gr = new GlideRecord("incident");
gr.next();`,
      `GlideRecordSecure = LocalRecord;
var gr = new GlideRecordSecure("incident");
gr.next();`,
      `eval("GlideRecord.prototype.next = localNext");
var gr = new GlideRecord("incident");
gr.next();`,
      `var gr = new GlideRecord("incident");
gr.query = localQuery;
gr.query();
gr.next();`,
    ]) {
      assertValidActive(code, "require-query-before-next");
    }
  });

  it("keeps authority after nullish Object.assign sources", () => {
    assertInvalid(
      `const absent = null;
Object.assign(GlideRecord.prototype, absent, undefined);
var gr = new GlideRecord("incident");
gr.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("keeps authority mutations scoped to the affected object identity", () => {
    assertInvalid(
      `var customized = new GlideRecord("incident");
customized.next = localNext;
var record = new GlideRecord("incident");
record.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
    assertInvalid(
      `function customizeLocal() {
  var record = { next: localNext };
  record.next = otherNext;
}
var record = new GlideRecord("incident");
record.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("preserves a definite unopened path beside an uncertain branch", () => {
    assertInvalid(
      `var record = new GlideRecord("incident");
if (condition) {
  record.prepare = maybeQuery;
  record.prepare();
}
record.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("keeps windowing and query lifecycle unknown after custom calls", () => {
    assertValidActive(
      `var gr = new GlideRecord("incident");
gr.setLimit(10);
gr.deleteMultiple();
gr.deleteMultiple = localDelete;`,
      "no-delete-multiple-with-windowing",
    );
    assertValidActive(
      `var gr = new GlideRecord("incident");
gr.setLimit = localLimit;
gr.setLimit(10);
gr.deleteMultiple();`,
      "no-delete-multiple-with-windowing",
    );
    assertValidActive(
      `var gr = new GlideRecord("incident");
gr.query();
gr.setLimit(10);
gr.next();
gr.next = localNext;`,
      "no-gliderecord-query-modifier-after-query",
    );
    assertValidActive(
      `var gr = new GlideRecord("incident");
gr.query = localQuery;
gr.query();
gr.setLimit(10);
gr.next();`,
      "no-gliderecord-query-modifier-after-query",
    );
  });

  it("keeps bulk-filter and count state uncertain after custom calls", () => {
    assertValidActive(
      `var gr = new GlideRecord("incident");
gr.deleteMultiple();
gr.deleteMultiple = localDelete;`,
      "no-unfiltered-gliderecord-bulk-operation",
    );
    assertValidActive(
      `var gr = new GlideRecord("incident");
gr.prepare = maybeFilter;
gr.prepare();
gr.deleteMultiple();`,
      "no-unfiltered-gliderecord-bulk-operation",
    );
    assertValidActive(
      `var gr = new GlideRecord("incident");
gr.chooseWindow(0, 10);
gr.query();
gr.query = localQuery;`,
      "prefer-setnocount-with-choosewindow",
    );
    assertValidActive(
      `var gr = new GlideRecord("incident");
gr.prepare = maybeSkipCount;
gr.prepare();
gr.chooseWindow(0, 10);
gr.query();`,
      "prefer-setnocount-with-choosewindow",
    );
  });

  it("reports when a static filter clears branch-local uncertainty", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
if (condition) {
  gr.addEncodedQuery(encoded);
  gr.addQuery("active", true);
}
gr.deleteMultiple();`,
      "no-unfiltered-gliderecord-bulk-operation",
      { messageId: "unfiltered" },
    );
  });

  it("suppresses N+1 and counting guidance for replaced methods", () => {
    assertValidActive(
      `var outer = new GlideRecord("incident");
var inner = new GlideRecord("sys_user");
outer.query();
while (outer.next()) inner.query();
outer.next = localNext;`,
      "no-gliderecord-query-in-loop",
    );
    assertValidActive(
      `var outer = new GlideRecord("incident");
var inner = new GlideRecord("sys_user");
outer.query();
while (outer.next()) inner.query();
inner.query = localQuery;`,
      "no-gliderecord-query-in-loop",
    );
    assertValidActive(
      `var gr = new GlideRecord("incident");
gr.getRowCount();
gr.getRowCount = localCount;`,
      "prefer-glideaggregate",
    );
    assertValidActive(
      `var gr = new GlideRecord("incident");
var count = 0;
while (gr.next()) count++;
gr.next = localNext;`,
      "prefer-glideaggregate",
    );
  });

  it("does not let a later method replacement suppress a security review", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
gr.addSystemQuery("active", true);
gr.addSystemQuery = localQuery;`,
      "no-system-query-bypass",
      { count: 1, messageId: "bypass" },
    );
  });

  it("reviews a named bypass call after a visible replacement", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
gr.addSystemQuery = localQuery;
gr.addSystemQuery("active", true);`,
      "no-system-query-bypass",
      { count: 1, messageId: "bypass" },
    );
  });

  it("keeps computed security review tied to authoritative bypass candidates", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
gr.addSystemQuery = localQuery;
gr[method];`,
      "no-system-query-bypass",
      { messageId: "possibleBypass" },
    );
    assertValidActive(
      `var gr = new GlideRecord("incident");
gr.addSystemEncodedQuery = localQuery;
gr.addSystemQuery = localQuery;
gr.addSystemOrderBy = localQuery;
gr.addSystemOrderByDesc = localQuery;
gr[method];`,
      "no-system-query-bypass",
    );
  });
});

describe("GlideAggregate method authority", () => {
  it("keeps query and aggregate tuples unknown after custom calls", () => {
    for (const code of [
      `var ga = new GlideAggregate("incident");
ga.next();
ga.next = localNext;`,
      `GlideAggregate.prototype.next = localNext;
var ga = new GlideAggregate("incident");
ga.next();`,
      `GlideAggregate = LocalAggregate;
var ga = new GlideAggregate("incident");
ga.next();`,
    ]) {
      assertValidActive(code, "validate-glideaggregate-calls");
    }
    assertValidActive(
      `var ga = new GlideAggregate("incident");
ga.query = localQuery;
ga.query();
ga.next();`,
      "validate-glideaggregate-calls",
    );
    assertValidActive(
      `var ga = new GlideAggregate("incident");
ga.addAggregate = localAggregate;
ga.addAggregate("COUNT");
ga.query();
ga.getAggregate("SUM", "amount");`,
      "validate-glideaggregate-calls",
    );
    assertValidActive(
      `var ga = new GlideAggregate("incident");
ga.prepare = maybeAddAggregate;
ga.prepare();
ga.query();
ga.query();
ga.getAggregate("SUM", "amount");`,
      "validate-glideaggregate-calls",
    );
  });
});

describe("other platform method authority", () => {
  it("suppresses mutated GlideDateTime display methods", () => {
    for (const code of [
      `var date = new GlideDateTime();
if (date.getDisplayValue() < "2026-01-01") gs.info(date);
date.getDisplayValue = localDisplay;`,
      `GlideDateTime.prototype.getDisplayValue = localDisplay;
var date = new GlideDateTime();
if (date.getDisplayValue() < "2026-01-01") gs.info(date);`,
      `GlideDateTime = LocalDateTime;
var date = new GlideDateTime();
if (date.getDisplayValue() < "2026-01-01") gs.info(date);`,
    ]) {
      assertValidActive(code, "no-display-value-date-comparison");
    }
  });

  it("requires authoritative cursor and GlideElement member identities", () => {
    assertValidActive(
      `var gr = new GlideRecord("incident");
var values = [];
while (gr.next()) values.push(gr.number);
gr.next = localNext;`,
      "no-glideelement-in-collection",
    );
    assertValidActive(
      `var gr = new GlideRecord("incident");
var values = [];
while (gr.next()) values.push(gr.getElement("number"));
gr.getElement = localElement;`,
      "no-glideelement-in-collection",
    );
    assertInvalid(
      `var gr = new GlideRecord("incident");
gr.number = "INC0010001";
var values = [];
while (gr.next()) values.push(gr.number);`,
      "no-glideelement-in-collection",
      { messageId: "retained" },
    );
  });

  it("suppresses ACL query diagnostics after relevant method authority is lost", () => {
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
      assertValidActive(code, "no-gliderecord-query-in-acl", ACL);
    }
  });
});
