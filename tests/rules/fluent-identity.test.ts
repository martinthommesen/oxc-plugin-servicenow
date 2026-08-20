import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";
import { ServiceNowSettingsError, validateServiceNowSettings } from "../../src/settings/index.js";

const NOW = { filename: "file.now.ts" };

describe("fluentSdkVersion registry", () => {
  it("rejects an unsupported SDK version", () => {
    assert.throws(
      () => validateServiceNowSettings({ fluentSdkVersion: "9.9.9" }),
      (error: unknown) => error instanceof ServiceNowSettingsError && /unsupported Fluent SDK version/.test(error.message),
    );
  });

  it("keeps the published Table signature across 3.0.0 and 4.1.0", () => {
    const table = `import { Table } from "@servicenow/sdk/core";\nexport const incident = Table({ name: "x_acme_incident" });`;
    assertValid(table, "require-fluent-id", { ...NOW, settings: { fluentSdkVersion: "3.0.0" } });
    assertValid(table, "require-fluent-id", { ...NOW, settings: { fluentSdkVersion: "4.1.0" } });
  });

  it("respects capability introduction boundaries", () => {
    const alias = `import { AliasTemplate } from "@servicenow/sdk/core";\nAliasTemplate({ name: "template" });`;
    assertValid(alias, "require-fluent-id", { ...NOW, settings: { fluentSdkVersion: "4.1.0" } });
    assertInvalid(alias, "require-fluent-id", { messageId: "missing" }, { ...NOW, settings: { fluentSdkVersion: "4.8.0" } });
    assertInvalid(alias, "require-fluent-id", { messageId: "missing" }, { ...NOW, settings: { fluentSdkVersion: "4.11.0" } });

    const producer = `import { CatalogItemRecordProducer } from "@servicenow/sdk/core";\nCatalogItemRecordProducer({ name: "producer" });`;
    assertValid(producer, "require-fluent-id", { ...NOW, settings: { fluentSdkVersion: "4.1.0" } });
    assertInvalid(producer, "require-fluent-id", { messageId: "missing" }, { ...NOW, settings: { fluentSdkVersion: "4.8.0" } });
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
    assertValid(`const key = getKey();
const id = Now.ID[key];
BusinessRule({ $id: id, name: "dynamic" });`, "require-fluent-id", NOW);
  });

  it("ignores type-only Now.ID references", () => {
    assertValid(`const id = Now.ID["type-only"];
type IdType = typeof id;`, "no-now-id-as-reference", NOW);
  });

  it("does not exempt member assignment or object storage as an alias", () => {
    assertInvalid(`const config = {};
config.reference = Now.ID["reference"];`, "no-now-id-as-reference", { count: 1 }, NOW);
    assertInvalid(`const values = [Now.ID["stored"]];`, "no-now-id-as-reference", { count: 1 }, NOW);
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
