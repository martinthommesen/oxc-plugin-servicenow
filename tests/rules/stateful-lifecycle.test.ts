import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const SERVER = { filename: "incident.br.js" };
const CLIENT = { filename: "incident.client.js" };

describe("validate-glideaggregate-calls lifecycle", () => {
  const RULE = "validate-glideaggregate-calls" as const;

  it("does not treat a one-branch tuple as definite", () => {
    assertInvalid(
      `var ga = new GlideAggregate("incident");
if (includePriority) {
  ga.addAggregate("COUNT", "priority");
}
ga.query();
ga.next();
ga.getAggregate("COUNT", "priority");`,
      RULE,
      { messageId: "unknownAggregate" },
      SERVER,
    );
  });

  it("does not let type-only COUNT satisfy a field-specific read", () => {
    assertInvalid(
      `var ga = new GlideAggregate("incident");
ga.addAggregate("COUNT");
ga.query();
ga.next();
ga.getAggregate("COUNT", "priority");`,
      RULE,
      { messageId: "unknownAggregate" },
      SERVER,
    );
  });

  it("does not accept addAggregate after query for the open result", () => {
    assertInvalid(
      `var ga = new GlideAggregate("incident");
ga.addAggregate("COUNT");
ga.query();
ga.addAggregate("SUM", "amount");
ga.next();
ga.getAggregate("SUM", "amount");`,
      RULE,
      { messageId: "unknownAggregate" },
      SERVER,
    );
  });

  it("retains earlier aggregates on a later query epoch", () => {
    assertValid(
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
      RULE,
      SERVER,
    );
    assertInvalid(
      `var ga = new GlideAggregate("incident");
ga.addAggregate("COUNT");
ga.query();
ga.next();
ga.getAggregate("SUM", "amount");`,
      RULE,
      { messageId: "unknownAggregate" },
      SERVER,
    );
  });

  it("tracks aliases and sibling reassignment", () => {
    assertInvalid(
      `var ga = new GlideAggregate("incident");
var alias = ga;
ga = other;
alias.next();`,
      RULE,
      { messageId: "missingQuery" },
      SERVER,
    );
  });

  it("stays silent after helper escape", () => {
    assertValid(
      `var ga = new GlideAggregate("incident");
prepare(ga);
ga.getAggregate("COUNT");`,
      RULE,
      SERVER,
    );
  });
});

describe("no-unfiltered-gliderecord-bulk-operation filters", () => {
  const RULE = "no-unfiltered-gliderecord-bulk-operation" as const;

  it("flags missing and empty filter arguments", () => {
    assertInvalid(
      `var gr = new GlideRecord("task");
gr.addQuery();
gr.deleteMultiple();`,
      RULE,
      { messageId: "unfiltered" },
      SERVER,
    );
    assertInvalid(
      `var gr = new GlideRecord("task");
gr.addEncodedQuery("");
gr.updateMultiple();`,
      RULE,
      { messageId: "unfiltered" },
      SERVER,
    );
    assertInvalid(
      `var gr = new GlideRecord("task");
gr.addEncodedQuery(null);
gr.deleteMultiple();`,
      RULE,
      { messageId: "unfiltered" },
      SERVER,
    );
  });

  it("stays silent for a dynamic filter argument", () => {
    assertValid(
      `var gr = new GlideRecord("task");
gr.addQuery(fieldName, value);
gr.deleteMultiple();`,
      RULE,
      SERVER,
    );
  });

  it("does not treat shape or executor calls as filters", () => {
    assertInvalid(
      `var gr = new GlideRecord("task");
gr.chooseWindow(0, 10);
gr.setLimit(10);
gr.query();
gr.deleteMultiple();`,
      RULE,
      { messageId: "unfiltered" },
      SERVER,
    );
  });
});

describe("require-glideajax-sysparm-name values", () => {
  const RULE = "require-glideajax-sysparm-name" as const;

  it("flags a missing or empty sysparm_name value", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name");
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      { messageId: "emptyValue" },
      CLIENT,
    );
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "");
ajax.getXML(handleResponse);`,
      RULE,
      { messageId: "emptyValue" },
      CLIENT,
    );
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", null);
ajax.getXMLWait();`,
      RULE,
      { messageId: "emptyValue" },
      CLIENT,
    );
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", undefined);
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      { messageId: "emptyValue" },
      CLIENT,
    );
  });

  it("stays silent for a dynamic method value", () => {
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", methodName);
ajax.getXMLAnswer(handleAnswer);`,
      RULE,
      CLIENT,
    );
  });

  it("keeps sibling aliases after one name is reassigned", () => {
    assertValid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
var original = ajax;
ajax.addParam("sysparm_name", "getManager");
ajax = {};
original.getXMLAnswer(handleAnswer);`,
      RULE,
      CLIENT,
    );
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
var original = ajax;
ajax = {};
original.getXMLWait();`,
      RULE,
      { messageId: "missingName" },
      CLIENT,
    );
  });

  it("requires a new usable name for a later request", () => {
    assertInvalid(
      `var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(handleAnswer);
ajax.getXMLWait();`,
      RULE,
      { count: 1, messageId: "missingName" },
      CLIENT,
    );
  });
});

describe("prefer-setnocount-with-choosewindow epochs", () => {
  const RULE = "prefer-setnocount-with-choosewindow" as const;

  it("does not let an earlier getRowCount justify a later windowed query", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
gr.query();
gr.getRowCount();
gr.chooseWindow(100, 200);
gr.query();`,
      RULE,
      { messageId: "missing" },
      SERVER,
    );
  });

  it("still honors getRowCount on the same query after a no-op branch", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
gr.chooseWindow(0, 100);
gr.query();
if (debug) {
  gs.info("page loaded");
}
gr.getRowCount();`,
      RULE,
      SERVER,
    );
  });
});

describe("no-gliderecord-query-in-loop receivers", () => {
  const RULE = "no-gliderecord-query-in-loop" as const;

  it("does not treat an unrelated iterator as a Glide cursor", () => {
    assertValid(
      `while (customIterator.next()) {
  var gr = new GlideRecord("task");
  gr.query();
}`,
      RULE,
      SERVER,
    );
  });

  it("flags a nested query when the outer next is a proven cursor alias", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
var cursor = incident;
incident.query();
while (cursor.next()) {
  var caller = new GlideRecord("sys_user");
  caller.get(incident.getValue("caller_id"));
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });

  it("flags getAsync inside a proven cursor loop", () => {
    assertInvalid(
      `var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.getAsync(incident.getValue("caller_id"));
}`,
      RULE,
      { messageId: "nestedQuery" },
      SERVER,
    );
  });
});

describe("require-query-before-next executors", () => {
  it("treats getAsync as a documented opener", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
gr.getAsync(id);
gr.next();`,
      "require-query-before-next",
      SERVER,
    );
  });
});
