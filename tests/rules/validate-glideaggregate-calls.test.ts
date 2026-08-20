import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "validate-glideaggregate-calls" as const;
const SERVER = { filename: "incident.br.js" };

describe("validate-glideaggregate-calls", () => {
  it("flags next before query", () => {
    assertInvalid(
      `var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
if (count.next()) {
  gs.info(count.getAggregate("COUNT"));
}`,
      RULE,
      { messageId: "missingQuery", count: 2 },
      SERVER,
    );
  });

  it("flags getAggregate before query", () => {
    assertInvalid(
      `var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
gs.info(count.getAggregate("COUNT"));`,
      RULE,
      { messageId: "missingQuery" },
      SERVER,
    );
  });

  it("allows a valid COUNT sequence", () => {
    assertValid(
      `var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
count.query();
if (count.next()) {
  gs.info(count.getAggregate("COUNT"));
}`,
      RULE,
      SERVER,
    );
  });

  it("matches multiple aggregate tuples", () => {
    assertValid(
      `var totals = new GlideAggregate("x_acme_order");
totals.addAggregate("SUM", "amount");
totals.addAggregate("COUNT");
totals.query();
if (totals.next()) {
  gs.info(totals.getAggregate("SUM", "amount"));
  gs.info(totals.getAggregate("COUNT"));
}`,
      RULE,
      SERVER,
    );
  });

  it("flags a mismatching type and field", () => {
    assertInvalid(
      `var totals = new GlideAggregate("x_acme_order");
totals.addAggregate("SUM", "amount");
totals.query();
if (totals.next()) {
  gs.info(totals.getAggregate("COUNT"));
}`,
      RULE,
      { messageId: "unknownAggregate" },
      SERVER,
    );
  });

  it("tracks aliases and resets on reassignment", () => {
    assertInvalid(
      `var totals = new GlideAggregate("incident");
var agg = totals;
agg.next();`,
      RULE,
      { messageId: "missingQuery" },
      SERVER,
    );
    assertValid(
      `var totals = new GlideAggregate("incident");
totals = other;
totals.next();`,
      RULE,
      SERVER,
    );
  });

  it("reports when query is only in one branch", () => {
    assertInvalid(
      `var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
if (ready) {
  count.query();
}
count.next();`,
      RULE,
      { messageId: "missingQuery" },
      SERVER,
    );
  });

  it("keeps multiple aggregate instances independent", () => {
    assertInvalid(
      `var a = new GlideAggregate("incident");
var b = new GlideAggregate("problem");
a.addAggregate("COUNT");
a.query();
b.next();
a.next();`,
      RULE,
      { count: 1, messageId: "missingQuery" },
      SERVER,
    );
  });

  it("ignores a shadowed GlideAggregate", () => {
    assertValid(
      `function GlideAggregate() { this.next = function () {}; }
var count = new GlideAggregate("incident");
count.next();`,
      RULE,
      SERVER,
    );
  });

  it("supports computed members", () => {
    assertInvalid(
      `var count = new GlideAggregate("incident");
count["next"]();`,
      RULE,
      { messageId: "missingQuery" },
      SERVER,
    );
  });

  it("stays silent for dynamic aggregate names", () => {
    assertValid(
      `var totals = new GlideAggregate("x_acme_order");
totals.addAggregate(type, field);
totals.query();
if (totals.next()) {
  gs.info(totals.getAggregate("COUNT"));
}`,
      RULE,
      SERVER,
    );
  });

  it("skips client and Fluent files", () => {
    assertValid(
      `var count = new GlideAggregate("incident");
count.next();`,
      RULE,
      { filename: "form.client.js" },
    );
    assertValid(
      `var count = new GlideAggregate("incident");
count.next();`,
      RULE,
      { filename: "stats.now.ts" },
    );
  });
});
