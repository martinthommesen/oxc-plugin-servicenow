import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {} from "../helpers/rule-tester.js";

describe("validate-glideaggregate-calls", () => {
  const { expectInvalid, expectValid, expectActive, expectSkipped } = ruleTester(
    "validate-glideaggregate-calls",
    {},
    { messageId: "missingQuery" },
  );

  it("flags next before query", () =>
    void expectInvalid(
      `var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
if (count.next()) {
  gs.info(count.getAggregate("COUNT"));
}`,
      { messageId: "missingQuery", count: 2 },
    ));

  it("flags getAggregate before query", () =>
    void expectInvalid(`var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
gs.info(count.getAggregate("COUNT"));`));

  it("allows a valid COUNT sequence", () =>
    void expectValid(`var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
count.query();
if (count.next()) {
  gs.info(count.getAggregate("COUNT"));
}`));

  it("matches multiple aggregate tuples", () =>
    void expectValid(`var totals = new GlideAggregate("x_acme_order");
totals.addAggregate("SUM", "amount");
totals.addAggregate("COUNT");
totals.query();
if (totals.next()) {
  gs.info(totals.getAggregate("SUM", "amount"));
  gs.info(totals.getAggregate("COUNT"));
}`));

  it("flags a mismatching type and field", () =>
    void expectInvalid(
      `var totals = new GlideAggregate("x_acme_order");
totals.addAggregate("SUM", "amount");
totals.query();
if (totals.next()) {
  gs.info(totals.getAggregate("COUNT"));
}`,
      { messageId: "unknownAggregate" },
    ));

  it("tracks aliases and resets on reassignment", () => {
    expectInvalid(`var totals = new GlideAggregate("incident");
var agg = totals;
agg.next();`);
    expectValid(`var totals = new GlideAggregate("incident");
totals = other;
totals.next();`);
  });

  it("reports when query is only in one branch", () =>
    void expectInvalid(`var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
if (ready) {
  count.query();
}
count.next();`));

  it("keeps multiple aggregate instances independent", () =>
    void expectInvalid(
      `var a = new GlideAggregate("incident");
var b = new GlideAggregate("problem");
a.addAggregate("COUNT");
a.query();
b.next();
a.next();`,
      { count: 1, messageId: "missingQuery" },
    ));

  it("ignores a shadowed GlideAggregate", () =>
    void expectActive(`function GlideAggregate() { this.next = function () {}; }
var count = new GlideAggregate("incident");
count.next();`));

  it("supports computed members", () =>
    void expectInvalid(`var count = new GlideAggregate("incident");
count["next"]();`));

  it("stays silent for dynamic aggregate names", () =>
    void expectActive(`var totals = new GlideAggregate("x_acme_order");
totals.addAggregate(type, field);
totals.query();
if (totals.next()) {
  gs.info(totals.getAggregate("COUNT"));
}`));

  it("skips client and Fluent files", () => {
    expectSkipped(
      `var count = new GlideAggregate("incident");
count.next();`,
      { filename: "form.client.js" },
    );
    expectSkipped(
      `var count = new GlideAggregate("incident");
count.next();`,
      { filename: "stats.now.ts" },
    );
  });
});
