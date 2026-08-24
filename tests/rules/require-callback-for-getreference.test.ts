import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "require-callback-for-getreference" as const;
const CLIENT = { filename: "incident.client.js" };

describe("require-callback-for-getreference", () => {
  it("flags one argument", () => {
    assertInvalid(
      `function onChange() {
  var caller = g_form.getReference("caller_id");
  g_form.setValue("u_manager", caller.manager);
}`,
      RULE,
      { messageId: "missingCallback" },
      CLIENT,
    );
  });

  it("allows two arguments", () => {
    assertValid(
      `function onChange() {
  g_form.getReference("caller_id", function (caller) {
    g_form.setValue("u_manager", caller.manager);
  });
}`,
      RULE,
      CLIENT,
    );
  });

  it("flags undefined and null callbacks", () => {
    assertInvalid(
      `g_form.getReference("caller_id", undefined);`,
      RULE,
      { messageId: "missingCallback" },
      CLIENT,
    );
    assertInvalid(
      `g_form.getReference("caller_id", null);`,
      RULE,
      { messageId: "missingCallback" },
      CLIENT,
    );
  });

  it("allows inline, arrow, and named callbacks", () => {
    assertValid(`g_form.getReference("caller_id", handleCaller);`, RULE, CLIENT);
    assertValid(
      `g_form.getReference("caller_id", (caller) => g_form.setValue("u_manager", caller.manager));`,
      RULE,
      CLIENT,
    );
    assertValid(
      `function handleCaller(caller) { g_form.setValue("u_manager", caller.manager); }
g_form.getReference("caller_id", handleCaller);`,
      RULE,
      CLIENT,
    );
    assertValid(
      `const handleCaller = (caller) => g_form.setValue("u_manager", caller.manager);
g_form.getReference("caller_id", handleCaller);`,
      RULE,
      CLIENT,
    );
    assertValid(
      `function handleCaller(caller) { g_form.setValue("u_manager", caller.manager); }
const callback = handleCaller;
const alias = callback;
g_form.getReference("caller_id", alias);`,
      RULE,
      CLIENT,
    );
  });

  it("resolves immutable nullish and non-callable callback aliases", () => {
    assertInvalid(
      `const callback = undefined;
g_form.getReference("caller_id", callback);`,
      RULE,
      { messageId: "missingCallback" },
      CLIENT,
    );
    assertInvalid(
      `const callback = null;
g_form.getReference("caller_id", callback);`,
      RULE,
      { messageId: "missingCallback" },
      CLIENT,
    );
    assertInvalid(
      `const value = 42;
const callback = value;
g_form.getReference("caller_id", callback);`,
      RULE,
      { messageId: "invalidCallback" },
      CLIENT,
    );
    assertInvalid(
      `class Callback {}
g_form.getReference("caller_id", Callback);`,
      RULE,
      { messageId: "invalidCallback" },
      CLIENT,
    );
  });

  it("keeps mutable and shadowed callback values unknown", () => {
    assertValid(
      `let callback = 42;
g_form.getReference("caller_id", callback);`,
      RULE,
      CLIENT,
    );
    assertValid(
      `function onChange(undefined) {
  const callback = undefined;
  g_form.getReference("caller_id", callback);
}`,
      RULE,
      CLIENT,
    );
    assertValid(
      `class Callback {}
Callback = function () {};
g_form.getReference("caller_id", Callback);`,
      RULE,
      CLIENT,
    );
    assertValid(
      `g_form.getReference("caller_id", callback);
const callback = 42;`,
      RULE,
      CLIENT,
    );
  });

  it("flags statically non-callable callbacks", () => {
    for (const callback of [
      "false",
      "42",
      '"handler"',
      "`handler`",
      "{}",
      "[]",
      "class Handler {}",
    ]) {
      assertInvalid(
        `g_form.getReference("caller_id", ${callback});`,
        RULE,
        { messageId: "invalidCallback" },
        CLIENT,
      );
    }
  });

  it("supports a static computed member", () => {
    assertInvalid(
      `g_form["getReference"]("caller_id");`,
      RULE,
      { messageId: "missingCallback" },
      CLIENT,
    );
  });

  it("tracks a simple alias", () => {
    assertInvalid(
      `var form = g_form;
form.getReference("caller_id");`,
      RULE,
      { messageId: "missingCallback" },
      CLIENT,
    );
  });

  it("stays silent when getReference no longer has platform identity", () => {
    for (const code of [
      `g_form.getReference("caller_id");
g_form.getReference = localReference;`,
      `var form = g_form;
form.getReference = localReference;
form.getReference("caller_id");`,
      `function readReference() {
  var form = g_form;
  form.getReference("caller_id");
}
g_form = localForm;
readReference();`,
      `Object.defineProperty(GlideForm.prototype, "getReference", { value: localReference });
g_form.getReference("caller_id");`,
      `GlideForm.prototype = localPrototype;
g_form.getReference("caller_id");`,
      `const { prototype: formPrototype } = GlideForm;
formPrototype.getReference = localReference;
g_form.getReference("caller_id");`,
      `eval("g_form.getReference = localReference");
g_form.getReference("caller_id");`,
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
      `Reflect.set(g_form, "getReference", localReference);
g_form.getReference("caller_id");`,
      `Object.assign(g_form, { getReference: localReference });
g_form.getReference("caller_id");`,
      `Reflect.apply(Object.defineProperty, Object, [g_form, "getReference", { value: localReference }]);
g_form.getReference("caller_id");`,
    ]) {
      assertValid(code, RULE, options);
    }
  });

  it("ignores a shadowed g_form", () => {
    assertValid(
      `function onChange(g_form) {
  g_form.getReference("caller_id");
}`,
      RULE,
      CLIENT,
    );
  });

  it("skips server files", () => {
    assertValid(`var caller = g_form.getReference("caller_id");`, RULE, {
      filename: "helper.si.js",
    });
  });

  it("flags a client UI Action", () => {
    assertInvalid(
      `function approve() {
  var user = g_form.getReference("opened_by");
  g_form.setValue("u_manager", user.manager);
}`,
      RULE,
      { messageId: "missingCallback" },
      { filename: "approve.client.ui-action.js" },
    );
  });

  it("ignores comments and strings", () => {
    assertValid(
      `var note = "g_form.getReference(\\"caller_id\\")";
// g_form.getReference("caller_id")
g_form.setValue("u_note", note);`,
      RULE,
      CLIENT,
    );
  });

  it("allows optional chaining when the callback is present", () => {
    assertValid(
      `g_form.getReference("caller_id", function (caller) {
    caller?.manager;
  });`,
      RULE,
      CLIENT,
    );
  });
});
