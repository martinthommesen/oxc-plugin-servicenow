import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import { SUPPORTED_SERVICENOW_RELEASES } from "../../src/settings/releases.js";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const SERVER = { filename: "incident.br.js" };

describe("validate-glideaggregate-calls lifecycle", () => {
  const { expectInvalid, expectValid, expectActive } = ruleTester(
    "validate-glideaggregate-calls",
    {},
    { messageId: "unknownAggregate" },
  );

  it("does not treat a one-branch tuple as definite", () =>
    void expectInvalid(
      `var ga = new GlideAggregate("incident");
if (includePriority) {
  ga.addAggregate("COUNT", "priority");
}
ga.query();
ga.next();
ga.getAggregate("COUNT", "priority");`,
      undefined,
      SERVER,
    ));

  it("does not let type-only COUNT satisfy a field-specific read", () =>
    void expectInvalid(
      `var ga = new GlideAggregate("incident");
ga.addAggregate("COUNT");
ga.query();
ga.next();
ga.getAggregate("COUNT", "priority");`,
      undefined,
      SERVER,
    ));

  it("does not accept addAggregate after query for the open result", () => {
    expectInvalid(
      `var ga = new GlideAggregate("incident");
ga.addAggregate("COUNT");
ga.query();
ga.addAggregate("SUM", "amount");
ga.next();
ga.getAggregate("SUM", "amount");`,
      undefined,
      SERVER,
    );
    expectInvalid(
      `var ga = new GlideAggregate("incident");
ga.addAggregate("COUNT");
ga.query();
ga.addAggregate(kind);
ga.getAggregate("SUM", "amount");`,
      undefined,
      SERVER,
    );
  });

  it("preserves correlated static and dynamic branch alternatives", () => {
    expectInvalid(
      `var ga = new GlideAggregate("incident");
if (dynamic) ga.addAggregate(kind);
else ga.addAggregate("COUNT");
ga.query();
ga.getAggregate("SUM", "amount");`,
      undefined,
      SERVER,
    );
    expectValid(
      `var ga = new GlideAggregate("incident");
if (dynamic) ga.addAggregate(kind);
else ga.addAggregate("SUM", "amount");
ga.query();
ga.getAggregate("SUM", "amount");`,
      SERVER,
    );
  });

  it("retains earlier aggregates on a later query epoch", () => {
    expectValid(
      `var ga = new GlideAggregate("incident");
ga.addAggregate("COUNT");
ga.query();
ga.next();
ga.getAggregate("COUNT");
ga.addAggregate("SUM", "amount");
ga.query();
ga.next();
ga.getAggregate("COUNT");
ga.getAggregate("SUM", "amount");`,
      SERVER,
    );
    expectInvalid(
      `var ga = new GlideAggregate("incident");
ga.addAggregate("COUNT");
ga.query();
ga.next();
ga.getAggregate("SUM", "amount");`,
      undefined,
      SERVER,
    );
  });

  it("tracks aliases and sibling reassignment", () =>
    void expectInvalid(
      `var ga = new GlideAggregate("incident");
var alias = ga;
ga = other;
alias.next();`,
      { messageId: "missingQuery" },
      SERVER,
    ));

  it("stays silent after helper escape", () =>
    void expectActive(
      `var ga = new GlideAggregate("incident");
prepare(ga);
ga.getAggregate("COUNT");`,
      SERVER,
    ));
});

describe("no-unfiltered-gliderecord-bulk-operation filters", () => {
  const { expectInvalid, expectValid, expectActive } = ruleTester(
    "no-unfiltered-gliderecord-bulk-operation",
    {},
    { messageId: "unfiltered" },
  );

  it("flags missing and empty filter arguments", () => {
    expectInvalid(
      `var gr = new GlideRecord("task");
gr.addQuery();
gr.deleteMultiple();`,
      undefined,
      SERVER,
    );
    expectInvalid(
      `var gr = new GlideRecord("task");
gr.addEncodedQuery("");
gr.updateMultiple();`,
      undefined,
      SERVER,
    );
    expectInvalid(
      `var gr = new GlideRecord("task");
gr.addEncodedQuery(null);
gr.deleteMultiple();`,
      undefined,
      SERVER,
    );
    expectInvalid(
      `var gr = new GlideRecord("task");
gr.addQuery(42);
gr.deleteMultiple();`,
      undefined,
      SERVER,
    );
    expectInvalid(
      `var gr = new GlideRecord("task");
gr.addEncodedQuery(false);
gr.deleteMultiple();`,
      undefined,
      SERVER,
    );
  });

  it("counts a filter applied through a non-identifier receiver", () => {
    // `(gr = new GlideRecord(...))` has no object name. The finder used to skip
    // such calls, losing the filter fact and reporting the bulk operation as
    // unfiltered.
    expectValid(
      `var gr;
(gr = new GlideRecord("task")).addQuery("active", true);
gr.deleteMultiple();`,
      SERVER,
    );
  });

  it("stays silent for a shadowed undefined filter", () =>
    void expectActive(
      `function run(undefined) {
  var gr = new GlideRecord("task");
  gr.addQuery(undefined);
  gr.deleteMultiple();
}`,
      SERVER,
    ));

  it("stays silent for a dynamic filter argument", () =>
    void expectActive(
      `var gr = new GlideRecord("task");
gr.addQuery(fieldName, value);
gr.deleteMultiple();`,
      SERVER,
    ));

  it("stays silent after an unknown method follows merged filter state", () =>
    void expectActive(
      `var gr = new GlideRecord("task");
if (ready) gr.addQuery("active", true);
gr.unknownMethod();
gr.deleteMultiple();`,
      SERVER,
    ));

  it("does not treat shape or executor calls as filters", () => {
    expectInvalid(
      `var gr = new GlideRecord("task");
gr.chooseWindow(0, 10);
gr.setLimit(10);
gr.query();
gr.deleteMultiple();`,
      undefined,
      SERVER,
    );
    for (const release of SUPPORTED_SERVICENOW_RELEASES) {
      expectInvalid(
        `var gr = new GlideRecord("task");
gr._query();
gr.deleteMultiple();`,
        undefined,
        { ...SERVER, settings: { scope: "scoped", release } },
      );
      expectInvalid(
        `var gr = new GlideRecord("task");
gr.queryNoDomain();
gr.deleteMultiple();`,
        undefined,
        { ...SERVER, settings: { scope: "global", release } },
      );
    }
  });
});

describe("require-glideajax-sysparm-name values", () => {
  const { expectInvalid, expectActive, expectValid } = ruleTester(
    "require-glideajax-sysparm-name",
    {},
    { messageId: "emptyValue" },
  );

  it("flags a missing or empty sysparm_name value", () => {
    expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name");
ajax.getXMLAnswer(handleAnswer);`);
    expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "");
ajax.getXML(handleResponse);`);
    expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", null);
ajax.getXMLWait();`);
    expectInvalid(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", undefined);
ajax.getXMLAnswer(handleAnswer);`);
  });

  it("stays silent for a dynamic method value", () =>
    void expectActive(`var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", methodName);
ajax.getXMLAnswer(handleAnswer);`));

  it("flags a statically non-string method value", () => {
    for (const value of ["false", "42", "{}", "[]"]) {
      expectInvalid(
        `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", ${value});
ajax.getXMLAnswer(handleAnswer);`,
        { messageId: "invalidValue" },
      );
    }
  });

  it("treats missing and non-string keys as definitely absent", () => {
    for (const key of ["", "null", "false", "42", "{}", "[]"]) {
      expectInvalid(
        `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam(${key});
ajax.getXMLAnswer(handleAnswer);`,
        { messageId: "missingName" },
      );
    }
  });

  it("keeps sibling aliases after one name is reassigned", () => {
    expectValid(`var ajax = new GlideAjax("x_acme.UserLookup");
var original = ajax;
ajax.addParam("sysparm_name", "getManager");
ajax = {};
original.getXMLAnswer(handleAnswer);`);
    expectInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
var original = ajax;
ajax = {};
original.getXMLWait();`,
      { messageId: "missingName" },
    );
  });

  it("requires a new usable name for a later request", () =>
    void expectInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(handleAnswer);
ajax.getXMLWait();`,
      { count: 1, messageId: "missingName" },
    ));
});

describe("prefer-setnocount-with-choosewindow epochs", () => {
  const RULE = "prefer-setnocount-with-choosewindow" as const;

  it("does not let an earlier getRowCount justify a later windowed query", () =>
    void assertInvalid(
      `var gr = new GlideRecord("incident");
gr.query();
gr.getRowCount();
gr.chooseWindow(100, 200);
gr.query();`,
      RULE,
      { messageId: "missing" },
      SERVER,
    ));

  it("still honors getRowCount on the same query after a no-op branch", () =>
    void assertValid(
      `var gr = new GlideRecord("incident");
gr.chooseWindow(0, 100);
gr.query();
if (debug) {
  gs.info("page loaded");
}
gr.getRowCount();`,
      RULE,
      SERVER,
    ));
});

describe("no-gliderecord-query-in-loop receivers", () => {
  const { expectValid, expectInvalid } = ruleTester(
    "no-gliderecord-query-in-loop",
    {},
    { messageId: "nestedQuery" },
  );

  it("does not treat an unrelated iterator as a Glide cursor", () =>
    void expectValid(
      `while (customIterator.next()) {
  var gr = new GlideRecord("task");
  gr.query();
}`,
      SERVER,
    ));

  it("flags a nested query when the outer next is a proven cursor alias", () =>
    void expectInvalid(
      `var incident = new GlideRecord("incident");
var cursor = incident;
incident.query();
while (cursor.next()) {
  var caller = new GlideRecord("sys_user");
  caller.get(incident.getValue("caller_id"));
}`,
      undefined,
      SERVER,
    ));

  it("recognizes documented executor and cursor aliases", () => {
    expectInvalid(
      `var incident = new GlideRecord("incident");
incident._query();
while (incident._next()) {
  var caller = new GlideRecord("sys_user");
  caller["_query"]();
}`,
      undefined,
      { ...SERVER, settings: { scope: "scoped", release: "zurich" } },
    );
    expectInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident._next()) {
  var caller = new GlideRecord("sys_user");
  caller.queryNoDomain();
}`,
      undefined,
      { ...SERVER, settings: { scope: "global", release: "zurich" } },
    );
  });

  it("does not assume a global-only nested executor at unknown scope", () =>
    void expectValid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.queryNoDomain();
}`,
      { ...SERVER, settings: { scope: "unknown", release: "zurich" } },
    ));

  it("does not project undocumented GlideRecord aliases onto GlideAggregate", () => {
    expectValid(
      `var aggregate = new GlideAggregate("incident");
aggregate.query();
while (aggregate._next()) {
  var caller = new GlideRecord("sys_user");
  caller.query();
}`,
      SERVER,
    );
    expectValid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var aggregate = new GlideAggregate("task");
  aggregate._query();
}`,
      SERVER,
    );
    expectValid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var aggregate = new GlideAggregate("task");
  aggregate.get("abc");
}`,
      SERVER,
    );
  });

  it("does not treat an undocumented getAsync as a nested query", () =>
    void expectValid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.getAsync(incident.getValue("caller_id"));
}`,
      { ...SERVER, settings: { scope: "global", release: "zurich" } },
    ));

  it("recognizes boolean-comparison cursor conditions", () =>
    void expectInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next() === true) {
  var caller = new GlideRecord("sys_user");
  caller.query();
}`,
      undefined,
      SERVER,
    ));

  it("flags a query after next in a loop test", () =>
    void expectInvalid(
      `var incident = new GlideRecord("incident");
var caller = new GlideRecord("sys_user");
incident.query();
while (incident.next() && caller.query()) {}`,
      undefined,
      SERVER,
    ));

  it("keeps an invoked function expression inside the cursor loop", () =>
    void expectInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  (function () {
    var caller = new GlideRecord("sys_user");
    caller.query();
  })();
}`,
      undefined,
      SERVER,
    ));

  it("evaluates invoked-function parameter defaults inside the cursor loop", () => {
    expectInvalid(
      `var incident = new GlideRecord("incident");
var caller = new GlideRecord("sys_user");
incident.query();
while (incident.next()) {
  (function (value = caller.query()) {})();
}`,
      undefined,
      SERVER,
    );
    expectValid(
      `var incident = new GlideRecord("incident");
var caller = new GlideRecord("sys_user");
incident.query();
while (incident.next()) {
  (function (value = caller.query()) {})("supplied");
}`,
      SERVER,
    );
    for (const argument of ["undefined", "void 0", "missing"]) {
      expectInvalid(
        `var incident = new GlideRecord("incident");
var caller = new GlideRecord("sys_user");
const missing = undefined;
incident.query();
while (incident.next()) {
  (function (value = caller.query()) {})(${argument});
}`,
        undefined,
        SERVER,
      );
    }
    expectValid(
      `var undefined = "supplied";
var incident = new GlideRecord("incident");
var caller = new GlideRecord("sys_user");
incident.query();
while (incident.next()) {
  (function (value = caller.query()) {})(undefined);
}`,
      SERVER,
    );
    expectValid(
      `var incident = new GlideRecord("incident");
var caller = new GlideRecord("sys_user");
incident.query();
while (incident.next()) {
  (function (value = caller.query()) {})(missing);
}
const missing = undefined;`,
      SERVER,
    );
  });

  it("does not revisit a do-while body after an unconditional exit", () =>
    void expectValid(
      `var incident = new GlideRecord("incident");
incident.query();
do {
  var caller = new GlideRecord("sys_user");
  caller.query();
  break;
} while (incident.next());`,
      SERVER,
    ));

  it("revisits a do-while body when continue can reach the cursor test", () =>
    void expectInvalid(
      `var incident = new GlideRecord("incident");
var caller = new GlideRecord("sys_user");
incident.query();
do {
  caller.query();
  if (skip) continue;
  break;
} while (incident.next());`,
      undefined,
      SERVER,
    ));
});

describe("require-query-before-next executors", () => {
  const { expectValid, expectInvalid, expectActive } = ruleTester(
    "require-query-before-next",
    {},
    { messageId: "missingQuery" },
  );

  it("accepts _query before either documented cursor advancer", () =>
    void expectValid(
      `var gr = new GlideRecord("incident");
var alias = gr;
alias["_query"]();
gr._next();`,
      { ...SERVER, settings: { scope: "scoped", release: "zurich" } },
    ));

  it("accepts queryNoDomain when global scope is explicit or possible", () => {
    const code = `var gr = new GlideRecord("incident");
gr.queryNoDomain();
gr.next();`;
    expectValid(code, {
      ...SERVER,
      settings: { scope: "global", release: "zurich" },
    });
    expectValid(code, {
      ...SERVER,
      settings: { scope: "unknown", release: "zurich" },
    });
  });

  it("requires _query on every reachable path", () => {
    expectInvalid(
      `var gr = new GlideRecord("incident");
if (ready) gr._query();
gr._next();`,
      undefined,
      SERVER,
    );
    expectValid(
      `var gr = new GlideRecord("incident");
if (ready) gr._query();
else gr.query();
gr._next();`,
      SERVER,
    );
  });

  it("stays silent after an unresolved computed call", () => {
    expectActive(
      `var gr = new GlideRecord("incident");
gr[executor]();
gr._next();`,
      SERVER,
    );
    expectActive(
      `var first = new GlideRecord("incident");
var original = first;
var second = new GlideRecord("problem");
var method = "_query";
first[(first = second, method)]();
original.next();`,
      SERVER,
    );
  });

  it("does not treat an undocumented getAsync as an opener", () => {
    expectInvalid(
      `var gr = new GlideRecord("incident");
gr.getAsync(id);
gr.next();`,
      undefined,
      { ...SERVER, settings: { scope: "global", release: "zurich" } },
    );
    expectInvalid(
      `var gr = new GlideRecord("incident");
gr.getAsync(id);
gr.next();`,
      undefined,
      { ...SERVER, settings: { scope: "scoped", release: "zurich" } },
    );
  });

  it("lets an unconditional query restore the cursor state", () =>
    void expectValid(
      `var gr = new GlideRecord("incident"); if (ready) gr.query(); gr.query(); gr.next();`,
    ));
});
