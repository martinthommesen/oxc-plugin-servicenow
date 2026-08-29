import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import plugin, { configs } from "../src/index.js";
import * as publicApi from "../src/index.js";
import { ruleCatalog } from "../src/catalog.js";
import { PACKAGE_NAME, PACKAGE_VERSION, PLUGIN_NAME } from "../src/constants.js";
import { rules } from "../src/rules/index.js";
import { lint } from "./helpers/rule-tester.js";

describe("plugin export", () => {
  it("exports only the supported runtime API", () => {
    assert.deepEqual(Object.keys(publicApi).sort(), ["configs", "default", "plugin"]);
  });

  it("has the servicenow plugin name", () => {
    assert.equal(plugin.meta.name, PLUGIN_NAME);
    assert.equal(PACKAGE_NAME, "oxc-plugin-servicenow");
  });

  it("PACKAGE_VERSION matches package.json", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
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
      const rec = rule as {
        createOnce?: unknown;
        create?: unknown;
        meta?: { docs?: { url?: string }; messages?: unknown };
      };
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

  it("catalog preset metadata matches exported maps", () => {
    for (const entry of ruleCatalog) {
      const inRecommended = entry.ruleId in configs.recommendedRules;
      const inClassicEs5 = entry.ruleId in configs.classicEs5Rules;
      const inEs2021 = entry.ruleId in configs.es2021Rules;
      if (entry.preset === "recommended") {
        assert.ok(inRecommended, `${entry.name} is catalogued as recommended`);
      }
      if (entry.preset === "classic-es5") {
        assert.ok(inClassicEs5, `${entry.name} is catalogued as classic-es5`);
      }
      if (entry.preset === "es2021") {
        assert.ok(inEs2021, `${entry.name} is catalogued as es2021`);
      }
      if (entry.preset === "strict") {
        assert.ok(entry.ruleId in configs.strictRules, `${entry.name} is catalogued as strict`);
        assert.equal(inRecommended, false, `${entry.name} should not be in recommended`);
      }
      if (entry.preset === false) {
        assert.equal(inRecommended, false, `${entry.name} should stay off recommended`);
      }
      for (const placement of entry.placements) {
        if (placement.profile === "recommended") {
          assert.equal(configs.recommendedRules[entry.ruleId], placement.severity);
        }
        if (placement.profile === "security") {
          assert.equal(configs.securityRules[entry.ruleId], placement.severity);
        }
        if (placement.profile === "policy") {
          assert.equal(configs.policyRules[entry.ruleId], placement.severity);
        }
      }
    }
  });

  it("flat configs reference the plugin", () => {
    assert.equal(configs.flat.recommended.plugins.servicenow, plugin);
    assert.equal(configs.flat.strict.plugins.servicenow, plugin);
  });

  it("flat configs apply to JavaScript and Fluent TypeScript", () => {
    for (const config of [configs.flat.recommended, configs.flat.strict]) {
      assert.ok(config.files.includes("**/*.js"), `${config.name} missing **/*.js`);
      assert.ok(config.files.includes("**/*.now.ts"), `${config.name} missing **/*.now.ts`);
      assert.ok(!config.files.includes("**/*.ts"), `${config.name} should not include **/*.ts`);
    }
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
          settings: example.settings,
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
