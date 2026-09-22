import { describe, it } from "node:test";
import {
  assertInvalid,
  assertSkipped,
  assertValid,
  assertValidActive,
} from "../helpers/rule-tester.js";

const RULE = "no-glideajax-getanswer" as const;

describe("no-glideajax-getanswer", () => {
  it("flags a direct getAnswer call", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXML(handleResponse);
var answer = ajax.getAnswer();`,
      RULE,
      { messageId: "getAnswer" },
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
    );
  });

  it("ignores an unrelated object with getAnswer", () => {
    assertValidActive(
      `var ajax = { getAnswer: function () { return "x"; } };
var answer = ajax.getAnswer();`,
      RULE,
    );
  });

  it("tracks aliases and ignores reassignment", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
var req = ajax;
req.getAnswer();`,
      RULE,
      { messageId: "getAnswer" },
    );
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax = other;
ajax.getAnswer();`,
      RULE,
    );
  });

  it("ignores a shadowed GlideAjax", () => {
    assertValidActive(
      `function GlideAjax() { this.getAnswer = function () { return ""; }; }
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.getAnswer();`,
      RULE,
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
    assertSkipped(
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
      assertValidActive(code, RULE);
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
