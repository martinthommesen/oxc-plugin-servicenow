import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {} from "../helpers/rule-tester.js";

describe("require-callback-for-getreference", () => {
  const { expectInvalid, expectValid, expectActive, expectSkipped } = ruleTester(
    "require-callback-for-getreference",
    {},
    { messageId: "missingCallback" },
  );

  it("flags one argument", () =>
    void expectInvalid(`function onChange() {
  var caller = g_form.getReference("caller_id");
  g_form.setValue("u_manager", caller.manager);
}`));

  it("allows two arguments", () =>
    void expectValid(`function onChange() {
  g_form.getReference("caller_id", function (caller) {
    g_form.setValue("u_manager", caller.manager);
  });
}`));

  it("flags undefined and null callbacks", () => {
    expectInvalid(`g_form.getReference("caller_id", undefined);`);
    expectInvalid(`g_form.getReference("caller_id", null);`);
  });

  it("allows inline, arrow, and named callbacks", () => {
    expectValid(`g_form.getReference("caller_id", handleCaller);`);
    expectValid(
      `g_form.getReference("caller_id", (caller) => g_form.setValue("u_manager", caller.manager));`,
    );
    expectValid(`function handleCaller(caller) { g_form.setValue("u_manager", caller.manager); }
g_form.getReference("caller_id", handleCaller);`);
    expectValid(`const handleCaller = (caller) => g_form.setValue("u_manager", caller.manager);
g_form.getReference("caller_id", handleCaller);`);
    expectValid(`function handleCaller(caller) { g_form.setValue("u_manager", caller.manager); }
const callback = handleCaller;
const alias = callback;
g_form.getReference("caller_id", alias);`);
  });

  it("resolves immutable nullish and non-callable callback aliases", () => {
    expectInvalid(`const callback = undefined;
g_form.getReference("caller_id", callback);`);
    expectInvalid(`const callback = null;
g_form.getReference("caller_id", callback);`);
    expectInvalid(
      `const value = 42;
const callback = value;
g_form.getReference("caller_id", callback);`,
      { messageId: "invalidCallback" },
    );
    expectInvalid(
      `class Callback {}
g_form.getReference("caller_id", Callback);`,
      { messageId: "invalidCallback" },
    );
  });

  it("keeps mutable and shadowed callback values unknown", () => {
    expectValid(`let callback = 42;
g_form.getReference("caller_id", callback);`);
    expectValid(`function onChange(undefined) {
  const callback = undefined;
  g_form.getReference("caller_id", callback);
}`);
    expectValid(`class Callback {}
Callback = function () {};
g_form.getReference("caller_id", Callback);`);
    expectValid(`g_form.getReference("caller_id", callback);
const callback = 42;`);
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
      expectInvalid(`g_form.getReference("caller_id", ${callback});`, {
        messageId: "invalidCallback",
      });
    }
  });

  it("supports a static computed member", () =>
    void expectInvalid(`g_form["getReference"]("caller_id");`));

  it("tracks a simple alias", () =>
    void expectInvalid(`var form = g_form;
form.getReference("caller_id");`));

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
      expectActive(code);
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
      expectValid(code, options);
    }
  });

  it("keeps unrelated Reflect.apply mutations precise for a stable let array", () =>
    void expectInvalid(
      `let args = [g_form, "setValue", { value: custom }];
Reflect.apply(Object.defineProperty, Object, args);
g_form.getReference("caller_id");`,
      undefined,
      {
        filename: "incident.client.js",
        settings: { javascriptMode: "es2021" },
      },
    ));

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
      expectValid(code);
    }
  });

  it("ignores a shadowed g_form", () =>
    void expectActive(`function onChange(g_form) {
  g_form.getReference("caller_id");
}`));

  it("skips server files", () =>
    void expectSkipped(`var caller = g_form.getReference("caller_id");`, {
      filename: "helper.si.js",
    }));

  it("flags a client UI Action", () =>
    void expectInvalid(
      `function approve() {
  var user = g_form.getReference("opened_by");
  g_form.setValue("u_manager", user.manager);
}`,
      undefined,
      { filename: "approve.client.ui-action.js" },
    ));

  it("ignores comments and strings", () => {
    expectActive(`var note = "g_form.getReference(\\"caller_id\\")";
// g_form.getReference("caller_id")
g_form.setValue("u_note", note);`);
  });

  it("allows optional chaining when the callback is present", () =>
    void expectValid(`g_form.getReference("caller_id", function (caller) {
    caller?.manager;
  });`));
  it("does not claim a spread call is callback-free", () => {
    expectActive("g_form.getReference(...args);");
    expectActive(`g_form.getReference("caller_id", ...args);`);
  });
});
