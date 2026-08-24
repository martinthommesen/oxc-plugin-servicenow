import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const SERVER = { filename: "authority.server.js" };

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
      assertValid(code, "require-query-before-next", SERVER);
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
      SERVER,
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
      SERVER,
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
      SERVER,
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
      SERVER,
    );
  });

  it("keeps windowing and query lifecycle unknown after custom calls", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
gr.setLimit(10);
gr.deleteMultiple();
gr.deleteMultiple = localDelete;`,
      "no-delete-multiple-with-windowing",
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
gr.setLimit = localLimit;
gr.setLimit(10);
gr.deleteMultiple();`,
      "no-delete-multiple-with-windowing",
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
gr.query();
gr.setLimit(10);
gr.next();
gr.next = localNext;`,
      "no-gliderecord-query-modifier-after-query",
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
gr.query = localQuery;
gr.query();
gr.setLimit(10);
gr.next();`,
      "no-gliderecord-query-modifier-after-query",
      SERVER,
    );
  });

  it("keeps bulk-filter and count state uncertain after custom calls", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
gr.deleteMultiple();
gr.deleteMultiple = localDelete;`,
      "no-unfiltered-gliderecord-bulk-operation",
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
gr.prepare = maybeFilter;
gr.prepare();
gr.deleteMultiple();`,
      "no-unfiltered-gliderecord-bulk-operation",
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
gr.chooseWindow(0, 10);
gr.query();
gr.query = localQuery;`,
      "prefer-setnocount-with-choosewindow",
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
gr.prepare = maybeSkipCount;
gr.prepare();
gr.chooseWindow(0, 10);
gr.query();`,
      "prefer-setnocount-with-choosewindow",
      SERVER,
    );
  });

  it("suppresses N+1 and counting guidance for replaced methods", () => {
    assertValid(
      `var outer = new GlideRecord("incident");
var inner = new GlideRecord("sys_user");
outer.query();
while (outer.next()) inner.query();
outer.next = localNext;`,
      "no-gliderecord-query-in-loop",
      SERVER,
    );
    assertValid(
      `var outer = new GlideRecord("incident");
var inner = new GlideRecord("sys_user");
outer.query();
while (outer.next()) inner.query();
inner.query = localQuery;`,
      "no-gliderecord-query-in-loop",
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
gr.getRowCount();
gr.getRowCount = localCount;`,
      "prefer-glideaggregate",
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
var count = 0;
while (gr.next()) count++;
gr.next = localNext;`,
      "prefer-glideaggregate",
      SERVER,
    );
  });

  it("suppresses direct method diagnostics after replacement", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
gr.update();
gr.update = localUpdate;`,
      "validate-gliderecord-calls",
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
gr.addSystemQuery("active", true);
gr.addSystemQuery = localQuery;`,
      "no-system-query-bypass",
      SERVER,
    );
  });

  it("keeps computed security review tied to authoritative bypass candidates", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
gr.addSystemQuery = localQuery;
gr[method];`,
      "no-system-query-bypass",
      { messageId: "possibleBypass" },
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
gr.addSystemEncodedQuery = localQuery;
gr.addSystemQuery = localQuery;
gr.addSystemOrderBy = localQuery;
gr.addSystemOrderByDesc = localQuery;
gr[method];`,
      "no-system-query-bypass",
      SERVER,
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
      assertValid(code, "validate-glideaggregate-calls", SERVER);
    }
    assertValid(
      `var ga = new GlideAggregate("incident");
ga.query = localQuery;
ga.query();
ga.next();`,
      "validate-glideaggregate-calls",
      SERVER,
    );
    assertValid(
      `var ga = new GlideAggregate("incident");
ga.addAggregate = localAggregate;
ga.addAggregate("COUNT");
ga.query();
ga.getAggregate("SUM", "amount");`,
      "validate-glideaggregate-calls",
      SERVER,
    );
    assertValid(
      `var ga = new GlideAggregate("incident");
ga.prepare = maybeAddAggregate;
ga.prepare();
ga.query();
ga.query();
ga.getAggregate("SUM", "amount");`,
      "validate-glideaggregate-calls",
      SERVER,
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
      assertValid(code, "no-display-value-date-comparison", SERVER);
    }
  });

  it("requires authoritative cursor and GlideElement member identities", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
var values = [];
while (gr.next()) values.push(gr.number);
gr.next = localNext;`,
      "no-glideelement-in-collection",
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
var values = [];
while (gr.next()) values.push(gr.getElement("number"));
gr.getElement = localElement;`,
      "no-glideelement-in-collection",
      SERVER,
    );
    assertInvalid(
      `var gr = new GlideRecord("incident");
gr.number = "INC0010001";
var values = [];
while (gr.next()) values.push(gr.number);`,
      "no-glideelement-in-collection",
      { messageId: "retained" },
      SERVER,
    );
  });
});
