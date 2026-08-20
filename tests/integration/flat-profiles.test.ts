import assert from "node:assert/strict";
import { Linter } from "eslint";
import { describe, it } from "node:test";
import { configs } from "../../src/index.js";

function ids(config: unknown, code: string, filename: string): string[] {
  const linter = new Linter({ configType: "flat" });
  return linter
    .verify(code, [config as import("eslint").Linter.Config], { filename })
    .map((message) => message.ruleId)
    .filter((id): id is string => Boolean(id));
}

describe("ESLint flat profile context contracts", () => {
  it("supplies independent classic ES5 settings", () => {
    assert.ok(ids(configs.flat.classicEs5, "var p = Promise.resolve(1);", "x.server.js").includes("servicenow/no-promise"));
    assert.deepEqual(ids(configs.flat.classicEs5, "var p = Promise.resolve(1);", "x.now.ts"), []);
  });

  it("limits the client profile to client filenames and settings", () => {
    assert.ok(ids(configs.flat.client, 'var gr = new GlideRecord("incident");', "x.client.js").includes("servicenow/no-client-gliderecord"));
    assert.deepEqual(ids(configs.flat.client, 'var gr = new GlideRecord("incident");', "x.server.js"), []);
  });

  it("limits the Business Rule profile to Business Rule files", () => {
    assert.ok(ids(configs.flat.businessRule, "current.update();", "x.br.js").includes("servicenow/no-br-current-update"));
    assert.deepEqual(ids(configs.flat.businessRule, "current.update();", "x.server.js"), []);
  });

  it("supplies Fluent authoring for .now.ts", () => {
    assert.ok(ids(configs.flat.fluent, 'import { BusinessRule } from "@servicenow/sdk/core"; BusinessRule({ table: "incident" });', "x.now.ts").includes("servicenow/require-fluent-id"));
    assert.deepEqual(ids(configs.flat.fluent, "current.update();", "x.server.js"), []);
  });
});
