import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {} from "../helpers/rule-tester.js";

describe("no-glideajax-getanswer", () => {
  const { expectInvalid, expectValid, expectActive, expectSkipped } = ruleTester(
    "no-glideajax-getanswer",
    {},
    { messageId: "getAnswer" },
  );

  it("flags a direct getAnswer call", () =>
    void expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXML(handleResponse);
var answer = ajax.getAnswer();`));

  it("flags the documented synchronous sequence", () =>
    void expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLWait();
var answer = ajax.getAnswer();`));

  it("allows getXMLAnswer with a callback", () =>
    void expectValid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(function (answer) {
  g_form.setValue("u_manager", answer);
});`));

  it("ignores an unrelated object with getAnswer", () =>
    void expectActive(`var ajax = { getAnswer: function () { return "x"; } };
var answer = ajax.getAnswer();`));

  it("tracks aliases and ignores reassignment", () => {
    expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
var req = ajax;
req.getAnswer();`);
    expectValid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax = other;
ajax.getAnswer();`);
  });

  it("ignores a shadowed GlideAjax", () =>
    void expectActive(`function GlideAjax() { this.getAnswer = function () { return ""; }; }
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`));

  it("flags a client UI Action", () =>
    void expectInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      undefined,
      { filename: "approve.client.ui-action.js" },
    ));

  it("skips server files", () =>
    void expectSkipped(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      { filename: "helper.si.js" },
    ));

  it("supports a static computed member", () =>
    void expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax["getAnswer"]();`));

  it("stays silent when getAnswer no longer has platform identity", () => {
    for (const code of [
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();
ajax.getAnswer = localAnswer;`,
      `GlideAjax.prototype.getAnswer = localAnswer;
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      `GlideAjax.prototype = localPrototype;
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      `const { prototype: ajaxPrototype } = GlideAjax;
ajaxPrototype.getAnswer = localAnswer;
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      `const { prototype: ajaxPrototype = GlideAjax.prototype } = GlideAjax;
ajaxPrototype.getAnswer = localAnswer;
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      `const localAjax = {};
const { prototype: ajaxPrototype = GlideAjax.prototype } = localAjax;
ajaxPrototype.getAnswer = localAnswer;
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      `GlideAjax = LocalGlideAjax;
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      `eval("GlideAjax.prototype.getAnswer = localAnswer");
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
    ]) {
      expectActive(code);
    }
  });

  it("uses browser mutation semantics for client API authority", () => {
    const options = {
      filename: "incident.client.js",
      settings: { javascriptMode: "es5" as const },
    };
    for (const code of [
      `var ajax = new GlideAjax("x_acme.UserLookup");
Reflect.set(ajax, "getAnswer", localAnswer);
ajax.getAnswer();`,
      `var ajax = new GlideAjax("x_acme.UserLookup");
Object.assign(ajax, { getAnswer: localAnswer });
ajax.getAnswer();`,
    ]) {
      expectValid(code, options);
    }
  });
});
