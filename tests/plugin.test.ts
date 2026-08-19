import assert from "node:assert/strict";
import { describe, it } from "node:test";
import plugin, { configs, PACKAGE_NAME, PLUGIN_NAME, rules } from "../src/index.js";
import { ruleCatalog } from "../src/catalog.js";

describe("plugin export", () => {
  it("has the servicenow plugin name", () => {
    assert.equal(plugin.meta.name, PLUGIN_NAME);
    assert.equal(PACKAGE_NAME, "oxc-plugin-servicenow");
  });

  it("exports every catalogued rule", () => {
    for (const entry of ruleCatalog) {
      assert.ok(rules[entry.name], `missing rule ${entry.name}`);
    }
    assert.equal(Object.keys(rules).length, ruleCatalog.length);
  });

  it("every rule implements createOnce", () => {
    for (const [name, rule] of Object.entries(rules)) {
      const rec = rule as { createOnce?: unknown; create?: unknown; meta?: { docs?: { url?: string }; messages?: unknown } };
      assert.equal(typeof rec.createOnce, "function", `${name} should use createOnce`);
      assert.ok(rec.meta?.docs?.url, `${name} is missing docs.url`);
      assert.ok(rec.meta?.messages, `${name} is missing messages`);
    }
  });

  it("eslintCompatPlugin injected create() for ESLint", () => {
    for (const [name, rule] of Object.entries(rules)) {
      const rec = rule as { create?: unknown };
      assert.equal(typeof rec.create, "function", `${name} should have a create shim`);
    }
  });

  it("recommended is a subset of strict", () => {
    for (const key of Object.keys(configs.recommendedRules)) {
      assert.ok(key in configs.strictRules, `${key} missing from strict`);
    }
  });

  it("flat configs reference the plugin", () => {
    assert.equal(configs.flat.recommended.plugins.servicenow, plugin);
    assert.equal(configs.flat.strict.plugins.servicenow, plugin);
  });
});
