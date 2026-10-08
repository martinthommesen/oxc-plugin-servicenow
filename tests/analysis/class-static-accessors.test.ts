import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function findings(body: string, expected: number): void {
  const { messages, analysis } = lintWithAnalysis(
    `var run = false; var records = new GlideRecord("task"); ${body} run &&= records.deleteMultiple();`,
    "no-unfiltered-gliderecord-bulk-operation",
  );
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  assert.equal(messages.length, expected);
}

// @lat: [[tests#Analysis behavior#Static class accessors invalidate captures in evaluation order]]
describe("static class accessor boundaries", () => {
  for (const [name, members, effect] of [
    ["setter", "static set flag(value) { run = true; }", "Toggle.flag = 1;"],
    ["getter", "static get flag() { run = true; }", "var value = Toggle.flag;"],
    [
      "computed literal setter",
      'static set ["flag"](value) { run = true; }',
      'Toggle["flag"] = 1;',
    ],
    [
      "computed literal getter",
      'static get ["flag"]() { run = true; }',
      'var value = Toggle["flag"];',
    ],
    [
      "alias setter",
      "static set flag(value) { run = true; }",
      "var alias = Toggle; alias.flag = 1;",
    ],
    [
      "alias getter",
      "static get flag() { run = true; }",
      "var alias = Toggle; var value = alias.flag;",
    ],
    [
      "compound getter",
      "static get flag() { run = true; } static set flag(value) {}",
      "Toggle.flag += 1;",
    ],
    [
      "compound setter",
      "static get flag() {} static set flag(value) { run = true; }",
      "Toggle.flag += 1;",
    ],
    [
      "prefix update",
      "static get flag() {} static set flag(value) { run = true; }",
      "++Toggle.flag;",
    ],
    [
      "postfix update",
      "static get flag() { run = true; } static set flag(value) {}",
      "Toggle.flag++;",
    ],
    ["logical getter", "static get flag() { run = true; }", "Toggle.flag &&= 1;"],
    ["logical setter", "static set flag(value) { run = true; }", "Toggle.flag ||= 1;"],
    ["nullable setter", "static set flag(value) { run = true; }", "Toggle.flag ??= 1;"],
    ["callee getter", "static get flag() { run = true; }", "Toggle.flag();"],
    ["tag getter", "static get flag() { run = true; }", "Toggle.flag``;"],
  ] as const) {
    it(`exposes captures of a selected ${name}`, () => {
      findings(`class Toggle { ${members} } ${effect}`, 1);
    });
  }

  for (const [name, members, effect] of [
    ["setter read", "static set flag(value) { run = true; }", "var value = Toggle.flag;"],
    ["getter write", "static get flag() { run = true; }", "Toggle.flag = 1;"],
    [
      "unrelated field",
      "static get other() { run = true; } static flag = 0;",
      "var value = Toggle.flag;",
    ],
    [
      "unrelated method",
      "static get other() { run = true; } static flag() {}",
      "var value = Toggle.flag;",
    ],
    [
      "field masks getter",
      "static flag = 0; static get flag() { run = true; }",
      "var value = Toggle.flag;",
    ],
    [
      "last method masks getter",
      "static get flag() { run = true; } static flag() {}",
      "var value = Toggle.flag;",
    ],
    ["instance getter", "get flag() { run = true; }", "var value = Toggle.flag;"],
    ["delete reference", "static get flag() { run = true; }", "delete Toggle.flag;"],
  ] as const) {
    it(`does not invoke a ${name}`, () => {
      findings(`class Toggle { ${members} } ${effect}`, 0);
    });
  }

  it("follows a selected frozen superclass after its binding is replaced", () => {
    findings(
      "class Base { static set flag(value) { run = true; } } class Toggle extends Base {} Base = class {}; Toggle.flag = 1;",
      1,
    );
  });
  it("keeps a selected safe superclass after a later unsafe replacement", () => {
    findings(
      "class Base {} class Toggle extends Base {} Base = class { static set flag(value) { run = true; } }; Toggle.flag = 1;",
      0,
    );
  });
  it("masks an inherited setter with an own getter-only descriptor", () => {
    findings(
      "class Base { static set flag(value) { run = true; } } class Toggle extends Base { static get flag() {} } Toggle.flag = 1;",
      0,
    );
  });
  it("masks an inherited getter with an own data property", () => {
    findings(
      "class Base { static get flag() { run = true; } } class Toggle extends Base { static flag = 0; } var value = Toggle.flag;",
      0,
    );
  });
  it("keeps unknown computed accessors possible", () => {
    findings("class Toggle { static set [external](value) { run = true; } } Toggle.flag = 1;", 1);
  });
  it("keeps matching accessor effects for an unknown computed read", () => {
    findings("class Toggle { static get flag() { run = true; } } var value = Toggle[external];", 1);
  });
  it("saves the write receiver before RHS replacement", () => {
    findings(
      "class Toggle { static set flag(value) { run = true; } } Toggle.flag = (Toggle = class {});",
      1,
    );
  });
  it("keeps an initially plain receiver after RHS replacement", () => {
    findings(
      "class Toggle {} Toggle.flag = (Toggle = class { static set flag(value) { run = true; } }, 0);",
      0,
    );
  });
  it("saves the write receiver before computed-key replacement", () => {
    findings(
      'class Toggle { static set flag(value) { run = true; } } Toggle[(Toggle = class {}, "flag")] = 1;',
      1,
    );
  });
  it("keeps an unknown receiver after key replacement", () => {
    findings(
      'var Toggle = external; Toggle[(Toggle = class { static set flag(value) { run = true; } }, "flag")] = 1;',
      0,
    );
  });
  it("skips the setter after a throwing RHS", () => {
    findings(
      "function fail() { throw 0; } class Toggle { static set flag(value) { run = true; } } try { Toggle.flag = fail(); } catch (error) {}",
      0,
    );
  });
  it("keeps getter effects before a throwing compound RHS", () => {
    findings(
      "function fail() { throw 0; } class Toggle { static get flag() { run = true; } } try { Toggle.flag += fail(); } catch (error) {}",
      1,
    );
  });
  it("skips accessor effects after a throwing key", () => {
    findings(
      "function fail() { throw 0; } class Toggle { static get flag() { run = true; } static set flag(value) { run = true; } } try { Toggle[fail()] += 1; } catch (error) {}",
      0,
    );
  });
  it("keeps getter effects before throwing call arguments", () => {
    findings(
      "function fail() { throw 0; } class Toggle { static get flag() { run = true; } } try { Toggle.flag(fail()); } catch (error) {}",
      1,
    );
  });
  it("keeps getter effects before throwing tag substitutions", () => {
    findings(
      "function fail() { throw 0; } class Toggle { static get flag() { run = true; } } try { Toggle.flag`${fail()}`; } catch (error) {}",
      1,
    );
  });
  it("retains matching getter and setter functions as a pair", () => {
    findings(
      "class Toggle { static get flag() { run = true; } static set flag(value) {} } Toggle.flag += 1;",
      1,
    );
  });
  it("preserves correlated class receiver alternatives", () => {
    findings(
      "class Unsafe { static set flag(value) { run = true; } } class Safe {} var Toggle = external ? Unsafe : Safe; Toggle.flag = 1;",
      1,
    );
  });
  it("reuses bounded descriptor lookup for two hundred unrelated plain reads", () => {
    findings(
      `class Toggle { static get flag() { run = true; } static plain = 0; } ${"Toggle.plain;".repeat(200)}`,
      0,
    );
  });
  it("keeps inherited accessors possible after an opaque static block changes own descriptors", () => {
    findings(
      "class Base { static set flag(value) { run = true; } } class Toggle extends Base { static flag = 0; static { delete this.flag; } } Toggle.flag = 1;",
      1,
    );
  });
  it("restores a definite own field after an earlier static block", () => {
    findings(
      "class Base { static set flag(value) { run = true; } } class Toggle extends Base { static {} static flag = 0; } Toggle.flag = 1;",
      0,
    );
  });
  it("does not invoke a parenthesized deleted getter", () => {
    findings("class Toggle { static get flag() { run = true; } } delete (Toggle.flag);", 0);
  });
  it("saves the read receiver before computed-key replacement", () => {
    findings(
      'class Toggle { static get flag() { run = true; } } var value = Toggle[(Toggle = class {}, "flag")];',
      1,
    );
  });
  it("keeps an initially plain read receiver after computed-key replacement", () => {
    findings(
      'class Toggle {} var value = Toggle[(Toggle = class { static get flag() { run = true; } }, "flag")];',
      0,
    );
  });
  it("keeps a later exact data member over an earlier unknown accessor", () => {
    findings(
      "class Toggle { static get [external]() { run = true; } static flag() {} } var value = Toggle.flag;",
      0,
    );
  });
  it("follows a matching inherited getter through a setter-only unrelated property", () => {
    findings(
      "class Base { static get flag() { run = true; } } class Toggle extends Base { static set other(value) {} } var value = Toggle.flag;",
      1,
    );
  });
  it("masks an inherited getter with an own setter-only descriptor", () => {
    findings(
      "class Base { static get flag() { run = true; } } class Toggle extends Base { static set flag(value) {} } var value = Toggle.flag;",
      0,
    );
  });
  it("keeps setter effects out of a getter followed by a throwing logical RHS", () => {
    findings(
      "function fail() { throw 0; } class Toggle { static get flag() {} static set flag(value) { run = true; } } try { Toggle.flag ||= fail(); } catch (error) {}",
      0,
    );
  });
  it("does not infer accessor return values for logical assignment pruning", () => {
    findings(
      "class Toggle { static get flag() { return false; } static set flag(value) { run = true; } } Toggle.flag &&= 1;",
      1,
    );
  });
  for (const size of [50, 200]) {
    it(`keeps ${size} distinct known plain properties independent from accessors`, () => {
      findings(
        `class Toggle { static get other() { run = true; } ${Array.from({ length: size }, (_, index) => `static field${index} = 0;`).join(" ")} } ${Array.from({ length: size }, (_, index) => `Toggle.field${index};`).join(" ")}`,
        0,
      );
    });
    it(`walks ${size} inherited class values without recursive accessor lookup`, () => {
      findings(
        `class Base { static set flag(value) { run = true; } } ${Array.from({ length: size }, (_, index) => `class Level${index} extends ${index ? `Level${index - 1}` : "Base"} {}`).join(" ")} Level${size - 1}.flag = 1;`,
        1,
      );
    });
  }
  for (const kind of ["get", "set"] as const) {
    it(`uses the ${kind} boundary's current captured record`, () => {
      const code = `var records = new GlideRecord("task"); var prior = records; class Toggle { static ${kind} flag${kind === "get" ? "()" : "(value)"} { records.query(); } }
Toggle.flag ${kind === "get" ? "+=" : "="} (records = new GlideRecord("incident"), 0);
prior.next();
records.next();`;
      const { messages, analysis } = lintWithAnalysis(code, "require-query-before-next");
      assert.equal(analysis.pathBudgetExhausted, false);
      assert.ok(messages.every((message) => message.messageId === "missingQuery"));
      assert.deepEqual(
        messages.map((message) => message.line),
        [kind === "get" ? 4 : 3],
      );
    });
  }

  for (const kind of ["get", "set"] as const) {
    it(`reveals an inherited ${kind} after deleting an own data property`, () => {
      findings(
        `class Base { static ${kind} flag${kind === "get" ? "()" : "(value)"} { run = true; } } class Toggle extends Base { static flag = 0; } delete Toggle.flag; ${kind === "get" ? "var value = Toggle.flag;" : "Toggle.flag = 1;"}`,
        1,
      );
    });
    it(`invalidates an already cached descendant ${kind} lookup`, () => {
      findings(
        `class Grand { static ${kind} flag${kind === "get" ? "()" : "(value)"} { run = true; } } class Base extends Grand { static flag = 0; } class Toggle extends Base {} var before = Toggle.flag; delete Base.flag; ${kind === "get" ? "var after = Toggle.flag;" : "Toggle.flag = 1;"}`,
        1,
      );
    });
  }
  it("degrades the selected alias when a delete key replaces its binding", () => {
    findings(
      'class Base { static set flag(value) { run = true; } } class Toggle extends Base { static flag = 0; } var alias = Toggle; delete Toggle[(Toggle = class {}, "flag")]; alias.flag = 1;',
      1,
    );
  });
  it("keeps an unknown delete receiver unknown after key replacement", () => {
    findings(
      'class Base { static set flag(value) { run = true; } } class Toggle extends Base { static flag = 0; } var receiver = external; delete receiver[(receiver = Toggle, "flag")]; Toggle.flag = 1;',
      0,
    );
  });
  it("keeps a possible conditional delete visible to later lookups", () => {
    findings(
      "class Base { static get flag() { run = true; } } class Toggle extends Base { static flag = 0; } if (external) delete Toggle.flag; var value = Toggle.flag;",
      1,
    );
  });
  it("does not degrade a definitely skipped delete", () => {
    findings(
      "class Base { static get flag() { run = true; } } class Toggle extends Base { static flag = 0; } if (false) delete Toggle.flag; var value = Toggle.flag;",
      0,
    );
  });
  it("does not expose inherited captures when no lookup follows the delete", () => {
    findings(
      "class Base { static get flag() { run = true; } } class Toggle extends Base { static flag = 0; } delete Toggle.flag;",
      0,
    );
  });
  it("keeps another exact property shadowed after an unrelated delete", () => {
    findings(
      "class Base { static get flag() { run = true; } } class Toggle extends Base { static flag = 0; static other = 0; } delete Toggle.other; var value = Toggle.flag;",
      0,
    );
  });
  it("does not degrade a different class value", () => {
    findings(
      "class Base { static get flag() { run = true; } } class Toggle extends Base { static flag = 0; } class Other { static flag = 0; } delete Other.flag; var value = Toggle.flag;",
      0,
    );
  });
  it("does not degrade the class after an abrupt delete key", () => {
    findings(
      "function fail() { throw 0; } class Base { static get flag() { run = true; } } class Toggle extends Base { static flag = 0; } try { delete Toggle[fail()]; } catch (error) {} var value = Toggle.flag;",
      0,
    );
  });
  it("retains newly exposed setter effects after an RHS deletes the own property", () => {
    findings(
      "class Base { static set flag(value) { run = true; } } class Toggle extends Base { static flag = 0; } Toggle.flag = (delete Toggle.flag, 1);",
      1,
    );
  });
  it("keeps selected old receiver identity when the RHS also replaces its binding", () => {
    findings(
      "class Base { static set flag(value) { run = true; } } class Toggle extends Base { static flag = 0; } Toggle.flag = (delete Toggle.flag, Toggle = class {}, 1);",
      1,
    );
  });
  it("retains inherited getter effects after a computed key deletes the own field", () => {
    findings(
      'class Base { static get flag() { run = true; } } class Toggle extends Base { static flag = 0; } var value = Toggle[(delete Toggle.flag, "flag")];',
      1,
    );
  });
  it("invalidates a deep cached lookup once across repeated deletes", () => {
    findings(
      `class Root { static set flag(value) { run = true; } } class Base extends Root { static flag = 0; } ${Array.from({ length: 200 }, (_, index) => `class Level${index} extends ${index ? `Level${index - 1}` : "Base"} {}`).join(" ")} var before = Level199.flag; ${"delete Base.flag;".repeat(200)} Level199.flag = 1;`,
      1,
    );
  });

  it("degrades all cached exact shadows after an unknown-property delete", () => {
    findings(
      "class Base { static set flag(value) { run = true; } } class Toggle extends Base { static flag = 0; static other = 0; } var before = Toggle.flag; delete Toggle[external]; Toggle.flag = 1;",
      1,
    );
  });
  it("keeps a cached unrelated exact shadow across descendant invalidation", () => {
    findings(
      "class Grand { static get flag() { run = true; } static get other() {} } class Base extends Grand { static flag = 0; static other = 0; } class Toggle extends Base {} var before = Toggle.flag; delete Base.other; var after = Toggle.flag;",
      0,
    );
  });
});
