import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RuleName } from "../../src/rules/index.js";
import { lintWithAnalysis } from "../helpers/rule-tester.js";
import { assertSubQuadratic } from "../helpers/scaling.js";

function findings(
  code: string,
  expected: number,
  rule: RuleName = "require-query-before-next",
): void {
  const { messages, analysis } = lintWithAnalysis(code, rule);
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.equal(messages.length, expected);
}

const localCursor = 'function() { var gr = new GlideRecord("task"); gr.next(); }';
const selectedCursor = 'function(flag) { var gr = new GlideRecord("task"); flag &&= gr.next(); }';

function uncalledCaller(count: number): string {
  return `var use = ${selectedCursor}; var trigger = function() {
${Array.from({ length: count }, () => "use(false);").join("\n")}
var gr = new GlideRecord("task"); gr.next(); }; void trigger;`;
}

// @lat: [[tests#Analysis behavior#Assigned helper inspection follows actual invocation]]
describe("assigned helper invocation time", () => {
  for (const [name, code] of [
    ["call before assignment", `var use; use(); use = ${localCursor};`],
    ["alias call before assignment", `var use; var alias = use; alias(); use = ${localCursor};`],
    ["alias copied before assignment", `var use; var alias = use; use = ${localCursor}; alias();`],
    ["overwritten origin", `var use = ${localCursor}; use = function() {}; use();`],
    ["skipped invocation", `var use = ${localCursor}; if (false) use();`],
    ["uncalled assignment", `var use; use = ${localCursor};`],
    [
      "nested call before assignment",
      `var use; function trigger() { use(); } trigger(); use = ${localCursor};`,
    ],
  ] as const) {
    it(`retains isolated body inspection for ${name}`, () => findings(code, 1));
  }

  it("retains a replacement body passed to an opaque call method", () => {
    findings(
      'var use = function() {}; use(); use = function() { var gr = new GlideRecord("task"); gr.deleteMultiple(); }; use.call(null);',
      1,
      "no-unfiltered-gliderecord-bulk-operation",
    );
  });

  for (const exposure of ["external(trigger);", ""]) {
    it(`retains the helper visible at callback definition ${exposure ? "and exposure" : "without exposure"}`, () => {
      findings(
        `var use = function(flag) { var records = new GlideRecord("task"); flag &&= records.deleteMultiple(); }; use(false); var trigger = function() { use(true); }; ${exposure} use = function() {};`,
        1,
        "no-unfiltered-gliderecord-bulk-operation",
      );
    });
  }

  it("retains an intermediate helper visible when a callback escapes", () => {
    findings(
      'var use = function() {}; var trigger = function() { use(true); }; use = function(flag) { var records = new GlideRecord("task"); flag &&= records.deleteMultiple(); }; use(false); external(trigger); use = function() {};',
      1,
      "no-unfiltered-gliderecord-bulk-operation",
    );
  });

  const unsafeHelper =
    'var use = function(flag) { var records = new GlideRecord("task"); flag &&= records.deleteMultiple(); }; use(false);';
  for (const [name, body, expected] of [
    [
      "one exposed wrapper",
      "var trigger = function() { use(true); }; var wrapper = function() { trigger(); }; external(wrapper); use = function() {};",
      1,
    ],
    [
      "two exposed wrappers",
      "var trigger = function() { use(true); }; var middle = function() { trigger(); }; var wrapper = function() { middle(); }; external(wrapper); use = function() {};",
      1,
    ],
    [
      "cyclic exposed wrappers",
      "var trigger = function() { use(true); wrapper(); }; var wrapper = function() { trigger(); }; external(wrapper); use = function() {};",
      1,
    ],
    [
      "disabled nested call",
      "var trigger = function() { use(false); }; var wrapper = function() { trigger(); }; external(wrapper); use = function() {};",
      0,
    ],
    [
      "dominating isolated write",
      "var trigger = function() { use(true); }; var wrapper = function() { use = function() {}; trigger(); }; external(wrapper); use = function() {};",
      0,
    ],
    [
      "real call before replacement",
      "var trigger = function() { use(true); }; var wrapper = function() { trigger(); }; wrapper(); use = function() {};",
      1,
    ],
    [
      "real call after replacement",
      "var trigger = function() { use(true); }; var wrapper = function() { trigger(); }; use = function() {}; wrapper();",
      0,
    ],
  ] as const) {
    it(`preserves temporal callable captures for ${name}`, () => {
      findings(`${unsafeHelper} ${body}`, expected, "no-unfiltered-gliderecord-bulk-operation");
    });
  }

  it("retains an intermediate transitive target visible at wrapper exposure", () => {
    findings(
      'var use = function() {}; var trigger = function() { use(true); }; var wrapper = function() { trigger(); }; use = function(flag) { var records = new GlideRecord("task"); flag &&= records.deleteMultiple(); }; use(false); external(wrapper); use = function() {};',
      1,
      "no-unfiltered-gliderecord-bulk-operation",
    );
  });

  for (const [name, code] of [
    ["direct invocation", `var use; use = ${selectedCursor}; var disabled = false; use(disabled);`],
    [
      "alias invocation",
      `var use; use = ${selectedCursor}; var alias = use; var disabled = false; alias(disabled);`,
    ],
    [
      "real call after an early unknown call",
      `var use; use(); use = ${selectedCursor}; var disabled = false; use(disabled);`,
    ],
    [
      "hoisted declaration",
      'var disabled = false; use(disabled); function use(flag) { var gr = new GlideRecord("task"); flag &&= gr.next(); }',
    ],
    [
      "later nested invocation",
      `var use; function trigger() { use(false); } use = ${selectedCursor}; trigger();`,
    ],
    [
      "uncalled caller declared first",
      `var trigger = function() { use(false); }; var use = ${selectedCursor};`,
    ],
    [
      "uncalled callee declared first",
      `var use = ${selectedCursor}; var trigger = function() { use(false); };`,
    ],
  ] as const) {
    it(`uses actual arguments for a ${name}`, () => findings(code, 0));
  }

  it("keeps a reachable local cursor call", () => {
    findings(`var use; use = ${selectedCursor}; use(true);`, 1);
  });

  it("terminates cyclic caller inspection without inventing a selected cursor effect", () => {
    findings(
      'var first = function() { second(false); }; var second = function(flag) { var gr = new GlideRecord("task"); flag &&= gr.next(); first(); }; void first; void second;',
      0,
    );
  });

  it("replays a shared callee through both uncalled caller branches", () => {
    findings(
      `var use = ${selectedCursor}; var left = function(flag) { use(flag); }; var right = function(flag) { use(flag); }; var trigger = function() { left(false); right(false); }; void trigger;`,
      0,
    );
  });

  it("keeps repeated calls inside a pending caller within the default budget", () => {
    findings(uncalledCaller(500), 1);
  });

  it("scales pending caller inspection subquadratically", () => {
    const small = uncalledCaller(125);
    const large = uncalledCaller(500);
    assertSubQuadratic({
      label: "pending assigned helper calls",
      smallLabel: "125 calls",
      largeLabel: "500 calls",
      small: () => findings(small, 1),
      large: () => findings(large, 1),
    });
  });
});
