import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

describe("no-gs-now", () => {
  it("flags gs.now() and is fixable", () => {
    assertInvalid(`var when = gs.now();`, "no-gs-now", { messageId: "server" });
  });

  it("uses the client message in client files", () => {
    assertInvalid(`var when = gs.now();`, "no-gs-now", { messageId: "client" }, {
      filename: "form.client.js",
    });
  });

  it("allows GlideDateTime", () => {
    assertValid(`var when = new GlideDateTime();`, "no-gs-now");
  });
});

describe("validate-gliderecord-calls", () => {
  it("flags next() without query()", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");\ngr.addActiveQuery();\ngr.next();`,
      "validate-gliderecord-calls",
      { messageId: "missingQuery" },
    );
  });

  it("flags unused insert() return", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");\ngr.initialize();\ngr.insert();`,
      "validate-gliderecord-calls",
      { messageId: "unusedReturn" },
    );
  });

  it("allows checked next() after query()", () => {
    assertValid(
      `var gr = new GlideRecord("incident");\ngr.query();\nwhile (gr.next()) { gs.info(gr.number); }`,
      "validate-gliderecord-calls",
    );
  });
});

describe("no-br-current-update", () => {
  it("flags current.update()", () => {
    assertInvalid(`current.state = 2;\ncurrent.update();`, "no-br-current-update", {
      messageId: "update",
    });
  });

  it("allows field assignment", () => {
    assertValid(`current.state = 2;`, "no-br-current-update");
  });
});

describe("no-hardcoded-table-names", () => {
  it("flags string table names", () => {
    assertInvalid(`var gr = new GlideRecord("x_acme_widget");`, "no-hardcoded-table-names", {
      messageId: "literal",
    });
  });

  it("allows identifiers", () => {
    assertValid(`var gr = new GlideRecord(TABLE.WIDGET);`, "no-hardcoded-table-names");
  });

  it("allows builtins when configured", () => {
    assertValid(`var gr = new GlideRecord("incident");`, "no-hardcoded-table-names", {
      options: { "no-hardcoded-table-names": [{ allowBuiltins: true }] },
    });
  });
});

describe("engine extras", () => {
  it("no-at-method flags .at()", () => {
    assertInvalid(`var last = items.at(-1);`, "no-at-method", { messageId: "at" });
  });

  it("no-packages-calls flags Packages", () => {
    assertInvalid(`var n = Packages.java.lang.System.nanoTime();`, "no-packages-calls", {
      messageId: "packages",
    });
  });

  it("no-weak-references flags WeakMap", () => {
    assertInvalid(`var cache = new WeakMap();`, "no-weak-references", { messageId: "weak" });
  });

  it("no-async-iterators flags for await", () => {
    assertInvalid(
      `async function drain(items) { for await (const item of items) { gs.info(item); } }`,
      "no-async-iterators",
      { messageId: "forAwait" },
    );
  });
});
