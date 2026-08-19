import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "require-glideajax-sysparm-name" as const;
const CLIENT = { filename: "incident.client.js" };

describe("require-glideajax-sysparm-name", () => {
  it("allows a correct sysparm_name", () => {
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      CLIENT,
    );
  });

  it("flags a missing parameter", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_user_id", "abc");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      { messageId: "missingName" },
      CLIENT,
    );
  });

  it("flags a wrong literal key", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("method", "getManager");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      { messageId: "badPrefix", count: 2 },
      CLIENT,
    );
  });

  it("stays silent for a dynamic key", () => {
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam(nameKey, "getManager");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      CLIENT,
    );
  });

  it("stays silent when the parameter is in only one branch", () => {
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
if (ready) {
  ajax.addParam("sysparm_name", "getManager");
}
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      CLIENT,
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
      CLIENT,
    );
  });

  it("tracks aliases and resets on reassignment", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
var req = ajax;
req.getXML(handleAnswer);`,
      RULE,
      { messageId: "missingName" },
      CLIENT,
    );
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax = other;
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      CLIENT,
    );
  });

  it("supports static computed methods", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax["getXMLAnswer"](handleAnswer);`,
      RULE,
      { messageId: "missingName" },
      CLIENT,
    );
  });

  it("ignores a non-GlideAjax object with addParam", () => {
    assertValid(
      `var ajax = { addParam: function () {}, getXMLAnswer: function () {} };
ajax.addParam("method", "getManager");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      CLIENT,
    );
  });

  it("skips server files", () => {
    assertValid(
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
        CLIENT,
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
      CLIENT,
    );
  });

  it("stays silent after the object escapes", () => {
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
prepare(ajax);
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      CLIENT,
    );
  });
});
