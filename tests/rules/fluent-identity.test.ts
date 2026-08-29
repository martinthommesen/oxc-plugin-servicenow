import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";
import { ServiceNowSettingsError, validateServiceNowSettings } from "../../src/settings/index.js";

const NOW = { filename: "file.now.ts" };

describe("fluentSdkVersion registry", () => {
  it("rejects an unsupported SDK version", () => {
    assert.throws(
      () => validateServiceNowSettings({ fluentSdkVersion: "9.9.9" }),
      (error: unknown) =>
        error instanceof ServiceNowSettingsError &&
        /unsupported Fluent SDK version/.test(error.message),
    );
  });

  it("accepts every reviewed exact patch and rejects unpublished patches", () => {
    assert.doesNotThrow(() => validateServiceNowSettings({ fluentSdkVersion: "3.0.3" }));
    assert.doesNotThrow(() => validateServiceNowSettings({ fluentSdkVersion: "4.9.1" }));
    assert.doesNotThrow(() => validateServiceNowSettings({ fluentSdkVersion: "4.10.1" }));
    assert.throws(
      () => validateServiceNowSettings({ fluentSdkVersion: "4.10.2" }),
      ServiceNowSettingsError,
    );
  });

  it("keeps the published Table signature across 3.0.0 and 4.1.0", () => {
    const table = `import { Table } from "@servicenow/sdk/core";\nexport const incident = Table({ name: "x_acme_incident" });`;
    assertValid(table, "require-fluent-id", { ...NOW, settings: { fluentSdkVersion: "3.0.0" } });
    assertValid(table, "require-fluent-id", { ...NOW, settings: { fluentSdkVersion: "4.1.0" } });
  });

  it("resolves aliases by execution order, not declaration order (FINDINGS.md COR-006)", () => {
    const V3 = { ...NOW, settings: { fluentSdkVersion: "3.0.0" } };
    const use = 'L({ table: "incident", columns: [], view: "Default" });';
    const head = 'import { List } from "@servicenow/sdk/core";\nlet L = List;';
    // Straight-line module code keeps positional resolution.
    assertInvalid(
      `${head}\n${use}\nL = console.log;`,
      "require-fluent-id",
      { messageId: "missing" },
      V3,
    );
    // A reassignment inside a hoisted function makes the alias uncertain in
    // both declaration orders: the function can run before the use.
    assertValid(
      `${head}\nmutate();\n${use}\nfunction mutate() { L = console.log; }`,
      "require-fluent-id",
      V3,
    );
    assertValid(
      `${head}\nfunction mutate() { L = console.log; }\nmutate();\n${use}`,
      "require-fluent-id",
      V3,
    );
    // A use inside a function cannot trust module-level reassignments.
    assertValid(
      `${head}\nfunction go() { ${use} }\nL = console.log;\ngo();`,
      "require-fluent-id",
      V3,
    );
  });

  it("applies repeated var declarators in execution order (FINDINGS.md COR-009)", () => {
    const head =
      'import { Record } from "@servicenow/sdk/core";\nimport { unrelated } from "other";';
    const use = 'F({ table: "incident", name: "Alias" });';
    // The later declarator rebinds away from the factory: no diagnostic.
    assertValid(`${head}\nvar F = Record;\nvar F = unrelated;\n${use}`, "require-fluent-id", NOW);
    // The later declarator rebinds to the factory: the call needs an $id.
    assertInvalid(
      `${head}\nvar F = unrelated;\nvar F = Record;\n${use}`,
      "require-fluent-id",
      { messageId: "missing" },
      NOW,
    );
    // Control: the plain-assignment spelling keeps its behaviour.
    assertValid(`${head}\nvar F = Record;\nF = unrelated;\n${use}`, "require-fluent-id", NOW);
    // A repeated declarator inside an if() makes the alias uncertain.
    assertValid(
      `${head}\nvar F = unrelated;\nif (flag) { var F = Record; }\n${use}`,
      "require-fluent-id",
      NOW,
    );
  });

  it("models the List ID transition from 3.0.0 to 4.1.0", () => {
    const list = `import { List } from "@servicenow/sdk/core";\nList({ table: "incident", columns: [], view: "Default" });`;
    assertInvalid(
      list,
      "require-fluent-id",
      { messageId: "missing" },
      { ...NOW, settings: { fluentSdkVersion: "3.0.0" } },
    );
    assertValid(list, "require-fluent-id", { ...NOW, settings: { fluentSdkVersion: "4.1.0" } });
  });

  it("respects capability introduction boundaries", () => {
    const alias = `import { AliasTemplate } from "@servicenow/sdk/core";\nAliasTemplate({ name: "template" });`;
    assertValid(alias, "require-fluent-id", { ...NOW, settings: { fluentSdkVersion: "4.1.0" } });
    assertInvalid(
      alias,
      "require-fluent-id",
      { messageId: "missing" },
      { ...NOW, settings: { fluentSdkVersion: "4.8.0" } },
    );
    assertInvalid(
      alias,
      "require-fluent-id",
      { messageId: "missing" },
      { ...NOW, settings: { fluentSdkVersion: "4.11.0" } },
    );

    const producer = `import { CatalogItemRecordProducer } from "@servicenow/sdk/core";\nCatalogItemRecordProducer({ name: "producer" });`;
    assertValid(producer, "require-fluent-id", { ...NOW, settings: { fluentSdkVersion: "4.1.0" } });
    assertInvalid(
      producer,
      "require-fluent-id",
      { messageId: "missing" },
      { ...NOW, settings: { fluentSdkVersion: "4.8.0" } },
    );
  });

  it("uses declaration-proven factory presence and absence", () => {
    const sla = `import { Sla } from "@servicenow/sdk/core";\nSla({ name: "Response" });`;
    assertValid(sla, "require-fluent-id", { ...NOW, settings: { fluentSdkVersion: "4.2.0" } });
    assertInvalid(
      sla,
      "require-fluent-id",
      { messageId: "missing" },
      { ...NOW, settings: { fluentSdkVersion: "4.3.0" } },
    );

    const graphql = `import { GraphQLApi } from "@servicenow/sdk/core";\nGraphQLApi({ name: "API" });`;
    assertValid(graphql, "require-fluent-id", { ...NOW, settings: { fluentSdkVersion: "4.10.1" } });
    assertInvalid(
      graphql,
      "require-fluent-id",
      { messageId: "missing" },
      { ...NOW, settings: { fluentSdkVersion: "4.11.0" } },
    );

    for (const phantom of ["DatabaseIndex", "Module", "ScriptedRestApi", "UiFormatter"]) {
      assertValid(
        `import { ${phantom} } from "@servicenow/sdk/core";\n${phantom}({ name: "local" });`,
        "require-fluent-id",
        NOW,
      );
    }
  });
});

describe("Fluent factory binding identity", () => {
  it("requires $id on an aliased import", () => {
    assertInvalid(
      `import { BusinessRule as BR } from "@servicenow/sdk/core";\nBR({ table: "incident", name: "Update" });`,
      "require-fluent-id",
      { messageId: "missing" },
      NOW,
    );
  });

  it("requires $id on a namespace import", () => {
    assertInvalid(
      `import * as core from "@servicenow/sdk/core";\ncore.BusinessRule({ table: "incident", name: "Update" });`,
      "require-fluent-id",
      { messageId: "missing" },
      NOW,
    );
  });

  it("ignores a local function with the same name", () => {
    assertValid(
      `function BusinessRule(config) { return config; }\nBusinessRule({ name: "Local helper" });`,
      "require-fluent-id",
      NOW,
    );
    assertValid(
      `function BusinessRule(config) { return config; }\nBusinessRule({ name: "Local helper" });`,
      "fluent-proper-imports",
      NOW,
    );
  });

  it("resolves mutable named aliases at each call", () => {
    assertInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let BR = BusinessRule;
BR({ name: "SDK" });
BR = function local(config) { return config; };
BR({ name: "local" });`,
      "require-fluent-id",
      { messageId: "missing", count: 1 },
      NOW,
    );
    assertInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let BR = function local(config) { return config; };
BR({ name: "local" });
BR = BusinessRule;
BR({ name: "SDK" });`,
      "require-fluent-id",
      { messageId: "missing", count: 1 },
      NOW,
    );
  });

  it("resolves mutable namespace aliases at each call", () => {
    assertInvalid(
      `import * as sdk from "@servicenow/sdk/core";
let alias = sdk;
alias.BusinessRule({ name: "SDK" });
alias = { BusinessRule(config) { return config; } };
alias.BusinessRule({ name: "local" });`,
      "require-fluent-id",
      { messageId: "missing", count: 1 },
      NOW,
    );
  });

  it("stays conservative after conditional alias writes", () => {
    assertValid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let BR = BusinessRule;
if (condition) BR = function local(config) { return config; };
BR({ name: "unknown" });`,
      "require-fluent-id",
      NOW,
    );
  });
});

describe("temporal Now.ID aliases", () => {
  it("keeps an earlier valid $id after later reassignment", () => {
    assertValid(
      `let id = Now.ID["user-information"];
VariableSet({ $id: id, title: "User information" });
id = "ordinary";`,
      "no-now-id-as-reference",
      NOW,
    );
  });

  it("does not reinterpret an earlier ordinary use", () => {
    assertValid(
      `let id = "ordinary";
consume({ reference: id });
id = Now.ID["user-information"];
VariableSet({ $id: id });`,
      "no-now-id-as-reference",
      NOW,
    );
  });

  it("keeps shadowed aliases independent", () => {
    assertValid(
      `const id = Now.ID["outer"];
function run() {
  const id = "ordinary";
  consume(id);
}
Record({ $id: id });`,
      "no-now-id-as-reference",
      NOW,
    );
  });

  it("ignores a local Now object", () => {
    assertValid(
      `import { BusinessRule } from "@servicenow/sdk/core";
const Now = { ID: { fake: "local" }, include: function (path) { return path; } };
BusinessRule({ $id: Now.ID.fake, script: Now.include("./not-sdk.js") });`,
      "no-now-id-as-reference",
      NOW,
    );
  });

  it("accepts immutable aliases of Now and Now.ID", () => {
    assertValid(
      `const SDK = Now;
const IDs = SDK.ID;
BusinessRule({ $id: IDs["aliased"] });`,
      "require-fluent-id",
      NOW,
    );
  });

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
  it("reports dynamic and non-lexical uses but accepts a dynamic $id", () => {
    const dynamic = `import { BusinessRule } from "@servicenow/sdk/core";
const key = getKey();
const config = {};
config.reference = Now.ID[key];
consume([Now.ID[key]]);
BusinessRule({ $id: Now.ID[key], name: "dynamic" });`;
    assertInvalid(dynamic, "no-now-id-as-reference", { count: 2 }, NOW);
    assertValid(
      `const key = getKey();
const id = Now.ID[key];
BusinessRule({ $id: id, name: "dynamic" });`,
      "require-fluent-id",
      NOW,
    );
  });

  it("ignores type-only Now.ID references", () => {
    assertValid(
      `const id = Now.ID["type-only"];
type IdType = typeof id;`,
      "no-now-id-as-reference",
      NOW,
    );
  });

  it("does not exempt member assignment or object storage as an alias", () => {
    assertInvalid(
      `const config = {};
config.reference = Now.ID["reference"];`,
      "no-now-id-as-reference",
      { count: 1 },
      NOW,
    );
    assertInvalid(
      `const values = [Now.ID["stored"]];`,
      "no-now-id-as-reference",
      { count: 1 },
      NOW,
    );
  });

  it("reports identity values in compound assignments", () => {
    assertInvalid(
      `let value = "";
value += Now.ID["append"];
value ||= Now.ID["fallback"];
const config = { $id: "raw" };
config.$id += Now.ID["compound-id"];`,
      "no-now-id-as-reference",
      { count: 3 },
      NOW,
    );
  });
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
  it("flags an end-of-file @fluent-ignore", () => {
    assertInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["x"], table: "incident" });\n// @fluent-ignore\n`,
      "fluent-directives",
      { messageId: "dangling" },
      NOW,
    );
  });

  it("allows a previous-line ignore before a statement", () => {
    assertValid(
      `// @fluent-ignore\nimport { BusinessRule } from "@servicenow/sdk/core";\n`,
      "fluent-directives",
      NOW,
    );
  });

  it("allows a BOM before @fluent-disable-sync-for-file", () => {
    assertValid(
      `\uFEFF// @fluent-disable-sync-for-file\nimport { Record } from "@servicenow/sdk/core";\n`,
      "fluent-directives",
      NOW,
    );
  });
});
