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
    assertValid(`g_form.getReference("caller_id", (caller) => g_form.setValue("u_manager", caller.manager));`, RULE, CLIENT);
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
