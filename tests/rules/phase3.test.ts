import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import { BUSINESS_RULE, FULL_SCRIPT } from "../helpers/rule-tester.js";

describe("no-glideelement-in-collection", () => {
  const { expectInvalid, expectValid, expectSkipped, expectActive } = ruleTester(
    "no-glideelement-in-collection",
    BUSINESS_RULE,
    { messageId: "retained" },
  );

  it("flags direct field push and unshift", () => {
    expectInvalid(`var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident.number);
}`);
    expectInvalid(`var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.unshift(incident.number);
}`);
  });

  it("flags getElement retention", () =>
    void expectInvalid(`var fields = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  fields.push(incident.getElement("number"));
}`));

  it("allows getValue, getDisplayValue, toString, and String", () =>
    void expectValid(`var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident.getValue("number"));
  numbers.push(incident.getDisplayValue("number"));
  numbers.push(incident.number.toString());
  numbers.push(String(incident.number));
}`));

  it("allows direct use outside a next loop", () =>
    void expectValid(`var incident = new GlideRecord("incident");
incident.get(id);
var numbers = [];
numbers.push(incident.number);`));

  it("keeps two records independent", () =>
    void expectValid(`var incident = new GlideRecord("incident");
var other = { number: "x" };
incident.query();
while (incident.next()) {
  var bag = [];
  bag.push(other.number);
}`));

  it("tracks aliases", () =>
    void expectInvalid(`var numbers = [];
var incident = new GlideRecord("incident");
var rec = incident;
rec.query();
while (rec.next()) {
  numbers.push(rec.number);
}`));

  it("tracks the documented _next cursor alias", () =>
    void expectInvalid(`var numbers = [];
var incident = new GlideRecord("incident");
incident._query();
while (incident["_next"]()) {
  numbers.push(incident.number);
}`));

  it("does not mistake documented method properties for GlideElement fields", () => {
    expectValid(
      `var methods = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  methods.push(incident._query);
  methods.push(incident.queryNoDomain);
}`,
      { ...BUSINESS_RULE, settings: { scope: "unknown", release: "zurich" } },
    );
    expectValid(
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
      { ...BUSINESS_RULE, settings: { scope: "scoped", release: "australia" } },
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
    expectInvalid(andLeft);
    expectInvalid(andRight);
    const fallback = `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next() || ready) numbers.push(incident.number);`;
    const nullish = `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (ready ?? incident.next()) numbers.push(incident.number);`;
    expectValid(fallback);
    expectValid(nullish);
  });

  it("tracks every cursor required by a truthy conjunction", () =>
    void expectInvalid(`var values = [];
var a = new GlideRecord("incident");
var b = new GlideRecord("task");
a.query();
b.query();
while (a.next() && b.next()) values.push(a.number);`));

  it("checks the first cursor iteration even when the body exits", () => {
    expectInvalid(`var values = [];
var gr = new GlideRecord("incident");
gr.query();
while (gr.next()) {
  values.push(gr.number);
  break;
}`);
    expectInvalid(`function firstValue() {
  var values = [];
  var gr = new GlideRecord("incident");
  gr.query();
  while (gr.next()) {
    values.push(gr.number);
    return values;
  }
}`);
  });

  it("does not invent a second do-while iteration after an unconditional exit", () =>
    void expectValid(`var values = [];
var gr = new GlideRecord("incident");
gr.query();
do {
  values.push(gr.number);
  break;
} while (gr.next());`));

  it("finds retained fields inside nested literals", () =>
    void expectInvalid(`var values = [];
var gr = new GlideRecord("incident");
gr.query();
while (gr.next()) values.push({ fields: [gr.number] });`));

  it("does not trust a shadowed String extractor", () => {
    expectInvalid(`function String(value) { return value; }
var values = [];
var gr = new GlideRecord("incident");
gr.query();
while (gr.next()) values.push(String(gr.number));`);
    expectInvalid(`var Formatter = class String {
  run() {
    var values = [];
    var gr = new GlideRecord("incident");
    gr.query();
    while (gr.next()) values.push(String(gr.number));
  }
};`);
  });

  it("skips client files", () =>
    void expectSkipped(
      `var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) { numbers.push(incident.number); }`,
      { filename: "form.client.js" },
    ));

  it("flags a static computed field and ignores an unknown computed field", () => {
    expectInvalid(`var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident["number"]);
}`);
    expectValid(`var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident[field]);
}`);
  });

  it("tracks nested cursor loops and a collection declared inside the loop", () =>
    void expectInvalid(`var outer = new GlideRecord("incident");
outer.query();
while (outer.next()) {
  var inner = new GlideRecord("task");
  inner.addQuery("parent", outer.getUniqueValue());
  inner.query();
  while (inner.next()) {
    var bag = [];
    bag.push(inner.number);
  }
}`));

  it("ignores a reassigned binding", () =>
    void expectActive(`var numbers = [];
var incident = new GlideRecord("incident");
incident = { number: "x", next: function () { return false; } };
while (incident.next()) {
  numbers.push(incident.number);
}`));
});

describe("no-gliderecord-query-modifier-after-query", () => {
  const { expectValid, expectInvalid, expectActive } = ruleTester(
    "no-gliderecord-query-modifier-after-query",
    BUSINESS_RULE,
    { messageId: "lateModifier" },
  );

  it("allows a modifier before query", () =>
    void expectValid(`var incident = new GlideRecord("incident");
incident.addQuery("active", true);
incident.query();
while (incident.next()) { gs.info(incident.number); }`));

  it("flags a modifier after query then next", () =>
    void expectInvalid(`var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
while (incident.next()) { gs.info(incident.number); }`));

  it("allows a second query after the modifier", () =>
    void expectValid(`var gr = new GlideRecord("incident");
gr.query();
consumeFirstResult(gr);
gr.addQuery("active", true);
gr.query();
consumeSecondResult(gr);`));

  it("reports when a conditional re-query leaves one stale-result path", () =>
    void expectInvalid(`var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
if (ready) {
  incident.query();
}
incident.next();`));

  it("stays silent after escape", () =>
    void expectActive(`var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
prepare(incident);
incident.next();`));

  it("flags the pattern after get", () =>
    void expectInvalid(`var incident = new GlideRecord("incident");
incident.get(id);
incident.addQuery("active", true);
incident.next();`));

  it("tracks _query and _next as documented lifecycle aliases", () => {
    expectInvalid(
      `var incident = new GlideRecord("incident");
incident._query();
incident.addQuery("active", true);
incident._next();`,
      undefined,
      { ...BUSINESS_RULE, settings: { scope: "scoped", release: "zurich" } },
    );
    expectValid(
      `var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
incident["_query"]();
incident._next();`,
      { ...BUSINESS_RULE, settings: { scope: "scoped", release: "zurich" } },
    );
  });

  it("uses queryNoDomain only when its global availability is definite", () => {
    const stale = `var incident = new GlideRecord("incident");
incident.queryNoDomain();
incident.addQuery("active", true);
incident.next();`;
    expectInvalid(stale, undefined, {
      ...BUSINESS_RULE,
      settings: { scope: "global", release: "zurich" },
    });
    expectValid(stale, {
      ...BUSINESS_RULE,
      settings: { scope: "unknown", release: "zurich" },
    });
    expectValid(
      `var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
incident.queryNoDomain();
incident.next();`,
      { ...BUSINESS_RULE, settings: { scope: "unknown", release: "zurich" } },
    );
  });

  it("stays silent when a computed call may refresh the cursor", () => {
    expectActive(`var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
var method = "_query";
incident[method]();
incident.next();`);
    // Member-object evaluation captures `first` before the computed key
    // reassigns it, so the call can refresh the original cursor.
    expectActive(`var first = new GlideRecord("incident");
first.query();
first.addQuery("active", true);
var original = first;
var second = new GlideRecord("problem");
var method = "_query";
first[(first = second, method)]();
original.next();`);
  });

  it("tracks aliases and keeps two records independent", () => {
    expectInvalid(`var incident = new GlideRecord("incident");
var rec = incident;
rec.query();
rec.addQuery("active", true);
rec.next();`);
    expectValid(`var incident = new GlideRecord("incident");
var other = new GlideRecord("task");
incident.query();
other.addQuery("active", true);
incident.next();`);
  });

  it("flags a static computed modifier", () =>
    void expectInvalid(`var incident = new GlideRecord("incident");
incident.query();
incident["addQuery"]("active", true);
incident.next();`));
});

describe("require-business-rule-wrapper", () => {
  const { expectValid, expectInvalid, expectSkipped } = ruleTester(
    "require-business-rule-wrapper",
    FULL_SCRIPT,
    { messageId: "missingWrapper" },
  );

  it("allows the conventional wrapper", () =>
    void expectValid(`(function executeRule(current, previous) {
  current.priority = 3;
})(current, previous);`));

  it("flags an unwrapped script", () =>
    void expectInvalid(`var targetGroup = gs.getProperty("x_acme.target_group");
if (current.assignment_group.nil()) {
  current.assignment_group = targetGroup;
}`));

  it("stays silent in body-only mode", () =>
    void expectSkipped(`current.priority = 3;`, {
      filename: "incident.br.js",
      settings: { businessRuleSourceFormat: "body-only" },
    }));

  it("stays silent when format is unknown", () =>
    void expectSkipped(`current.priority = 3;`, BUSINESS_RULE));

  it("allows comments before the wrapper", () => {
    expectValid(`// set default priority
(function executeRule(current, previous) {
  current.priority = 3;
})(current, previous);`);
  });

  it("allows an arrow IIFE with current and previous", () =>
    void expectValid(`((current, previous) => {
  current.priority = 3;
})(current, previous);`));

  it("skips UI Actions and Script Includes", () => {
    expectSkipped(`var x = 1;`, {
      filename: "close.ui-action.js",
      settings: { businessRuleSourceFormat: "full-script" },
    });
    expectSkipped(`var x = 1;`, {
      filename: "helper.si.js",
      settings: { businessRuleSourceFormat: "full-script" },
    });
  });

  it("flags top-level declarations outside the wrapper", () =>
    void expectInvalid(`var leaked = 1;
(function executeRule(current, previous) {
  current.priority = 3;
})(current, previous);`));

  it("flags a wrapper that does not use current and previous", () =>
    void expectInvalid(`(function executeRule(a, b) {
  a.priority = 3;
})(current, previous);`));

  it("allows nested functions inside the wrapper", () =>
    void expectValid(`(function executeRule(current, previous) {
  function helper() { current.priority = 3; }
  helper();
})(current, previous);`));

  it("does not infer full-script from a Business Rule filename", () =>
    void expectValid(`var leaked = 1;`, { filename: "incident.br.js" }));
});

describe("no-display-value-date-comparison", () => {
  const { expectInvalid, expectValid, expectActive, expectSkipped } = ruleTester(
    "no-display-value-date-comparison",
    BUSINESS_RULE,
    { messageId: "displayCompare" },
  );

  it("flags relational operators and subtraction", () => {
    expectInvalid(`var start = new GlideDateTime(current.start_date);
var end = new GlideDateTime(current.end_date);
if (start.getDisplayValue() > end.getDisplayValue()) { gs.info("x"); }`);
    expectInvalid(`var start = new GlideDateTime();
var n = start.getDisplayValue() - 0;`);
  });

  it("allows equality, logging, and numeric comparison", () =>
    void expectValid(`var start = new GlideDateTime();
if (start.getDisplayValue() === expected) { gs.info(start.getDisplayValue()); }
if (start.getNumericValue() > 0) { gs.info("ok"); }`));

  it("ignores a shadowed GlideDateTime and custom objects", () => {
    expectActive(`function GlideDateTime() { this.getDisplayValue = function () { return "a"; }; }
var start = new GlideDateTime();
if (start.getDisplayValue() > "b") { gs.info("x"); }`);
    expectActive(`var start = { getDisplayValue: function () { return "a"; } };
if (start.getDisplayValue() > "b") { gs.info("x"); }`);
  });

  it("does not follow intermediate variables", () =>
    void expectValid(`var start = new GlideDateTime();
var text = start.getDisplayValue();
if (text > other) { gs.info("x"); }`));

  it("skips client files (FINDINGS.md COR-015)", () =>
    void expectSkipped(
      `var start = new GlideDateTime();
if (start.getDisplayValue() > "b") { gs.info("x"); }`,
      { filename: "test.client.js" },
    ));

  it("flags every relational operator", () => {
    for (const op of ["<", ">", "<=", ">="]) {
      expectInvalid(`var start = new GlideDateTime();
if (start.getDisplayValue() ${op} "2026-01-01") { gs.info("x"); }`);
    }
  });

  it("tracks aliases and ignores a reassigned binding", () => {
    expectInvalid(`var start = new GlideDateTime();
var clock = start;
if (clock.getDisplayValue() > "x") { gs.info("x"); }`);
    expectValid(`var start = new GlideDateTime();
start = { getDisplayValue: function () { return "a"; } };
if (start.getDisplayValue() > "x") { gs.info("x"); }`);
  });

  it("skips Fluent metadata files", () =>
    void expectSkipped(
      `var start = new GlideDateTime();
if (start.getDisplayValue() > "x") { gs.info("x"); }`,
      { filename: "table.now.ts" },
    ));
});

describe("no-unfiltered-gliderecord-bulk-operation", () => {
  const { expectInvalid, expectValid, expectActive } = ruleTester(
    "no-unfiltered-gliderecord-bulk-operation",
    BUSINESS_RULE,
    { messageId: "unfiltered" },
  );

  it("flags no filters", () => {
    expectInvalid(`var staging = new GlideRecord("x_acme_staging");
staging.deleteMultiple();`);
    expectInvalid(`var task = new GlideRecord("task");
task.setValue("u_migrated", true);
task.updateMultiple();`);
  });

  it("allows recognized filters", () => {
    expectValid(`var task = new GlideRecord("task");
task.addQuery("active", false);
task.updateMultiple();`);
    expectValid(`var task = new GlideRecord("task");
task.addEncodedQuery("active=false");
task.deleteMultiple();`);
    expectValid(`var task = new GlideRecord("task");
task.addActiveQuery();
task.deleteMultiple();`);
  });

  it("does not treat order, query, limit, or window as a filter", () =>
    void expectInvalid(`var task = new GlideRecord("task");
task.orderBy("sys_created_on");
task.setLimit(10);
task.query();
task.deleteMultiple();`));

  it("stays silent after escape or a one-branch filter", () => {
    expectActive(`var task = new GlideRecord("task");
prepare(task);
task.deleteMultiple();`);
    expectInvalid(`var task = new GlideRecord("task");
if (ready) task.addQuery("active", false);
task.deleteMultiple();`);
  });

  it("does not flag deleteRecord", () =>
    void expectValid(`var task = new GlideRecord("task");
task.get(id);
task.deleteRecord();`));

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
      expectValid(`var task = new GlideRecord("task");
${call};
task.deleteMultiple();`);
    }
  });

  it("keeps unmodeled Australia methods conservative before a bulk operation", () => {
    expectValid(
      `var task = new GlideRecord("task");
task.addInactiveQuery();
task.deleteMultiple();`,
      { ...BUSINESS_RULE, settings: { scope: "global", release: "australia" } },
    );
    expectValid(
      `var task = new GlideRecord("task");
task.getTableName();
task.deleteMultiple();`,
      { ...BUSINESS_RULE, settings: { scope: "scoped", release: "australia" } },
    );
  });

  it("tracks aliases and ignores a shadowed constructor", () => {
    expectInvalid(`var task = new GlideRecord("task");
var rec = task;
rec.deleteMultiple();`);
    expectValid(`function GlideRecord() {}
var task = new GlideRecord("task");
task.deleteMultiple();`);
  });
});

describe("no-gliderecord-query-in-loop", () => {
  const { expectInvalid, expectValid, expectActive, expectSkipped } = ruleTester(
    "no-gliderecord-query-in-loop",
    BUSINESS_RULE,
    { messageId: "nestedQuery" },
  );

  it("flags a nested cursor query", () =>
    void expectInvalid(`var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.get(incident.getValue("caller_id"));
}`));

  it("keeps cursor depth through an immediately invoked function", () =>
    void expectInvalid(`var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  (function () {
    var caller = new GlideRecord("sys_user");
    caller.get(incident.getValue("caller_id"));
  })();
}`));

  it("keeps cursor depth through an immediately invoked arrow", () =>
    void expectInvalid(`var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  (() => {
    var caller = new GlideRecord("sys_user");
    caller.get("abc");
  })();
}`));

  it("keeps cursor depth through one stable local helper call site", () => {
    expectInvalid(`function lookupCaller(id) {
  var caller = new GlideRecord("sys_user");
  caller.get(id);
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  lookupCaller(incident.getValue("caller_id"));
}`);
    expectInvalid(`const lookup = () => {
  const caller = new GlideRecord("sys_user");
  caller.query();
};
const run = lookup;
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) run();`);
    expectInvalid(`function evalShadow() {}
function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
evalShadow("");
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) lookupCaller();`);
  });

  it("propagates cursor depth through a stable local helper chain", () =>
    void expectInvalid(`function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
function loadReference() { lookupCaller(); }
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) loadReference();`));

  it("recognizes a boolean cursor test", () =>
    void expectInvalid(`var incident = new GlideRecord("incident");
incident.query();
while (incident.next() === true) {
  var caller = new GlideRecord("sys_user");
  caller.get("abc");
}`));

  it("allows a query outside the loop and a fixed array loop", () => {
    expectValid(`var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) { gs.info(incident.number); }`);
    expectValid(`for (var i = 0; i < ids.length; i++) {
  var rec = new GlideRecord("incident");
  rec.get(ids[i]);
}`);
  });

  it("stays silent for unresolved, mutable, multiply called, or deferred helpers", () => {
    expectActive(`var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  lookupCaller(incident.getValue("caller_id"));
}`);
    expectActive(`function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
lookupCaller = replacement;
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) lookupCaller();`);
    expectActive(`const lookupCaller = () => {
  var caller = new GlideRecord("sys_user");
  caller.query();
};
eval("lookupCaller = replacement");
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) lookupCaller();`);
    expectActive(`function runQuery(record) { record.query(); }
var caller = new GlideRecord("sys_user");
runQuery(caller);
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) runQuery(customRecord);`);
    expectActive(`function* lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) lookupCaller();`);
    expectActive(`function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  const lookupCaller = () => {};
  lookupCaller();
}`);
    expectActive(`function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
eval("lookupCaller = replacement");
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) lookupCaller();`);
    expectActive(`function lookupCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  scheduleLater(lookupCaller);
  lookupCaller.call(null);
}`);
  });

  it("skips client files", () =>
    void expectSkipped(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.get("abc");
}`,
      { filename: "form.client.js" },
    ));

  it("flags GlideRecord query/get and GlideAggregate query inside the cursor loop", () => {
    expectInvalid(`var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var extra = new GlideRecord("task");
  extra.query();
}`);
    expectInvalid(`var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var agg = new GlideAggregate("task");
  agg.addAggregate("COUNT");
  agg.query();
}`);
  });

  it("flags a get on a record constructed outside the loop", () =>
    void expectInvalid(`var incident = new GlideRecord("incident");
var caller = new GlideRecord("sys_user");
incident.query();
while (incident.next()) {
  caller.get(incident.getValue("caller_id"));
}`));

  it("tracks aliases", () =>
    void expectInvalid(`var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  var rec = caller;
  rec.get(incident.getValue("caller_id"));
}`));

  it("tracks cursor advancement in a for update on later iterations", () =>
    void expectInvalid(`var cursor = new GlideRecord("incident");
var inner = new GlideRecord("task");
cursor.query();
for (; keepGoing; cursor.next()) {
  inner.query();
}`));
});

describe("cursor condition implications", () => {
  const { expectInvalid, expectValid } = ruleTester("no-gliderecord-query-in-loop", BUSINESS_RULE, {
    messageId: "nestedQuery",
  });

  const nested = (test: string) => `var incident = new GlideRecord("incident");
incident.query();
while (${test}) {
  var extra = new GlideRecord("task");
  extra.query();
}`;
  it("requires next success on && paths and rejects fallback-only ||/?? entry", () => {
    expectInvalid(nested("incident.next() && ready"));
    expectInvalid(nested("ready && incident.next()"));
    expectValid(nested("incident.next() || ready"));
    expectValid(nested("ready ?? incident.next()"));
  });
});

describe("no-system-query-bypass", () => {
  const { expectInvalid, expectValid, expectActive, expectSkipped } = ruleTester(
    "no-system-query-bypass",
    BUSINESS_RULE,
    { messageId: "bypass" },
  );

  it("flags documented bypass methods", () => {
    for (const method of [
      "addSystemQuery",
      "addSystemEncodedQuery",
      "addSystemOrderBy",
      "addSystemOrderByDesc",
    ]) {
      expectInvalid(`var user = new GlideRecord("sys_user");
user.${method}("active", true);
user.query();`);
    }
  });

  it("allows normal query methods", () =>
    void expectValid(`var user = new GlideRecord("sys_user");
user.addQuery("active", true);
user.query();`));

  it("ignores unrelated objects and shadowed constructors", () => {
    expectActive(`var user = { addSystemQuery: function () {} };
user.addSystemQuery("active", true);`);
    expectActive(`function GlideRecord() { this.addSystemQuery = function () {}; }
var user = new GlideRecord("sys_user");
user.addSystemQuery("active", true);`);
  });

  it("does not match an undocumented addSystem name", () =>
    void expectValid(`var user = new GlideRecord("sys_user");
user.addSystemFoo("active", true);
user.query();`));

  it("tracks aliases and static computed members", () =>
    void expectInvalid(`var user = new GlideRecord("sys_user");
var rec = user;
rec["addSystemQuery"]("active", true);`));

  it("flags folded, dynamic, extracted, and escaped bypass access", () => {
    expectInvalid(`var user = new GlideRecord("sys_user");
user["addSystem" + "Query"]("active=true");`);
    expectInvalid(
      `var user = new GlideRecord("sys_user");
user[method]("active=true");`,
      { messageId: "possibleBypass" },
    );
    expectInvalid(`var user = new GlideRecord("sys_user");
var bypass = user.addSystemQuery;
bypass.call(user, "active=true");`);
    expectInvalid(`var user = new GlideRecord("sys_user");
prepare(user);
user.addSystemQuery("active=true");`);
  });

  it("skips client files", () =>
    void expectSkipped(
      `var user = new GlideRecord("sys_user");
user.addSystemQuery("active", true);`,
      { filename: "form.client.js" },
    ));
});
