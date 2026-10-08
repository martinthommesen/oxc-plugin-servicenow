import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import { ES5, ES2021 } from "../helpers/rule-tester.js";

describe("no-delete-multiple-with-windowing", () => {
  const { expectInvalid, expectValid, expectActive, expectSkipped } = ruleTester(
    "no-delete-multiple-with-windowing",
    {},
    { messageId: "windowed" },
  );

  it("flags setLimit then deleteMultiple", () =>
    void expectInvalid(`var stale = new GlideRecord("x_acme_staging");
stale.addQuery("state", "expired");
stale.setLimit(100);
stale.deleteMultiple();`));

  it("flags chooseWindow then deleteMultiple", () =>
    void expectInvalid(`var stale = new GlideRecord("x_acme_staging");
stale.chooseWindow(0, 100);
stale.deleteMultiple();`));

  it("flags both orders of intervening calls", () =>
    void expectInvalid(`var stale = new GlideRecord("x_acme_staging");
stale.setLimit(10);
stale.addQuery("active", true);
stale.deleteMultiple();`));

  it("allows setLimit plus deleteRecord", () =>
    void expectValid(`var stale = new GlideRecord("x_acme_staging");
stale.setLimit(100);
stale.query();
if (stale.next()) stale.deleteRecord();`));

  it("allows deleteMultiple without a window", () =>
    void expectValid(`var stale = new GlideRecord("x_acme_staging");
stale.addQuery("state", "expired");
stale.deleteMultiple();`));

  it("allows an unrelated object with the same methods", () =>
    void expectValid(`var stale = { setLimit: function () {}, deleteMultiple: function () {} };
stale.setLimit(100);
stale.deleteMultiple();`));

  it("ignores a shadowed GlideRecord", () =>
    void expectActive(`function GlideRecord() { this.setLimit = function () {}; this.deleteMultiple = function () {}; }
var stale = new GlideRecord("x_acme_staging");
stale.setLimit(100);
stale.deleteMultiple();`));

  it("tracks a simple alias and resets on reassignment", () => {
    expectInvalid(`var stale = new GlideRecord("x_acme_staging");
var batch = stale;
batch.setLimit(50);
batch.deleteMultiple();`);
    expectValid(`var stale = new GlideRecord("x_acme_staging");
stale.setLimit(50);
stale = new GlideRecord("incident");
stale.deleteMultiple();`);
  });

  it("supports static computed members", () =>
    void expectInvalid(`var stale = new GlideRecord("x_acme_staging");
stale["setLimit"](100);
stale["deleteMultiple"]();`));

  it("keeps two records independent", () =>
    void expectInvalid(
      `var windowed = new GlideRecord("x_acme_staging");
var full = new GlideRecord("x_acme_staging");
windowed.setLimit(10);
windowed.deleteMultiple();
full.deleteMultiple();`,
      { count: 1, messageId: "windowed" },
    ));

  it("stays silent when only one branch windows", () =>
    void expectActive(`var stale = new GlideRecord("x_acme_staging");
if (gs.getProperty("x_acme.limit") === "true") {
  stale.setLimit(100);
}
stale.deleteMultiple();`));

  it("stays silent after the record escapes to a helper", () =>
    void expectActive(`var stale = new GlideRecord("x_acme_staging");
stale.setLimit(100);
configure(stale);
stale.deleteMultiple();`));

  it("skips client and Fluent files", () => {
    expectSkipped(
      `var stale = new GlideRecord("x_acme_staging");
stale.setLimit(100);
stale.deleteMultiple();`,
      { filename: "form.client.js" },
    );
    expectSkipped(
      `var stale = new GlideRecord("x_acme_staging");
stale.setLimit(100);
stale.deleteMultiple();`,
      { filename: "cleanup.now.ts" },
    );
  });

  it("runs in ES5 and ES2021 server contexts", () => {
    const code = `var stale = new GlideRecord("x_acme_staging");
stale.setLimit(5);
stale.deleteMultiple();`;
    expectInvalid(code, undefined, { settings: ES5 });
    expectInvalid(code, undefined, { settings: ES2021 });
  });

  it("tracks a windowing call on a non-identifier receiver", () => {
    // The assignment expression receiver has no object name. The finder used to
    // skip such calls entirely, so the windowing fact was never recorded and
    // the later deleteMultiple went unreported.
    expectInvalid(`var stale;
(stale = new GlideRecord("x_acme_staging")).setLimit(10);
stale.deleteMultiple();`);
  });

  it("tracks GlideRecordSecure", () =>
    void expectInvalid(`var stale = new GlideRecordSecure("x_acme_staging");
stale.setLimit(10);
stale.deleteMultiple();`));
});
