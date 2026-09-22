import { describe, it } from "node:test";
import {
  assertInvalid,
  assertSkipped,
  assertValid,
  assertValidActive,
} from "../helpers/rule-tester.js";

const RULE = "validate-glideaggregate-calls" as const;

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
    );
  });

  it("flags getAggregate before query", () => {
    assertInvalid(
      `var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
gs.info(count.getAggregate("COUNT"));`,
      RULE,
      { messageId: "missingQuery" },
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
    );
  });

  it("tracks aliases and resets on reassignment", () => {
    assertInvalid(
      `var totals = new GlideAggregate("incident");
var agg = totals;
agg.next();`,
      RULE,
      { messageId: "missingQuery" },
    );
    assertValid(
      `var totals = new GlideAggregate("incident");
totals = other;
totals.next();`,
      RULE,
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
    );
  });

  it("ignores a shadowed GlideAggregate", () => {
    assertValidActive(
      `function GlideAggregate() { this.next = function () {}; }
var count = new GlideAggregate("incident");
count.next();`,
      RULE,
    );
  });

  it("supports computed members", () => {
    assertInvalid(
      `var count = new GlideAggregate("incident");
count["next"]();`,
      RULE,
      { messageId: "missingQuery" },
    );
  });

  it("stays silent for dynamic aggregate names", () => {
    assertValidActive(
      `var totals = new GlideAggregate("x_acme_order");
totals.addAggregate(type, field);
totals.query();
if (totals.next()) {
  gs.info(totals.getAggregate("COUNT"));
}`,
      RULE,
    );
  });

  it("skips client and Fluent files", () => {
    assertSkipped(
      `var count = new GlideAggregate("incident");
count.next();`,
      RULE,
      { filename: "form.client.js" },
    );
    assertSkipped(
      `var count = new GlideAggregate("incident");
count.next();`,
      RULE,
      { filename: "stats.now.ts" },
    );
  });
});
