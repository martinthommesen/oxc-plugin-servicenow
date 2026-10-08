import { ruleTester } from "../helpers/rule-tester.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertInvalid, assertValid, assertValidActive } from "../helpers/rule-tester.js";
import { ServiceNowSettingsError, validateServiceNowSettings } from "../../src/settings/index.js";

const NOW = { filename: "file.now.ts" };

describe("fluentSdkVersion registry", () => {
  const { expectInvalid, expectValid } = ruleTester(
    "require-fluent-id",
    {},
    { messageId: "missing" },
  );

  it("rejects an unsupported SDK version", () =>
    void assert.throws(
      () => validateServiceNowSettings({ fluentSdkVersion: "9.9.9" }),
      (error: unknown) =>
        error instanceof ServiceNowSettingsError &&
        /unsupported Fluent SDK version/.test(error.message),
    ));

  it("accepts every reviewed exact patch and rejects unpublished patches", () => {
    assert.doesNotThrow(() => validateServiceNowSettings({ fluentSdkVersion: "3.0.3" }));
    assert.doesNotThrow(() => validateServiceNowSettings({ fluentSdkVersion: "4.9.1" }));
    assert.doesNotThrow(() => validateServiceNowSettings({ fluentSdkVersion: "4.10.1" }));
    assert.throws(
      () => validateServiceNowSettings({ fluentSdkVersion: "4.10.2" }),
      ServiceNowSettingsError,
    );
  });

  it("keeps the Australia release independent from the selected Fluent SDK manifest", () => {
    const businessRule = `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ table: "incident", name: "Update" });`;
    for (const fluentSdkVersion of ["4.4.0", "4.4.1", "4.11.0"]) {
      assert.doesNotThrow(() =>
        validateServiceNowSettings({ release: "australia", fluentSdkVersion }),
      );
      expectInvalid(businessRule, undefined, {
        ...NOW,
        settings: { release: "australia", fluentSdkVersion },
      });
    }
  });

  it("keeps the published Table signature across 3.0.0 and 4.1.0", () => {
    const table = `import { Table } from "@servicenow/sdk/core";\nexport const incident = Table({ name: "x_acme_incident" });`;
    expectValid(table, { ...NOW, settings: { fluentSdkVersion: "3.0.0" } });
    expectValid(table, { ...NOW, settings: { fluentSdkVersion: "4.1.0" } });
  });

  it("resolves aliases by execution order, not declaration order (FINDINGS.md COR-006)", () => {
    const V3 = { ...NOW, settings: { fluentSdkVersion: "3.0.0" } };
    const use = 'L({ table: "incident", columns: [], view: "Default" });';
    const head = 'import { List } from "@servicenow/sdk/core";\nlet L = List;';
    // Straight-line module code keeps positional resolution.
    expectInvalid(`${head}\n${use}\nL = console.log;`, undefined, V3);
    // A reassignment inside a hoisted function makes the alias uncertain in
    // both declaration orders: the function can run before the use.
    expectValid(`${head}\nmutate();\n${use}\nfunction mutate() { L = console.log; }`, V3);
    expectValid(`${head}\nfunction mutate() { L = console.log; }\nmutate();\n${use}`, V3);
    // A use inside a function cannot trust module-level reassignments.
    expectValid(`${head}\nfunction go() { ${use} }\nL = console.log;\ngo();`, V3);
  });

  it("models the List ID transition from 3.0.0 to 4.1.0", () => {
    const list = `import { List } from "@servicenow/sdk/core";\nList({ table: "incident", columns: [], view: "Default" });`;
    expectInvalid(list, undefined, { ...NOW, settings: { fluentSdkVersion: "3.0.0" } });
    expectValid(list, { ...NOW, settings: { fluentSdkVersion: "4.1.0" } });
  });

  it("respects capability introduction boundaries", () => {
    const alias = `import { AliasTemplate } from "@servicenow/sdk/core";\nAliasTemplate({ name: "template" });`;
    expectValid(alias, { ...NOW, settings: { fluentSdkVersion: "4.1.0" } });
    expectInvalid(alias, undefined, { ...NOW, settings: { fluentSdkVersion: "4.8.0" } });
    expectInvalid(alias, undefined, { ...NOW, settings: { fluentSdkVersion: "4.11.0" } });

    const producer = `import { CatalogItemRecordProducer } from "@servicenow/sdk/core";\nCatalogItemRecordProducer({ name: "producer" });`;
    expectValid(producer, { ...NOW, settings: { fluentSdkVersion: "4.1.0" } });
    expectInvalid(producer, undefined, { ...NOW, settings: { fluentSdkVersion: "4.8.0" } });
  });

  it("uses declaration-proven factory presence and absence", () => {
    const sla = `import { Sla } from "@servicenow/sdk/core";\nSla({ name: "Response" });`;
    expectValid(sla, { ...NOW, settings: { fluentSdkVersion: "4.2.0" } });
    expectInvalid(sla, undefined, { ...NOW, settings: { fluentSdkVersion: "4.3.0" } });

    const graphql = `import { GraphQLApi } from "@servicenow/sdk/core";\nGraphQLApi({ name: "API" });`;
    expectValid(graphql, { ...NOW, settings: { fluentSdkVersion: "4.10.1" } });
    expectInvalid(graphql, undefined, { ...NOW, settings: { fluentSdkVersion: "4.11.0" } });

    for (const phantom of ["DatabaseIndex", "Module", "ScriptedRestApi", "UiFormatter"]) {
      expectValid(
        `import { ${phantom} } from "@servicenow/sdk/core";\n${phantom}({ name: "local" });`,
        NOW,
      );
    }
  });
});

describe("Fluent factory binding identity", () => {
  const { expectInvalid, expectActive, expectValid } = ruleTester(
    "require-fluent-id",
    {},
    { messageId: "missing", count: 1 },
  );

  it("requires $id on an aliased import", () =>
    void expectInvalid(
      `import { BusinessRule as BR } from "@servicenow/sdk/core";\nBR({ table: "incident", name: "Update" });`,
      { messageId: "missing" },
      NOW,
    ));

  it("requires $id on a namespace import", () =>
    void expectInvalid(
      `import * as core from "@servicenow/sdk/core";\ncore.BusinessRule({ table: "incident", name: "Update" });`,
      { messageId: "missing" },
      NOW,
    ));

  it("ignores a local function with the same name", () => {
    expectActive(
      `function BusinessRule(config) { return config; }\nBusinessRule({ name: "Local helper" });`,
      NOW,
    );
    assertValidActive(
      `function BusinessRule(config) { return config; }\nBusinessRule({ name: "Local helper" });`,
      "fluent-proper-imports",
      NOW,
    );
  });

  it("resolves mutable named aliases at each call", () => {
    expectInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let BR = BusinessRule;
BR({ name: "SDK" });
BR = function local(config) { return config; };
BR({ name: "local" });`,
      undefined,
      NOW,
    );
    expectInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let BR = function local(config) { return config; };
BR({ name: "local" });
BR = BusinessRule;
BR({ name: "SDK" });`,
      undefined,
      NOW,
    );
  });

  it("resolves mutable namespace aliases at each call", () =>
    void expectInvalid(
      `import * as sdk from "@servicenow/sdk/core";
let alias = sdk;
alias.BusinessRule({ name: "SDK" });
alias = { BusinessRule(config) { return config; } };
alias.BusinessRule({ name: "local" });`,
      undefined,
      NOW,
    ));

  // @lat: [[tests#Analysis behavior#Initialized var redeclarations are alias writes]]
  it("treats an initialized var redeclaration as an alias write (FINDINGS.md COR-009)", () => {
    const head = 'import { BusinessRule } from "@servicenow/sdk/core";\nfunction local() {}';
    const call = 'T({ name: "x_test", table: "incident" });';
    const missing = { messageId: "missing" };
    expectValid(`${head}\nvar T = BusinessRule;\nvar T = local;\n${call}`, NOW);
    expectInvalid(`${head}\nvar T = local;\nvar T = BusinessRule;\n${call}`, missing, NOW);
    // A bare redeclaration is a runtime no-op in either position.
    expectInvalid(`${head}\nvar T = BusinessRule;\nvar T;\n${call}`, missing, NOW);
    expectInvalid(`${head}\nvar T;\nvar T = BusinessRule;\n${call}`, missing, NOW);
    // Conditional and function-scoped redeclarations stay uncertain.
    expectValid(`${head}\nvar T = BusinessRule;\nif (condition) var T = local;\n${call}`, NOW);
    expectValid(
      `${head}\nvar T = BusinessRule;\nfunction swap() { T = local; }\nswap();\n${call}`,
      NOW,
    );
    // A var inside another function is a different binding, not a redeclaration.
    expectInvalid(
      `${head}\nvar T = BusinessRule;\nfunction other() { var T = local; }\n${call}`,
      missing,
      NOW,
    );
  });

  it("stays conservative after conditional alias writes", () =>
    void expectValid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let BR = BusinessRule;
if (condition) BR = function local(config) { return config; };
BR({ name: "unknown" });`,
      NOW,
    ));
});

describe("temporal Now.ID aliases", () => {
  const { expectValid, expectActive } = ruleTester("no-now-id-as-reference", {}, {});

  it("keeps an earlier valid $id after later reassignment", () =>
    void expectValid(
      `let id = Now.ID["user-information"];
VariableSet({ $id: id, title: "User information" });
id = "ordinary";`,
      NOW,
    ));

  it("does not reinterpret an earlier ordinary use", () =>
    void expectValid(
      `let id = "ordinary";
consume({ reference: id });
id = Now.ID["user-information"];
VariableSet({ $id: id });`,
      NOW,
    ));

  it("keeps shadowed aliases independent", () =>
    void expectValid(
      `const id = Now.ID["outer"];
function run() {
  const id = "ordinary";
  consume(id);
}
Record({ $id: id });`,
      NOW,
    ));

  it("ignores a local Now object", () =>
    void expectActive(
      `import { BusinessRule } from "@servicenow/sdk/core";
const Now = { ID: { fake: "local" }, include: function (path) { return path; } };
BusinessRule({ $id: Now.ID.fake, script: Now.include("./not-sdk.js") });`,
      NOW,
    ));

  it("accepts immutable aliases of Now and Now.ID", () =>
    void assertValid(
      `const SDK = Now;
const IDs = SDK.ID;
BusinessRule({ $id: IDs["aliased"] });`,
      "require-fluent-id",
      NOW,
    ));

  it("requires identity provenance on every branch", () => {
    assertInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let id;
if (condition) id = Now.ID["branch"]; else id = "raw";
BusinessRule({ $id: id });`,
      "require-fluent-id",
      { messageId: "preferNowId" },
      NOW,
    );
    assertValid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let id;
if (condition) id = Now.ID["left"]; else id = Now.ID["right"];
BusinessRule({ $id: id });`,
      "require-fluent-id",
      NOW,
    );
  });
});

describe("Now.ID provenance and use sites", () => {
  const { expectInvalid, expectActive } = ruleTester("no-now-id-as-reference", {}, { count: 1 });

  it("reports dynamic and non-lexical uses but accepts a dynamic $id", () => {
    const dynamic = `import { BusinessRule } from "@servicenow/sdk/core";
const key = getKey();
const config = {};
config.reference = Now.ID[key];
consume([Now.ID[key]]);
BusinessRule({ $id: Now.ID[key], name: "dynamic" });`;
    expectInvalid(dynamic, { count: 2 }, NOW);
    assertValid(
      `const key = getKey();
const id = Now.ID[key];
BusinessRule({ $id: id, name: "dynamic" });`,
      "require-fluent-id",
      NOW,
    );
  });

  it("ignores type-only Now.ID references", () =>
    void expectActive(
      `const id = Now.ID["type-only"];
type IdType = typeof id;`,
      NOW,
    ));

  it("does not exempt member assignment or object storage as an alias", () => {
    expectInvalid(
      `const config = {};
config.reference = Now.ID["reference"];`,
      undefined,
      NOW,
    );
    expectInvalid(`const values = [Now.ID["stored"]];`, undefined, NOW);
  });

  it("reports identity values in compound assignments", () =>
    void expectInvalid(
      `let value = "";
value += Now.ID["append"];
value ||= Now.ID["fallback"];
const config = { $id: "raw" };
config.$id += Now.ID["compound-id"];`,
      { count: 3 },
      NOW,
    ));
});

describe("authoritative Fluent factories", () => {
  it("reports a wrong-module import without semantic factory diagnostics", () => {
    const code = `import { BusinessRule } from "some-other-package";
BusinessRule({ name: "local" });`;
    assertInvalid(code, "fluent-proper-imports", { messageId: "wrongModule" }, NOW);
    assertValid(code, "require-fluent-id", NOW);
  });
});

describe("fluent-directives placement", () => {
  const { expectInvalid, expectValid } = ruleTester(
    "fluent-directives",
    {},
    { messageId: "dangling" },
  );

  it("flags an end-of-file @fluent-ignore", () => {
    expectInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["x"], table: "incident" });\n// @fluent-ignore\n`,
      undefined,
      NOW,
    );
  });

  it("allows a previous-line ignore before a statement", () => {
    expectValid(`// @fluent-ignore\nimport { BusinessRule } from "@servicenow/sdk/core";\n`, NOW);
  });

  it("allows a BOM before @fluent-disable-sync-for-file", () => {
    expectValid(
      `\uFEFF// @fluent-disable-sync-for-file\nimport { Record } from "@servicenow/sdk/core";\n`,
      NOW,
    );
  });
});
