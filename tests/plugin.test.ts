import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import plugin, { configs, PACKAGE_NAME, PACKAGE_VERSION, PLUGIN_NAME, rules } from "../src/index.js";
import { ruleCatalog } from "../src/catalog.js";
import { lint } from "./helpers/rule-tester.js";

describe("plugin export", () => {
  it("has the servicenow plugin name", () => {
    assert.equal(plugin.meta.name, PLUGIN_NAME);
    assert.equal(PACKAGE_NAME, "oxc-plugin-servicenow");
  });

  it("PACKAGE_VERSION matches package.json", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    };
    assert.equal(PACKAGE_VERSION, manifest.version);
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

  it("catalog fixable and hasSuggestions match rule meta and real output", () => {
    for (const entry of ruleCatalog) {
      const rec = rules[entry.name] as {
        meta?: { fixable?: string | boolean; hasSuggestions?: boolean };
      };
      assert.equal(Boolean(rec.meta?.fixable), entry.fixable, `${entry.name} fixable mismatch`);
      assert.equal(
        Boolean(rec.meta?.hasSuggestions),
        entry.hasSuggestions,
        `${entry.name} hasSuggestions mismatch`,
      );
      if (!entry.fixable && !entry.hasSuggestions) continue;

      let sawFix = false;
      let sawSuggestion = false;
      for (const example of entry.bad) {
        const messages = lint(example.code, entry.name, {
          filename: example.filename ?? "test.js",
        });
        if (messages.some((message) => message.fixedSource !== undefined)) sawFix = true;
        if (messages.some((message) => (message.suggestions?.length ?? 0) > 0)) {
          sawSuggestion = true;
        }
      }
      if (entry.fixable) {
        assert.ok(sawFix, `${entry.name} is fixable but no bad example produced fixedSource`);
      }
      if (entry.hasSuggestions) {
        assert.ok(
          sawSuggestion,
          `${entry.name} hasSuggestions but no bad example produced suggestions`,
        );
      }
    }
  });
});
