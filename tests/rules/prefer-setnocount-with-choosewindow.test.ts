import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "prefer-setnocount-with-choosewindow" as const;

describe("prefer-setnocount-with-choosewindow", () => {
  it("flags chooseWindow then query without a count skip", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();`,
      RULE,
      { messageId: "missing", count: 1 },
    );
  });

  it("allows setNoCount before query", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.setNoCount();
rec.query();`,
      RULE,
    );
  });

  it("allows setLimit as the documented COUNT skip", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
rec.setLimit(20);
rec.chooseWindow(0, 20);
rec.query();`,
      RULE,
    );
  });

  it("stays silent when getRowCount is used", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();
gs.info(rec.getRowCount());`,
      RULE,
    );
  });

  it("stays silent when chooseWindow forces a count", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20, true);
rec.query();`,
      RULE,
    );
  });

  it("stays silent when the forceCount argument is not a literal", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
var force = cond;
rec.chooseWindow(0, 20, force);
rec.query();`,
      RULE,
    );
  });

  it("tracks aliases and resets on reassignment", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
var page = rec;
page.chooseWindow(20, 40);
page.query();
var other = new GlideRecord("problem");
other.query();
rec = other;`,
      RULE,
      { messageId: "missing", count: 1 },
    );
  });

  it("stays silent after the record escapes", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
helper(rec);
rec.query();`,
      RULE,
    );
  });

  it("reports when chooseWindow is reachable on one branch", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
if (page) rec.chooseWindow(0, 20);
rec.query();`,
      RULE,
      { messageId: "missing" },
    );
  });

  it("reports when setNoCount skips only one reachable path", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
if (skip) rec.setNoCount(true);
rec.query();`,
      RULE,
      { messageId: "missing" },
    );
  });

  it("does not let one branch consume another branch's count result", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();
if (useCount) rec.getRowCount();`,
      RULE,
      { messageId: "missing" },
    );
  });

  it("ignores a shadowed GlideRecord", () => {
    assertValid(
      `function GlideRecord() {}
var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();`,
      RULE,
    );
  });

  it("skips client and Fluent files", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();`,
      RULE,
      { filename: "catalog.client.js" },
    );
    assertValid(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();`,
      RULE,
      { filename: "table.now.ts" },
    );
  });
});
