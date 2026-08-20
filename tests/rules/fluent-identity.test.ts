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

  it("selects 3.0.0 Table $id requirements", () => {
    assertInvalid(
      `import { Table } from "@servicenow/sdk/core";\nexport const incident = Table({ name: "x_acme_incident" });`,
      "require-fluent-id",
      { messageId: "missing" },
      { ...NOW, settings: { fluentSdkVersion: "3.0.0" } },
    );
    assertValid(
      `import { Table } from "@servicenow/sdk/core";\nexport const incident = Table({ name: "x_acme_incident" });`,
      "require-fluent-id",
      { ...NOW, settings: { fluentSdkVersion: "4.1.0" } },
    );
  });

  it("does not treat CatalogItemRecordProducer as a 3.0.0 factory", () => {
    assertValid(
      `import { CatalogItemRecordProducer } from "@servicenow/sdk/core";\nCatalogItemRecordProducer({ name: "old" });`,
      "require-fluent-id",
      { ...NOW, settings: { fluentSdkVersion: "3.0.0" } },
    );
    assertInvalid(
      `import { CatalogItemRecordProducer } from "@servicenow/sdk/core";\nCatalogItemRecordProducer({ name: "current" });`,
      "require-fluent-id",
      { messageId: "missing" },
      { ...NOW, settings: { fluentSdkVersion: "4.1.0" } },
    );
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
