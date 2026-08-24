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
    assert.ok(
      ids(configs.flat.classicEs5, "var p = Promise.resolve(1);", "x.server.js").includes(
        "servicenow/no-promise",
      ),
    );
    assert.deepEqual(ids(configs.flat.classicEs5, "var p = Promise.resolve(1);", "x.now.ts"), []);
  });

  it("limits the client profile to client filenames and settings", () => {
    const scopedClient = {
      ...configs.flat.client,
      settings: {
        servicenow: {
          ...configs.flat.client.settings.servicenow,
          scope: "scoped",
        },
      },
    };
    for (const filename of [
      "x.client.js",
      "x.cs.cjs",
      "catalog-client.mjs",
      "sys_script_client_onchange.js",
      "approve.client.ui-action.js",
      "src/client/x.js",
    ]) {
      assert.ok(
        ids(scopedClient, 'var gr = new GlideRecord("incident");', filename).includes(
          "servicenow/no-client-gliderecord",
        ),
        filename,
      );
    }
    assert.deepEqual(
      ids(configs.flat.client, 'var gr = new GlideRecord("incident");', "x.client.js"),
      [],
      "the generic client profile must not guess application scope",
    );
    assert.deepEqual(ids(scopedClient, 'var gr = new GlideRecord("incident");', "x.server.js"), []);
  });

  it("limits the Business Rule profile to Business Rule files", () => {
    for (const filename of [
      "x.br.js",
      "incident.business-rule.cjs",
      "sys_script.mjs",
      "src/br/x.js",
    ]) {
      assert.ok(
        ids(configs.flat.businessRule, "current.update();", filename).includes(
          "servicenow/no-br-current-update",
        ),
        filename,
      );
    }
    assert.deepEqual(ids(configs.flat.businessRule, "current.update();", "x.server.js"), []);
    assert.deepEqual(ids(configs.flat.businessRule, "current.update();", "sys_script2.js"), []);
  });

  it("limits the ACL profile to ACL files and reviews proven queries", () => {
    const code = 'var user = new GlideRecord("sys_user"); user.query();';
    for (const filename of [
      "read.acl.js",
      "incident.access-control.cjs",
      "sys_security_acl_read.mjs",
      "src/access-controls/read.js",
    ]) {
      assert.ok(
        ids(configs.flat.acl, code, filename).includes("servicenow/no-gliderecord-query-in-acl"),
        filename,
      );
    }
    assert.deepEqual(ids(configs.flat.acl, code, "helper.server.js"), []);
  });

  it("supplies Fluent authoring for .now.ts", () => {
    assert.ok(
      ids(
        configs.flat.fluent,
        'import { BusinessRule } from "@servicenow/sdk/core"; BusinessRule({ table: "incident" });',
        "x.now.ts",
      ).includes("servicenow/require-fluent-id"),
    );
    assert.deepEqual(ids(configs.flat.fluent, "current.update();", "x.server.js"), []);
  });
});
