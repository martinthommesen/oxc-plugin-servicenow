import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function bulkFindings(code: string, expected: number): void {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  assert.equal(messages.length, expected);
}

// @lat: [[tests#Analysis behavior#Class heritage snapshots and long chains preserve unrelated findings]]
describe("class heritage scaling", () => {
  for (const count of [375, 750, 1500]) {
    it(`shares ${count} unused class heritage values across ${count} helper calls`, () => {
      const classes = Array.from(
        { length: count },
        (_, index) => `class Derived${index} extends Base {}`,
      ).join(" ");
      bulkFindings(
        `class Base {} ${classes} function use() {} ${"use();".repeat(count)} new GlideRecord("task").deleteMultiple();`,
        1,
      );
    });
  }
  for (const count of [128, 129, 257, 1024]) {
    it(`runs ${count} known hierarchy levels without dropping later findings`, () => {
      const classes = Array.from(
        { length: count },
        (_, index) =>
          `class C${index} ${index ? `extends C${index - 1}` : ""} { ${index ? "" : 'field = new GlideRecord("task").deleteMultiple();'} }`,
      ).join(" ");
      bulkFindings(
        `${classes} new C${count - 1}(); new GlideRecord("incident").deleteMultiple();`,
        2,
      );
    });
  }
  it("shares fifteen hundred unused heritage values across ordinary branch snapshots", () => {
    const classes = Array.from(
      { length: 1500 },
      (_, index) => `class Derived${index} extends Base {}`,
    ).join(" ");
    bulkFindings(
      `class Base {} ${classes} ${"if (external) gs.info(0);".repeat(1500)} new GlideRecord("task").deleteMultiple();`,
      1,
    );
  });
  it("reuses equal evaluated class values through loop fixpoints", () => {
    bulkFindings(
      'class Base {} var Current; while (external) { Current = class extends Base {}; } new GlideRecord("task").deleteMultiple();',
      1,
    );
  });
  it("retains selected base and scalar correlations after helper-created class values", () => {
    bulkFindings(
      'var run = false; var Base; var Derived; function install() { Derived = class extends Base { field = run &&= new GlideRecord("task").deleteMultiple(); }; } if (external) { run = true; Base = class { field = (run = false); }; install(); } else { run = false; Base = class {}; install(); } new Derived();',
      0,
    );
  });
  for (const [first, second, selected, expected] of [
    ["", 'field = new GlideRecord("task").deleteMultiple();', "Saved", 0],
    ["", 'field = new GlideRecord("task").deleteMultiple();', "Current", 1],
    ['field = new GlideRecord("task").deleteMultiple();', "", "Saved", 1],
    ['field = new GlideRecord("task").deleteMultiple();', "", "Current", 0],
  ] as const) {
    it(`retains the definition-time base of ${selected} after repeated class-site evaluation`, () => {
      bulkFindings(
        `var Base = class { ${first} }; var Current; function install() { Current = class extends Base {}; } install(); var Saved = Current; Base = class { ${second} }; install(); new ${selected}();`,
        expected,
      );
    });
  }
  it("escapes record captures through the selected immutable base", () => {
    bulkFindings(
      'var records = new GlideRecord("task"); var Base = class { field = external(records); }; var Derived = class extends Base {}; Base = class {}; external(Derived); records.deleteMultiple();',
      0,
    );
  });
  it("forgets scalar captures through the selected immutable base", () => {
    bulkFindings(
      'var records = new GlideRecord("task"); var run = false; var Base = class { field = (run = true); }; var Derived = class extends Base {}; Base = class {}; external(Derived); run &&= records.deleteMultiple();',
      1,
    );
  });
  it("does not acquire scalar captures from a later base replacement", () => {
    bulkFindings(
      'var records = new GlideRecord("task"); var run = false; var Base = class {}; var Derived = class extends Base {}; Base = class { field = (run = true); }; external(Derived); run &&= records.deleteMultiple();',
      0,
    );
  });
  for (const payload of [
    "[class extends Base {}, (Base = class {}, 0)]",
    "{ cls: class extends Base {}, later: (Base = class {}, 0) }",
  ]) {
    it(`retains frozen base captures through ${payload}`, () => {
      bulkFindings(
        `var records = new GlideRecord("task"); var Base = class { field = external(records); }; external(${payload}); records.deleteMultiple();`,
        0,
      );
    });
  }
  for (const completion of ["return", "throw"]) {
    it(`retains frozen base captures from a literal exported by ${completion}`, () => {
      const exportValue =
        completion === "return"
          ? "function expose() { var Prior = Base; Base = class {}; return class extends Prior {}; } expose();"
          : "try { var Prior = Base; Base = class {}; throw class extends Prior {}; } catch (error) {}";
      bulkFindings(
        `var records = new GlideRecord("task"); var Base = class { field = external(records); }; ${exportValue} records.deleteMultiple();`,
        0,
      );
    });
  }
  it("follows inherited scalar captures through their saved callable aliases", () => {
    bulkFindings(
      'var records = new GlideRecord("task"); var run = false; function mutate() { run = true; } var Alias = mutate; var Base = class { field = Alias(); }; var Derived = class extends Base {}; Base = class {}; external(Derived); run &&= records.deleteMultiple();',
      1,
    );
  });
});
