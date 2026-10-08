import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {} from "../helpers/rule-tester.js";

describe("require-glideajax-sysparm-name", () => {
  const { expectValid, expectInvalid, expectActive, expectSkipped } = ruleTester(
    "require-glideajax-sysparm-name",
    {},
    { messageId: "missingName" },
  );

  it("allows a correct sysparm_name", () =>
    void expectValid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
ajax.getXMLAnswer(handleAnswer);`));

  it("counts addParam applied through a non-identifier receiver", () => {
    // `(ajax = new GlideAjax(...))` has no object name. The finder used to skip
    // such calls, losing the sysparm_name fact and reporting the later request
    // as unconfigured.
    expectValid(`var ajax;
(ajax = new GlideAjax("x_acme.UserLookup")).addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(handleAnswer);`);
  });

  it("flags a missing parameter", () =>
    void expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_user_id", "abc");
ajax.getXMLAnswer(handleAnswer);`));

  it("flags a wrong literal key", () =>
    void expectInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("method", "getManager");
ajax.getXMLAnswer(handleAnswer);`,
      { messageId: "badPrefix", count: 2 },
    ));

  it("stays silent for a dynamic key", () =>
    void expectActive(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam(nameKey, "getManager");
ajax.getXMLAnswer(handleAnswer);`));

  it("reports when the parameter is in only one branch", () =>
    void expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
if (ready) {
  ajax.addParam("sysparm_name", "getManager");
}
ajax.getXMLAnswer(handleAnswer);`));

  it("flags a parameter after the terminal call", () =>
    void expectInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(handleAnswer);
ajax.addParam("sysparm_user_id", "abc");`,
      { messageId: "afterTerminal" },
    ));

  it("tracks aliases and resets on reassignment", () => {
    expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
var req = ajax;
req.getXML(handleAnswer);`);
    expectValid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax = other;
ajax.getXMLAnswer(handleAnswer);`);
  });

  it("supports static computed methods", () =>
    void expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax["getXMLAnswer"](handleAnswer);`));

  it("ignores a non-GlideAjax object with addParam", () =>
    void expectActive(`var ajax = { addParam: function () {}, getXMLAnswer: function () {} };
ajax.addParam("method", "getManager");
ajax.getXMLAnswer(handleAnswer);`));

  it("skips server files", () =>
    void expectSkipped(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getXMLAnswer(handleAnswer);`,
      { filename: "helper.si.js" },
    ));

  it("covers every supported terminal request call", () => {
    for (const method of ["getXML", "getXMLAnswer", "getXMLWait"]) {
      expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.${method}(handleAnswer);`);
    }
  });

  it("flags additional parameter prefix mistakes", () =>
    void expectInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.addParam("user_id", "abc");
ajax.getXMLAnswer(handleAnswer);`,
      { messageId: "badPrefix" },
    ));

  it("stays silent after the object escapes", () =>
    void expectActive(`var ajax = new GlideAjax("x_acme.UserLookup");
prepare(ajax);
ajax.getXMLAnswer(handleAnswer);`));

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
      expectActive(code);
    }
  });
});
