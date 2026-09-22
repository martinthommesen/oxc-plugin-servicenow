import { describe, it } from "node:test";
import {
  assertInvalid,
  assertSkipped,
  assertValid,
  assertValidActive,
} from "../helpers/rule-tester.js";

const RULE = "require-callback-for-getreference" as const;

describe("require-callback-for-getreference", () => {
  it("flags one argument", () => {
    assertInvalid(
      `function onChange() {
  var caller = g_form.getReference("caller_id");
  g_form.setValue("u_manager", caller.manager);
}`,
      RULE,
      { messageId: "missingCallback" },
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
    );
  });

  it("flags undefined and null callbacks", () => {
    assertInvalid(`g_form.getReference("caller_id", undefined);`, RULE, {
      messageId: "missingCallback",
    });
    assertInvalid(`g_form.getReference("caller_id", null);`, RULE, {
      messageId: "missingCallback",
    });
  });

  it("allows inline, arrow, and named callbacks", () => {
    assertValid(`g_form.getReference("caller_id", handleCaller);`, RULE);
    assertValid(
      `g_form.getReference("caller_id", (caller) => g_form.setValue("u_manager", caller.manager));`,
      RULE,
    );
    assertValid(
      `function handleCaller(caller) { g_form.setValue("u_manager", caller.manager); }
g_form.getReference("caller_id", handleCaller);`,
      RULE,
    );
    assertValid(
      `const handleCaller = (caller) => g_form.setValue("u_manager", caller.manager);
g_form.getReference("caller_id", handleCaller);`,
      RULE,
    );
    assertValid(
      `function handleCaller(caller) { g_form.setValue("u_manager", caller.manager); }
const callback = handleCaller;
const alias = callback;
g_form.getReference("caller_id", alias);`,
      RULE,
    );
  });

  it("resolves immutable nullish and non-callable callback aliases", () => {
    assertInvalid(
      `const callback = undefined;
g_form.getReference("caller_id", callback);`,
      RULE,
      { messageId: "missingCallback" },
    );
    assertInvalid(
      `const callback = null;
g_form.getReference("caller_id", callback);`,
      RULE,
      { messageId: "missingCallback" },
    );
    assertInvalid(
      `const value = 42;
const callback = value;
g_form.getReference("caller_id", callback);`,
      RULE,
      { messageId: "invalidCallback" },
    );
    assertInvalid(
      `class Callback {}
g_form.getReference("caller_id", Callback);`,
      RULE,
      { messageId: "invalidCallback" },
    );
  });

  it("keeps mutable and shadowed callback values unknown", () => {
    assertValid(
      `let callback = 42;
g_form.getReference("caller_id", callback);`,
      RULE,
    );
    assertValid(
      `function onChange(undefined) {
  const callback = undefined;
  g_form.getReference("caller_id", callback);
}`,
      RULE,
    );
    assertValid(
      `class Callback {}
Callback = function () {};
g_form.getReference("caller_id", Callback);`,
      RULE,
    );
    assertValid(
      `g_form.getReference("caller_id", callback);
const callback = 42;`,
      RULE,
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
      assertInvalid(`g_form.getReference("caller_id", ${callback});`, RULE, {
        messageId: "invalidCallback",
      });
    }
  });

  it("supports a static computed member", () => {
    assertInvalid(`g_form["getReference"]("caller_id");`, RULE, { messageId: "missingCallback" });
  });

  it("tracks a simple alias", () => {
    assertInvalid(
      `var form = g_form;
form.getReference("caller_id");`,
      RULE,
      { messageId: "missingCallback" },
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
      assertValidActive(code, RULE);
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
      `Reflect.apply(Reflect.apply, Reflect, [Object.defineProperty, Object, [g_form, "getReference", { value: localReference }]]);
g_form.getReference("caller_id");`,
      `const args = [Object.defineProperty, Object, [g_form, "getReference", { value: localReference }]];
Reflect.apply(...args);
g_form.getReference("caller_id");`,
      `Reflect.apply(prepare, g_form, []);
g_form.getReference("caller_id");`,
      `Reflect.apply(prepare, null, [g_form]);
g_form.getReference("caller_id");`,
      `Reflect.construct(Preparation, [g_form]);
g_form.getReference("caller_id");`,
      `Reflect.deleteProperty(g_form, "getReference");
g_form.getReference("caller_id");`,
    ]) {
      assertValid(code, RULE, options);
    }
  });

  it("keeps unrelated Reflect.apply mutations precise for a stable let array", () => {
    assertInvalid(
      `let args = [g_form, "setValue", { value: custom }];
Reflect.apply(Object.defineProperty, Object, args);
g_form.getReference("caller_id");`,
      RULE,
      { messageId: "missingCallback" },
      {
        filename: "incident.client.js",
        settings: { javascriptMode: "es2021" },
      },
    );
  });

  it("tracks defaulted destructured prototype aliases as possible platform owners", () => {
    for (const code of [
      `const { prototype: formPrototype = GlideForm.prototype } = GlideForm;
formPrototype.getReference = localReference;
g_form.getReference("caller_id");`,
      `const localForm = {};
const { prototype: formPrototype = GlideForm.prototype } = localForm;
formPrototype.getReference = localReference;
g_form.getReference("caller_id");`,
    ]) {
      assertValid(code, RULE);
    }
  });

  it("ignores a shadowed g_form", () => {
    assertValidActive(
      `function onChange(g_form) {
  g_form.getReference("caller_id");
}`,
      RULE,
    );
  });

  it("skips server files", () => {
    assertSkipped(`var caller = g_form.getReference("caller_id");`, RULE, {
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
    assertValidActive(
      `var note = "g_form.getReference(\\"caller_id\\")";
// g_form.getReference("caller_id")
g_form.setValue("u_note", note);`,
      RULE,
    );
  });

  it("allows optional chaining when the callback is present", () => {
    assertValid(
      `g_form.getReference("caller_id", function (caller) {
    caller?.manager;
  });`,
      RULE,
    );
  });
  it("does not claim a spread call is callback-free", () => {
    assertValidActive("g_form.getReference(...args);", RULE);
    assertValidActive(`g_form.getReference("caller_id", ...args);`, RULE);
  });
});
