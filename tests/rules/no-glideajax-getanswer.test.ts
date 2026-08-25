import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-glideajax-getanswer" as const;
const CLIENT = { filename: "incident.client.js" };

describe("no-glideajax-getanswer", () => {
  it("flags a direct getAnswer call", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXML(handleResponse);
var answer = ajax.getAnswer();`,
      RULE,
      { messageId: "getAnswer" },
      CLIENT,
    );
  });

  it("flags the documented synchronous sequence", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLWait();
var answer = ajax.getAnswer();`,
      RULE,
      { messageId: "getAnswer" },
      CLIENT,
    );
  });

  it("allows getXMLAnswer with a callback", () => {
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(function (answer) {
  g_form.setValue("u_manager", answer);
});`,
      RULE,
      CLIENT,
    );
  });

  it("ignores an unrelated object with getAnswer", () => {
    assertValid(
      `var ajax = { getAnswer: function () { return "x"; } };
var answer = ajax.getAnswer();`,
      RULE,
      CLIENT,
    );
  });

  it("tracks aliases and ignores reassignment", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
var req = ajax;
req.getAnswer();`,
      RULE,
      { messageId: "getAnswer" },
      CLIENT,
    );
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax = other;
ajax.getAnswer();`,
      RULE,
      CLIENT,
    );
  });

  it("ignores a shadowed GlideAjax", () => {
    assertValid(
      `function GlideAjax() { this.getAnswer = function () { return ""; }; }
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      RULE,
      CLIENT,
    );
  });

  it("flags a client UI Action", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      RULE,
      { messageId: "getAnswer" },
      { filename: "approve.client.ui-action.js" },
    );
  });

  it("skips server files", () => {
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      RULE,
      { filename: "helper.si.js" },
    );
  });

  it("supports a static computed member", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax["getAnswer"]();`,
      RULE,
      { messageId: "getAnswer" },
      CLIENT,
    );
  });

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
      `GlideAjax = LocalGlideAjax;
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      `eval("GlideAjax.prototype.getAnswer = localAnswer");
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
    ]) {
      assertValid(code, RULE, CLIENT);
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
      assertValid(code, RULE, options);
    }
  });
});
