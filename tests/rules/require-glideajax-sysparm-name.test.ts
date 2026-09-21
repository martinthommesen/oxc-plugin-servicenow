import { describe, it } from "node:test";
import {
  assertInvalid,
  assertSkipped,
  assertValid,
  assertValidActive,
} from "../helpers/rule-tester.js";

const RULE = "require-glideajax-sysparm-name" as const;

describe("require-glideajax-sysparm-name", () => {
  it("allows a correct sysparm_name", () => {
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
    );
  });

  it("counts addParam applied through a non-identifier receiver", () => {
    // `(ajax = new GlideAjax(...))` has no object name. The finder used to skip
    // such calls, losing the sysparm_name fact and reporting the later request
    // as unconfigured.
    assertValid(
      `var ajax;
(ajax = new GlideAjax("x_acme.UserLookup")).addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
    );
  });

  it("flags a missing parameter", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_user_id", "abc");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      { messageId: "missingName" },
    );
  });

  it("flags a wrong literal key", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("method", "getManager");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      { messageId: "badPrefix", count: 2 },
    );
  });

  it("stays silent for a dynamic key", () => {
    assertValidActive(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam(nameKey, "getManager");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
    );
  });

  it("reports when the parameter is in only one branch", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
if (ready) {
  ajax.addParam("sysparm_name", "getManager");
}
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      { messageId: "missingName" },
    );
  });

  it("flags a parameter after the terminal call", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(handleAnswer);
ajax.addParam("sysparm_user_id", "abc");`,
      RULE,
      { messageId: "afterTerminal" },
    );
  });

  it("tracks aliases and resets on reassignment", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
var req = ajax;
req.getXML(handleAnswer);`,
      RULE,
      { messageId: "missingName" },
    );
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax = other;
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
    );
  });

  it("supports static computed methods", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax["getXMLAnswer"](handleAnswer);`,
      RULE,
      { messageId: "missingName" },
    );
  });

  it("ignores a non-GlideAjax object with addParam", () => {
    assertValidActive(
      `var ajax = { addParam: function () {}, getXMLAnswer: function () {} };
ajax.addParam("method", "getManager");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
    );
  });

  it("skips server files", () => {
    assertSkipped(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      { filename: "helper.si.js" },
    );
  });

  it("covers every supported terminal request call", () => {
    for (const method of ["getXML", "getXMLAnswer", "getXMLWait"]) {
      assertInvalid(
        `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.${method}(handleAnswer);`,
        RULE,
        { messageId: "missingName" },
      );
    }
  });

  it("flags additional parameter prefix mistakes", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.addParam("user_id", "abc");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      { messageId: "badPrefix" },
    );
  });

  it("stays silent after the object escapes", () => {
    assertValidActive(
      `var ajax = new GlideAjax("x_acme.UserLookup");
prepare(ajax);
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
    );
  });

  it("stays silent when GlideAjax method identity is uncertain", () => {
    for (const code of [
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam = localAddParam;
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(handleAnswer);`,
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getXMLAnswer(handleAnswer);
ajax.getXMLAnswer = localRequest;`,
      `GlideAjax.prototype.getXMLAnswer = localRequest;
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getXMLAnswer(handleAnswer);`,
      `GlideAjax = LocalGlideAjax;
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getXMLAnswer(handleAnswer);`,
      `eval("GlideAjax.prototype.getXMLAnswer = localRequest");
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getXMLAnswer(handleAnswer);`,
    ]) {
      assertValidActive(code, RULE);
    }
  });
});
