import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import plugin, { configs } from "../src/index.js";
import * as publicApi from "../src/index.js";
import { ruleCatalog } from "../src/catalog.js";
import {
  DOCS_BASE_URL,
  PACKAGE_GIT_REF,
  PACKAGE_NAME,
  PACKAGE_VERSION,
  PLUGIN_NAME,
  REPOSITORY_URL,
} from "../src/constants.js";
import { rules } from "../src/rules/index.js";

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

  it("pins every rule document to the package release tag", () => {
    assert.equal(PACKAGE_GIT_REF, `v${PACKAGE_VERSION}`);
    assert.equal(DOCS_BASE_URL, `${REPOSITORY_URL}/blob/v${PACKAGE_VERSION}/docs/rules`);
    for (const entry of ruleCatalog) {
      const expected = `${DOCS_BASE_URL}/${entry.name}.md`;
      const rule = rules[entry.name] as { meta?: { docs?: { url?: string } } };
      assert.equal(entry.docsUrl, expected, entry.name);
      assert.equal(rule.meta?.docs?.url, expected, entry.name);
      assert.equal(entry.docsUrl.includes("/blob/main/"), false, entry.name);
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
      const implementation = rules[entry.name] as {
        meta?: { docs?: { recommended?: unknown } };
      };
      assert.equal(
        implementation.meta?.docs?.recommended,
        inRecommended,
        `${entry.name} meta.docs.recommended mismatch`,
      );
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

  it("the client flat config includes compound UI Action filenames", () => {
    assert.ok(configs.flat.client.files.includes("**/*.client.ui-action.js"));
  });

  it("the ACL flat config selects ACL names and preserves filename conflict checks", () => {
    assert.ok(configs.flat.acl.files.includes("**/{acl,*[-_.]acl}.{js,cjs,mjs}"));
    assert.ok(
      configs.flat.acl.files.includes(
        "**/{access.control,access.controls,*[-_.]access.control,*[-_.]access.controls}.{js,cjs,mjs}",
      ),
    );
    assert.equal(configs.flat.acl.settings.servicenow.surfaces, "auto");
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
      // The plugin reports diagnostics only. The test harness has no fix
      // application machinery (FINDINGS.md MNT-001), so a rule that starts
      // declaring fixable or hasSuggestions must bring that support back.
      assert.equal(entry.fixable, false, `${entry.name} declares an unsupported fix`);
      assert.equal(entry.hasSuggestions, false, `${entry.name} declares unsupported suggestions`);
    }
  });
});
