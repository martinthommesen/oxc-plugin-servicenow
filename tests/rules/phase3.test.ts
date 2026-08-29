import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const SERVER = { filename: "incident.br.js" };
const FULL = {
  filename: "incident.br.js",
  settings: { businessRuleSourceFormat: "full-script" as const },
};

describe("no-glideelement-in-collection", () => {
  const RULE = "no-glideelement-in-collection" as const;

  it("flags direct field push and unshift", () => {
    assertInvalid(
      `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident.number);
}`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
    assertInvalid(
      `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.unshift(incident.number);
}`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
  });

  it("flags getElement retention", () => {
    assertInvalid(
      `var fields = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  fields.push(incident.getElement("number"));
}`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
  });

  it("allows getValue, getDisplayValue, toString, and String", () => {
    assertValid(
      `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident.getValue("number"));
  numbers.push(incident.getDisplayValue("number"));
  numbers.push(incident.number.toString());
  numbers.push(String(incident.number));
}`,
      RULE,
      SERVER,
    );
  });

  it("allows direct use outside a next loop", () => {
    assertValid(
      `var incident = new GlideRecord("incident");
incident.get(id);
var numbers = [];
numbers.push(incident.number);`,
      RULE,
      SERVER,
    );
  });

  it("keeps two records independent", () => {
    assertValid(
      `var incident = new GlideRecord("incident");
var other = { number: "x" };
incident.query();
while (incident.next()) {
  var bag = [];
  bag.push(other.number);
}`,
      RULE,
      SERVER,
    );
  });

  it("tracks aliases", () => {
    assertInvalid(
      `var numbers = [];
var incident = new GlideRecord("incident");
var rec = incident;
rec.query();
while (rec.next()) {
  numbers.push(rec.number);
}`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
  });

  it("tracks the documented _next cursor alias", () => {
    assertInvalid(
      `var numbers = [];
var incident = new GlideRecord("incident");
incident._query();
while (incident["_next"]()) {
  numbers.push(incident.number);
}`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
  });

  it("does not mistake documented method properties for GlideElement fields", () => {
    assertValid(
      `var methods = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  methods.push(incident._query);
  methods.push(incident.queryNoDomain);
}`,
      RULE,
      { ...SERVER, settings: { scope: "unknown", release: "zurich" } },
    );
    assertValid(
      `var methods = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  methods.push(incident.getTableName);
  methods.push(incident.isValidField);
  methods.push(incident.getEncodedQuery);
  methods.push(incident.isNewRecord);
  methods.push(incident.canRead);
}`,
      RULE,
      { ...SERVER, settings: { scope: "scoped", release: "australia" } },
    );
  });

  it("requires cursor success for && in either operand but not fallback ||/?? paths", () => {
    const andLeft = `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next() && ready) numbers.push(incident.number);`;
    const andRight = `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (ready && incident.next()) numbers.push(incident.number);`;
    assertInvalid(andLeft, RULE, { messageId: "retained" }, SERVER);
    assertInvalid(andRight, RULE, { messageId: "retained" }, SERVER);
    const fallback = `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next() || ready) numbers.push(incident.number);`;
    const nullish = `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (ready ?? incident.next()) numbers.push(incident.number);`;
    assertValid(fallback, RULE, SERVER);
    assertValid(nullish, RULE, SERVER);
  });

  it("tracks every cursor required by a truthy conjunction", () => {
    assertInvalid(
      `var values = [];
var a = new GlideRecord("incident");
var b = new GlideRecord("task");
a.query();
b.query();
while (a.next() && b.next()) values.push(a.number);`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
  });

  it("checks the first cursor iteration even when the body exits", () => {
    assertInvalid(
      `var values = [];
var gr = new GlideRecord("incident");
gr.query();
while (gr.next()) {
  values.push(gr.number);
  break;
}`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
    assertInvalid(
      `function firstValue() {
  var values = [];
  var gr = new GlideRecord("incident");
  gr.query();
  while (gr.next()) {
    values.push(gr.number);
    return values;
  }
}`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
  });

  it("does not invent a second do-while iteration after an unconditional exit", () => {
    assertValid(
      `var values = [];
var gr = new GlideRecord("incident");
gr.query();
do {
  values.push(gr.number);
  break;
} while (gr.next());`,
      RULE,
      SERVER,
    );
  });

  it("finds retained fields inside nested literals", () => {
    assertInvalid(
      `var values = [];
var gr = new GlideRecord("incident");
gr.query();
while (gr.next()) values.push({ fields: [gr.number] });`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
  });

  it("does not trust a shadowed String extractor", () => {
    assertInvalid(
      `function String(value) { return value; }
var values = [];
var gr = new GlideRecord("incident");
gr.query();
while (gr.next()) values.push(String(gr.number));`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
    assertInvalid(
      `var Formatter = class String {
  run() {
    var values = [];
    var gr = new GlideRecord("incident");
    gr.query();
    while (gr.next()) values.push(String(gr.number));
  }
};`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
  });

  it("skips client files", () => {
    assertValid(
      `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) { numbers.push(incident.number); }`,
      RULE,
      { filename: "form.client.js" },
    );
  });

  it("flags a static computed field and ignores an unknown computed field", () => {
    assertInvalid(
      `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident["number"]);
}`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
    assertValid(
      `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident[field]);
}`,
      RULE,
      SERVER,
    );
  });

  it("tracks nested cursor loops and a collection declared inside the loop", () => {
    assertInvalid(
      `var outer = new GlideRecord("incident");
outer.query();
while (outer.next()) {
  var inner = new GlideRecord("task");
  inner.addQuery("parent", outer.getUniqueValue());
  inner.query();
  while (inner.next()) {
    var bag = [];
    bag.push(inner.number);
  }
}`,
      RULE,
      { messageId: "retained" },
      SERVER,
    );
  });

  it("ignores a reassigned binding", () => {
    assertValid(
      `var numbers = [];
var incident = new GlideRecord("incident");
incident = { number: "x", next: function () { return false; } };
while (incident.next()) {
  numbers.push(incident.number);
}`,
      RULE,
      SERVER,
    );
  });
});

describe("no-gliderecord-query-modifier-after-query", () => {
  const RULE = "no-gliderecord-query-modifier-after-query" as const;

  it("allows a modifier before query", () => {
    assertValid(
      `var incident = new GlideRecord("incident");
incident.addQuery("active", true);
incident.query();
while (incident.next()) { gs.info(incident.number); }`,
      RULE,
      SERVER,
    );
  });

  it("flags a modifier after query then next", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
while (incident.next()) { gs.info(incident.number); }`,
      RULE,
      { messageId: "lateModifier" },
      SERVER,
    );
  });

  it("allows a second query after the modifier", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
gr.query();
consumeFirstResult(gr);
gr.addQuery("active", true);
gr.query();
consumeSecondResult(gr);`,
      RULE,
      SERVER,
    );
  });

  it("reports when a conditional re-query leaves one stale-result path", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
if (ready) {
  incident.query();
}
incident.next();`,
      RULE,
      { messageId: "lateModifier" },
      SERVER,
    );
  });

  it("stays silent after escape", () => {
    assertValid(
      `var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
prepare(incident);
incident.next();`,
      RULE,
      SERVER,
    );
  });

  it("flags the pattern after get", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.get(id);
incident.addQuery("active", true);
incident.next();`,
      RULE,
      { messageId: "lateModifier" },
      SERVER,
    );
  });

  it("tracks _query and _next as documented lifecycle aliases", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident._query();
incident.addQuery("active", true);
incident._next();`,
      RULE,
      { messageId: "lateModifier" },
      { ...SERVER, settings: { scope: "scoped", release: "zurich" } },
    );
    assertValid(
      `var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
incident["_query"]();
incident._next();`,
      RULE,
      { ...SERVER, settings: { scope: "scoped", release: "zurich" } },
    );
  });

  it("uses queryNoDomain only when its global availability is definite", () => {
    const stale = `var incident = new GlideRecord("incident");
incident.queryNoDomain();
incident.addQuery("active", true);
incident.next();`;
    assertInvalid(
      stale,
      RULE,
      { messageId: "lateModifier" },
      { ...SERVER, settings: { scope: "global", release: "zurich" } },
    );
    assertValid(stale, RULE, {
      ...SERVER,
      settings: { scope: "unknown", release: "zurich" },
    });
    assertValid(
      `var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
incident.queryNoDomain();
incident.next();`,
      RULE,
      { ...SERVER, settings: { scope: "unknown", release: "zurich" } },
    );
  });

  it("stays silent when a computed call may refresh the cursor", () => {
    assertValid(
      `var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
var method = "_query";
incident[method]();
incident.next();`,
      RULE,
      SERVER,
    );
    // Member-object evaluation captures `first` before the computed key
    // reassigns it, so the call can refresh the original cursor.
    assertValid(
      `var first = new GlideRecord("incident");
first.query();
first.addQuery("active", true);
var original = first;
var second = new GlideRecord("problem");
var method = "_query";
first[(first = second, method)]();
original.next();`,
      RULE,
      SERVER,
    );
  });

  it("tracks aliases and keeps two records independent", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
var rec = incident;
rec.query();
rec.addQuery("active", true);
rec.next();`,
      RULE,
      { messageId: "lateModifier" },
      SERVER,
    );
    assertValid(
      `var incident = new GlideRecord("incident");
var other = new GlideRecord("task");
incident.query();
other.addQuery("active", true);
incident.next();`,
      RULE,
      SERVER,
    );
  });

  it("flags a static computed modifier", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
incident["addQuery"]("active", true);
incident.next();`,
      RULE,
      { messageId: "lateModifier" },
      SERVER,
    );
  });
});

describe("require-business-rule-wrapper", () => {
  const RULE = "require-business-rule-wrapper" as const;

  it("allows the conventional wrapper", () => {
    assertValid(
      `(function executeRule(current, previous) {
  current.priority = 3;
})(current, previous);`,
      RULE,
      FULL,
    );
  });

  it("flags an unwrapped script", () => {
    assertInvalid(
      `var targetGroup = gs.getProperty("x_acme.target_group");
if (current.assignment_group.nil()) {
  current.assignment_group = targetGroup;
}`,
      RULE,
      { messageId: "missingWrapper" },
      FULL,
    );
  });

  it("stays silent in body-only mode", () => {
    assertValid(`current.priority = 3;`, RULE, {
      filename: "incident.br.js",
      settings: { businessRuleSourceFormat: "body-only" },
    });
  });

  it("stays silent when format is unknown", () => {
    assertValid(`current.priority = 3;`, RULE, SERVER);
  });

  it("allows comments before the wrapper", () => {
    assertValid(
      `// set default priority
(function executeRule(current, previous) {
  current.priority = 3;
})(current, previous);`,
      RULE,
      FULL,
    );
  });

  it("allows a named function expression IIFE", () => {
    assertValid(
      `(function executeRule(current, previous) {
  current.priority = 3;
})(current, previous);`,
      RULE,
      FULL,
    );
  });

  it("allows an arrow IIFE with current and previous", () => {
    assertValid(
      `((current, previous) => {
  current.priority = 3;
})(current, previous);`,
      RULE,
      FULL,
    );
  });

  it("skips UI Actions and Script Includes", () => {
    assertValid(`var x = 1;`, RULE, {
      filename: "close.ui-action.js",
      settings: { businessRuleSourceFormat: "full-script" },
    });
    assertValid(`var x = 1;`, RULE, {
      filename: "helper.si.js",
      settings: { businessRuleSourceFormat: "full-script" },
    });
  });

  it("flags top-level declarations outside the wrapper", () => {
    assertInvalid(
      `var leaked = 1;
(function executeRule(current, previous) {
  current.priority = 3;
})(current, previous);`,
      RULE,
      { messageId: "missingWrapper" },
      FULL,
    );
  });

  it("flags a wrapper that does not use current and previous", () => {
    assertInvalid(
      `(function executeRule(a, b) {
  a.priority = 3;
})(current, previous);`,
      RULE,
      { messageId: "missingWrapper" },
      FULL,
    );
  });

  it("allows nested functions inside the wrapper", () => {
    assertValid(
      `(function executeRule(current, previous) {
  function helper() { current.priority = 3; }
  helper();
})(current, previous);`,
      RULE,
      FULL,
    );
  });

  it("does not infer full-script from a Business Rule filename", () => {
    assertValid(`var leaked = 1;`, RULE, { filename: "incident.br.js" });
  });
});

describe("no-display-value-date-comparison", () => {
  const RULE = "no-display-value-date-comparison" as const;

  it("flags relational operators and subtraction", () => {
    assertInvalid(
      `var start = new GlideDateTime(current.start_date);
var end = new GlideDateTime(current.end_date);
if (start.getDisplayValue() > end.getDisplayValue()) { gs.info("x"); }`,
      RULE,
      { messageId: "displayCompare" },
      SERVER,
    );
    assertInvalid(
      `var start = new GlideDateTime();
var n = start.getDisplayValue() - 0;`,
      RULE,
      { messageId: "displayCompare" },
      SERVER,
    );
  });

  it("allows equality, logging, and numeric comparison", () => {
    assertValid(
      `var start = new GlideDateTime();
if (start.getDisplayValue() === expected) { gs.info(start.getDisplayValue()); }
if (start.getNumericValue() > 0) { gs.info("ok"); }`,
      RULE,
      SERVER,
    );
  });

  it("ignores a shadowed GlideDateTime and custom objects", () => {
    assertValid(
      `function GlideDateTime() { this.getDisplayValue = function () { return "a"; }; }
var start = new GlideDateTime();
if (start.getDisplayValue() > "b") { gs.info("x"); }`,
      RULE,
      SERVER,
    );
    assertValid(
      `var start = { getDisplayValue: function () { return "a"; } };
if (start.getDisplayValue() > "b") { gs.info("x"); }`,
      RULE,
      SERVER,
    );
  });

  it("does not follow intermediate variables", () => {
    assertValid(
      `var start = new GlideDateTime();
var text = start.getDisplayValue();
if (text > other) { gs.info("x"); }`,
      RULE,
      SERVER,
    );
  });

  it("flags every relational operator", () => {
    for (const op of ["<", ">", "<=", ">="]) {
      assertInvalid(
        `var start = new GlideDateTime();
if (start.getDisplayValue() ${op} "2026-01-01") { gs.info("x"); }`,
        RULE,
        { messageId: "displayCompare" },
        SERVER,
      );
    }
  });

  it("tracks aliases and ignores a reassigned binding", () => {
    assertInvalid(
      `var start = new GlideDateTime();
var clock = start;
if (clock.getDisplayValue() > "x") { gs.info("x"); }`,
      RULE,
      { messageId: "displayCompare" },
      SERVER,
    );
    assertValid(
      `var start = new GlideDateTime();
start = { getDisplayValue: function () { return "a"; } };
if (start.getDisplayValue() > "x") { gs.info("x"); }`,
      RULE,
      SERVER,
    );
  });

  it("skips Fluent metadata files", () => {
    assertValid(
      `var start = new GlideDateTime();
if (start.getDisplayValue() > "x") { gs.info("x"); }`,
      RULE,
      { filename: "table.now.ts" },
    );
  });
});

describe("no-unfiltered-gliderecord-bulk-operation", () => {
  const RULE = "no-unfiltered-gliderecord-bulk-operation" as const;

  it("flags no filters", () => {
    assertInvalid(
      `var staging = new GlideRecord("x_acme_staging");
staging.deleteMultiple();`,
      RULE,
      { messageId: "unfiltered" },
      SERVER,
    );
    assertInvalid(
      `var task = new GlideRecord("task");
task.setValue("u_migrated", true);
task.updateMultiple();`,
      RULE,
      { messageId: "unfiltered" },
      SERVER,
    );
  });

  it("allows recognized filters", () => {
    assertValid(
      `var task = new GlideRecord("task");
task.addQuery("active", false);
task.updateMultiple();`,
      RULE,
      SERVER,
    );
    assertValid(
      `var task = new GlideRecord("task");
task.addEncodedQuery("active=false");
task.deleteMultiple();`,
      RULE,
      SERVER,
    );
    assertValid(
      `var task = new GlideRecord("task");
task.addActiveQuery();
task.deleteMultiple();`,
      RULE,
      SERVER,
    );
  });

  it("does not treat order, query, limit, or window as a filter", () => {
    assertInvalid(
      `var task = new GlideRecord("task");
task.orderBy("sys_created_on");
task.setLimit(10);
task.query();
task.deleteMultiple();`,
      RULE,
      { messageId: "unfiltered" },
      SERVER,
    );
  });

  it("stays silent after escape or a one-branch filter", () => {
    assertValid(
      `var task = new GlideRecord("task");
prepare(task);
task.deleteMultiple();`,
      RULE,
      SERVER,
    );
    assertInvalid(
      `var task = new GlideRecord("task");
if (ready) task.addQuery("active", false);
task.deleteMultiple();`,
      RULE,
      { messageId: "unfiltered" },
      SERVER,
    );
  });

  it("does not flag deleteRecord", () => {
    assertValid(
      `var task = new GlideRecord("task");
task.get(id);
task.deleteRecord();`,
      RULE,
      SERVER,
    );
  });

  it("allows every documented filter type", () => {
    for (const call of [
      `task.addQuery("active", false)`,
      `task.addEncodedQuery("active=false")`,
      `task.addActiveQuery()`,
      `task.addNullQuery("short_description")`,
      `task.addNotNullQuery("short_description")`,
      `task.addJoinQuery("incident")`,
      `task.addUserQuery("active", true)`,
      `task.addUserEncodedQuery("active=true")`,
      `task.addSystemQuery("active", true)`,
      `task.addSystemEncodedQuery("active=true")`,
    ]) {
      assertValid(
        `var task = new GlideRecord("task");
${call};
task.deleteMultiple();`,
        RULE,
        SERVER,
      );
    }
  });

  it("keeps unmodeled Australia methods conservative before a bulk operation", () => {
    assertValid(
      `var task = new GlideRecord("task");
task.addInactiveQuery();
task.deleteMultiple();`,
      RULE,
      { ...SERVER, settings: { scope: "global", release: "australia" } },
    );
    assertValid(
      `var task = new GlideRecord("task");
task.getTableName();
task.deleteMultiple();`,
      RULE,
      { ...SERVER, settings: { scope: "scoped", release: "australia" } },
    );
  });

  it("tracks aliases and ignores a shadowed constructor", () => {
    assertInvalid(
      `var task = new GlideRecord("task");
var rec = task;
rec.deleteMultiple();`,
      RULE,
      { messageId: "unfiltered" },
      SERVER,
    );
    assertValid(
      `function GlideRecord() {}
var task = new GlideRecord("task");
task.deleteMultiple();`,
      RULE,
      SERVER,
    );
  });
});

describe("no-gliderecord-query-in-loop", () => {
  const RULE = "no-gliderecord-query-in-loop" as const;

  it("flags a nested cursor query", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.get(incident.getValue("caller_id"));
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });

  it("keeps cursor depth through an immediately invoked function", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  (function () {
    var caller = new GlideRecord("sys_user");
    caller.get(incident.getValue("caller_id"));
  })();
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });

  it("keeps cursor depth through an immediately invoked arrow", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  (() => {
    var caller = new GlideRecord("sys_user");
    caller.get("abc");
  })();
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });

  it("keeps cursor depth through one stable local helper call site", () => {
    assertInvalid(
      `function lookupCaller(id) {
  var caller = new GlideRecord("sys_user");
  caller.get(id);
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  lookupCaller(incident.getValue("caller_id"));
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
    assertInvalid(
      `const lookup = () => {
  const caller = new GlideRecord("sys_user");
  caller.query();
};
const run = lookup;
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) run();`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
    assertInvalid(
      `function evalShadow() {}
function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
evalShadow("");
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) lookupCaller();`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });

  it("propagates cursor depth through a stable local helper chain", () => {
    assertInvalid(
      `function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
function loadReference() { lookupCaller(); }
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) loadReference();`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });

  it("recognizes a boolean cursor test", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next() === true) {
  var caller = new GlideRecord("sys_user");
  caller.get("abc");
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });

  it("allows a query outside the loop and a fixed array loop", () => {
    assertValid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) { gs.info(incident.number); }`,
      RULE,
      SERVER,
    );
    assertValid(
      `for (var i = 0; i < ids.length; i++) {
  var rec = new GlideRecord("incident");
  rec.get(ids[i]);
}`,
      RULE,
      SERVER,
    );
  });

  it("stays silent for unresolved, mutable, multiply called, or deferred helpers", () => {
    assertValid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  lookupCaller(incident.getValue("caller_id"));
}`,
      RULE,
      SERVER,
    );
    assertValid(
      `function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
lookupCaller = replacement;
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) lookupCaller();`,
      RULE,
      SERVER,
    );
    assertValid(
      `const lookupCaller = () => {
  var caller = new GlideRecord("sys_user");
  caller.query();
};
eval("lookupCaller = replacement");
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) lookupCaller();`,
      RULE,
      SERVER,
    );
    assertValid(
      `function runQuery(record) { record.query(); }
var caller = new GlideRecord("sys_user");
runQuery(caller);
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) runQuery(customRecord);`,
      RULE,
      SERVER,
    );
    assertValid(
      `function* lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) lookupCaller();`,
      RULE,
      SERVER,
    );
    assertValid(
      `function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  const lookupCaller = () => {};
  lookupCaller();
}`,
      RULE,
      SERVER,
    );
    assertValid(
      `function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
eval("lookupCaller = replacement");
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) lookupCaller();`,
      RULE,
      SERVER,
    );
    assertValid(
      `function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  scheduleLater(lookupCaller);
  lookupCaller.call(null);
}`,
      RULE,
      SERVER,
    );
  });

  it("skips client files", () => {
    assertValid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.get("abc");
}`,
      RULE,
      { filename: "form.client.js" },
    );
  });

  it("flags GlideRecord query/get and GlideAggregate query inside the cursor loop", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var extra = new GlideRecord("task");
  extra.query();
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var agg = new GlideAggregate("task");
  agg.addAggregate("COUNT");
  agg.query();
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });

  it("flags a get on a record constructed outside the loop", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
var caller = new GlideRecord("sys_user");
incident.query();
while (incident.next()) {
  caller.get(incident.getValue("caller_id"));
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });

  it("tracks aliases", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  var rec = caller;
  rec.get(incident.getValue("caller_id"));
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });

  it("tracks cursor advancement in a for update on later iterations", () => {
    assertInvalid(
      `var cursor = new GlideRecord("incident");
var inner = new GlideRecord("task");
cursor.query();
for (; keepGoing; cursor.next()) {
  inner.query();
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });
});

describe("cursor condition implications", () => {
  const RULE = "no-gliderecord-query-in-loop" as const;
  const nested = (test: string) => `var incident = new GlideRecord("incident");
incident.query();
while (${test}) {
  var extra = new GlideRecord("task");
  extra.query();
}`;
  it("requires next success on && paths and rejects fallback-only ||/?? entry", () => {
    assertInvalid(nested("incident.next() && ready"), RULE, { messageId: "nestedQuery" }, SERVER);
    assertInvalid(nested("ready && incident.next()"), RULE, { messageId: "nestedQuery" }, SERVER);
    assertValid(nested("incident.next() || ready"), RULE, SERVER);
    assertValid(nested("ready ?? incident.next()"), RULE, SERVER);
  });
});

describe("no-system-query-bypass", () => {
  const RULE = "no-system-query-bypass" as const;

  it("flags documented bypass methods", () => {
    for (const method of [
      "addSystemQuery",
      "addSystemEncodedQuery",
      "addSystemOrderBy",
      "addSystemOrderByDesc",
    ]) {
      assertInvalid(
        `var user = new GlideRecord("sys_user");
user.${method}("active", true);
user.query();`,
        RULE,
        { messageId: "bypass" },
        SERVER,
      );
    }
  });

  it("allows normal query methods", () => {
    assertValid(
      `var user = new GlideRecord("sys_user");
user.addQuery("active", true);
user.query();`,
      RULE,
      SERVER,
    );
  });

  it("ignores unrelated objects and shadowed constructors", () => {
    assertValid(
      `var user = { addSystemQuery: function () {} };
user.addSystemQuery("active", true);`,
      RULE,
      SERVER,
    );
    assertValid(
      `function GlideRecord() { this.addSystemQuery = function () {}; }
var user = new GlideRecord("sys_user");
user.addSystemQuery("active", true);`,
      RULE,
      SERVER,
    );
  });

  it("does not match an undocumented addSystem name", () => {
    assertValid(
      `var user = new GlideRecord("sys_user");
user.addSystemFoo("active", true);
user.query();`,
      RULE,
      SERVER,
    );
  });

  it("tracks aliases and static computed members", () => {
    assertInvalid(
      `var user = new GlideRecord("sys_user");
var rec = user;
rec["addSystemQuery"]("active", true);`,
      RULE,
      { messageId: "bypass" },
      SERVER,
    );
  });

  it("flags folded, dynamic, extracted, and escaped bypass access", () => {
    assertInvalid(
      `var user = new GlideRecord("sys_user");
user["addSystem" + "Query"]("active=true");`,
      RULE,
      { messageId: "bypass" },
      SERVER,
    );
    assertInvalid(
      `var user = new GlideRecord("sys_user");
user[method]("active=true");`,
      RULE,
      { messageId: "possibleBypass" },
      SERVER,
    );
    assertInvalid(
      `var user = new GlideRecord("sys_user");
var bypass = user.addSystemQuery;
bypass.call(user, "active=true");`,
      RULE,
      { messageId: "bypass" },
      SERVER,
    );
    assertInvalid(
      `var user = new GlideRecord("sys_user");
prepare(user);
user.addSystemQuery("active=true");`,
      RULE,
      { messageId: "bypass" },
      SERVER,
    );
  });

  it("skips client files", () => {
    assertValid(
      `var user = new GlideRecord("sys_user");
user.addSystemQuery("active", true);`,
      RULE,
      { filename: "form.client.js" },
    );
  });
});
