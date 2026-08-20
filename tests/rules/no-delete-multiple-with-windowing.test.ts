import { describe, it } from "node:test";
import { assertInvalid, assertValid, ES5, ES2021 } from "../helpers/rule-tester.js";

const RULE = "no-delete-multiple-with-windowing" as const;
const SERVER = { filename: "cleanup.br.js" };

describe("no-delete-multiple-with-windowing", () => {
  it("flags setLimit then deleteMultiple", () => {
    assertInvalid(
      `var stale = new GlideRecord("x_acme_staging");
stale.addQuery("state", "expired");
stale.setLimit(100);
stale.deleteMultiple();`,
      RULE,
      { messageId: "windowed" },
      SERVER,
    );
  });

  it("flags chooseWindow then deleteMultiple", () => {
    assertInvalid(
      `var stale = new GlideRecord("x_acme_staging");
stale.chooseWindow(0, 100);
stale.deleteMultiple();`,
      RULE,
      { messageId: "windowed" },
      SERVER,
    );
  });

  it("flags both orders of intervening calls", () => {
    assertInvalid(
      `var stale = new GlideRecord("x_acme_staging");
stale.setLimit(10);
stale.addQuery("active", true);
stale.deleteMultiple();`,
      RULE,
      { messageId: "windowed" },
      SERVER,
    );
  });

  it("allows setLimit plus deleteRecord", () => {
    assertValid(
      `var stale = new GlideRecord("x_acme_staging");
stale.setLimit(100);
stale.query();
if (stale.next()) stale.deleteRecord();`,
      RULE,
      SERVER,
    );
  });

  it("allows deleteMultiple without a window", () => {
    assertValid(
      `var stale = new GlideRecord("x_acme_staging");
stale.addQuery("state", "expired");
stale.deleteMultiple();`,
      RULE,
      SERVER,
    );
  });

  it("allows an unrelated object with the same methods", () => {
    assertValid(
      `var stale = { setLimit: function () {}, deleteMultiple: function () {} };
stale.setLimit(100);
stale.deleteMultiple();`,
      RULE,
      SERVER,
    );
  });

  it("ignores a shadowed GlideRecord", () => {
    assertValid(
      `function GlideRecord() { this.setLimit = function () {}; this.deleteMultiple = function () {}; }
var stale = new GlideRecord("x_acme_staging");
stale.setLimit(100);
stale.deleteMultiple();`,
      RULE,
      SERVER,
    );
  });

  it("tracks a simple alias and resets on reassignment", () => {
    assertInvalid(
      `var stale = new GlideRecord("x_acme_staging");
var batch = stale;
batch.setLimit(50);
batch.deleteMultiple();`,
      RULE,
      { messageId: "windowed" },
      SERVER,
    );
    assertValid(
      `var stale = new GlideRecord("x_acme_staging");
stale.setLimit(50);
stale = new GlideRecord("incident");
stale.deleteMultiple();`,
      RULE,
      SERVER,
    );
  });

  it("supports static computed members", () => {
    assertInvalid(
      `var stale = new GlideRecord("x_acme_staging");
stale["setLimit"](100);
stale["deleteMultiple"]();`,
      RULE,
      { messageId: "windowed" },
      SERVER,
    );
  });

  it("keeps two records independent", () => {
    assertInvalid(
      `var windowed = new GlideRecord("x_acme_staging");
var full = new GlideRecord("x_acme_staging");
windowed.setLimit(10);
windowed.deleteMultiple();
full.deleteMultiple();`,
      RULE,
      { count: 1, messageId: "windowed" },
      SERVER,
    );
  });

  it("stays silent when only one branch windows", () => {
    assertValid(
      `var stale = new GlideRecord("x_acme_staging");
if (gs.getProperty("x_acme.limit") === "true") {
  stale.setLimit(100);
}
stale.deleteMultiple();`,
      RULE,
      SERVER,
    );
  });

  it("stays silent after the record escapes to a helper", () => {
    assertValid(
      `var stale = new GlideRecord("x_acme_staging");
stale.setLimit(100);
configure(stale);
stale.deleteMultiple();`,
      RULE,
      SERVER,
    );
  });

  it("skips client and Fluent files", () => {
    assertValid(
      `var stale = new GlideRecord("x_acme_staging");
stale.setLimit(100);
stale.deleteMultiple();`,
      RULE,
      { filename: "form.client.js" },
    );
    assertValid(
      `var stale = new GlideRecord("x_acme_staging");
stale.setLimit(100);
stale.deleteMultiple();`,
      RULE,
      { filename: "cleanup.now.ts" },
    );
  });

  it("runs in ES5 and ES2021 server contexts", () => {
    const code = `var stale = new GlideRecord("x_acme_staging");
stale.setLimit(5);
stale.deleteMultiple();`;
    assertInvalid(code, RULE, { messageId: "windowed" }, { ...SERVER, settings: ES5 });
    assertInvalid(code, RULE, { messageId: "windowed" }, { ...SERVER, settings: ES2021 });
  });

  it("tracks GlideRecordSecure", () => {
    assertInvalid(
      `var stale = new GlideRecordSecure("x_acme_staging");
stale.setLimit(10);
stale.deleteMultiple();`,
      RULE,
      { messageId: "windowed" },
      SERVER,
    );
  });
});
