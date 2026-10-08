import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {} from "../helpers/rule-tester.js";

describe("prefer-setnocount-with-choosewindow", () => {
  const { expectInvalid, expectValid, expectActive, expectSkipped } = ruleTester(
    "prefer-setnocount-with-choosewindow",
    {},
    { messageId: "missing" },
  );

  it("flags chooseWindow then query without a count skip", () =>
    void expectInvalid(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();`,
      { messageId: "missing", count: 1 },
    ));

  it("allows setNoCount before query", () =>
    void expectValid(`var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.setNoCount();
rec.query();`));

  it("allows setLimit as the documented COUNT skip", () =>
    void expectValid(`var rec = new GlideRecord("incident");
rec.setLimit(20);
rec.chooseWindow(0, 20);
rec.query();`));

  it("stays silent when getRowCount is used", () =>
    void expectActive(`var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();
gs.info(rec.getRowCount());`));

  it("stays silent when chooseWindow forces a count", () =>
    void expectActive(`var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20, true);
rec.query();`));

  it("stays silent when the forceCount argument is not a literal", () =>
    void expectActive(`var rec = new GlideRecord("incident");
var force = cond;
rec.chooseWindow(0, 20, force);
rec.query();`));

  it("tracks aliases and resets on reassignment", () =>
    void expectInvalid(
      `var rec = new GlideRecord("incident");
var page = rec;
page.chooseWindow(20, 40);
page.query();
var other = new GlideRecord("problem");
other.query();
rec = other;`,
      { messageId: "missing", count: 1 },
    ));

  it("stays silent after the record escapes", () =>
    void expectActive(`var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
helper(rec);
rec.query();`));

  it("reports when chooseWindow is reachable on one branch", () =>
    void expectInvalid(`var rec = new GlideRecord("incident");
if (page) rec.chooseWindow(0, 20);
rec.query();`));

  it("reports when setNoCount skips only one reachable path", () =>
    void expectInvalid(`var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
if (skip) rec.setNoCount(true);
rec.query();`));

  it("does not let one branch consume another branch's count result", () =>
    void expectInvalid(`var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();
if (useCount) rec.getRowCount();`));

  it("ignores a shadowed GlideRecord", () =>
    void expectActive(`function GlideRecord() {}
var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();`));

  it("skips client and Fluent files", () => {
    expectSkipped(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();`,
      { filename: "catalog.client.js" },
    );
    expectSkipped(
      `var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();`,
      { filename: "table.now.ts" },
    );
  });
});
