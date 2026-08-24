import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ruleCatalog } from "../src/catalog.js";
import { AUSTRALIA_RULE_REVIEWS } from "../src/catalog-metadata.js";
import {
  businessRuleRules,
  classicEs5Rules,
  clientRules,
  es2021Rules,
  fluentRules,
  policyRules,
  recommendedRules,
  securityRules,
  strictRules,
} from "../src/configs/maps.js";
import { optionDocsFromDescriptor, schemaFromDescriptor } from "../src/options/index.js";
import { rules } from "../src/rules/index.js";
import { lint } from "./helpers/rule-tester.js";

const profileMaps = {
  recommended: recommendedRules,
  strict: strictRules,
  "classic-es5": classicEs5Rules,
  es2021: es2021Rules,
  client: clientRules,
  "business-rule": businessRuleRules,
  fluent: fluentRules,
  policy: policyRules,
  security: securityRules,
};

describe("catalog authority", () => {
  it("owns every unique implementation, name, rule ID, placement, and option descriptor", () => {
    assert.equal(new Set(ruleCatalog.map((entry) => entry.name)).size, ruleCatalog.length);
    assert.equal(new Set(ruleCatalog.map((entry) => entry.ruleId)).size, ruleCatalog.length);
    assert.equal(
      new Set(ruleCatalog.map((entry) => entry.implementation)).size,
      ruleCatalog.length,
    );
    assert.equal(Object.keys(rules).length, ruleCatalog.length);

    for (const entry of ruleCatalog) {
      assert.equal(rules[entry.name], entry.implementation, entry.name);
      assert.equal(
        new Set(entry.placements.map((item) => item.profile)).size,
        entry.placements.length,
      );
      for (const placement of entry.placements) {
        assert.equal(profileMaps[placement.profile][entry.ruleId], placement.severity);
      }
      if (!entry.optionDescriptor) {
        assert.deepEqual(entry.options, []);
        continue;
      }
      assert.equal(entry.optionDescriptor.ruleName, entry.name);
      assert.deepEqual(entry.options, optionDocsFromDescriptor(entry.optionDescriptor));
      assert.deepEqual(
        (entry.implementation.meta as { schema?: unknown } | undefined)?.schema,
        schemaFromDescriptor(entry.optionDescriptor),
      );
    }
  });

  it("has no independent rule metadata, placement, or option registry", () => {
    const sources = [
      "../src/catalog.ts",
      "../src/catalog-metadata.ts",
      "../src/options/descriptors.ts",
    ].map((file) => readFileSync(new URL(file, import.meta.url), "utf8"));
    assert.doesNotMatch(
      sources.join("\n"),
      /const EXTRA_PLACEMENTS|export const ruleDocMetadata|export const RULE_OPTION_DESCRIPTORS/,
    );
  });

  it("requires an explicit Australia review on the correct compatibility axis", () => {
    assert.deepEqual(
      Object.keys(AUSTRALIA_RULE_REVIEWS).sort(),
      ruleCatalog.map((entry) => entry.name).sort(),
    );
    for (const entry of ruleCatalog) {
      const review = AUSTRALIA_RULE_REVIEWS[entry.name];
      assert.ok(review, entry.name);
      if (entry.family === "fluent") {
        assert.deepEqual(entry.applicability.serviceNowReleases, []);
        assert.equal(review.status, "not-applicable");
      } else {
        assert.deepEqual(entry.applicability.serviceNowReleases, ["zurich", "australia"]);
        assert.ok(review.status === "reviewed" || review.status === "invariant");
      }
    }
  });

  it("executes every structured limitation case", () => {
    const caseIds = new Set<string>();
    for (const entry of ruleCatalog) {
      for (const limitation of entry.limitationCases) {
        assert.equal(caseIds.has(limitation.caseId), false, limitation.caseId);
        caseIds.add(limitation.caseId);
        const messages = lint(limitation.code, entry.name, {
          filename: limitation.filename ?? "test.js",
          settings: limitation.settings,
        });
        if (limitation.kind === "false-positive") {
          assert.ok(messages.length > 0, `${limitation.caseId} should report`);
        } else {
          assert.equal(
            messages.length,
            0,
            `${limitation.caseId} should stay silent: ${messages.map((item) => item.message).join("; ")}`,
          );
        }
      }
    }
    assert.ok(caseIds.size > 0);
  });
});

describe("rule catalog examples", () => {
  for (const entry of ruleCatalog) {
    describe(entry.name, () => {
      for (const example of entry.bad) {
        it(`flags: ${example.name}`, () => {
          const messages = lint(example.code, entry.name, {
            filename: example.filename ?? "test.js",
            settings: example.settings,
          });
          assert.ok(
            messages.length > 0,
            `catalog bad example "${example.name}" for ${entry.name} produced no diagnostics`,
          );
        });
      }

      for (const example of entry.good) {
        it(`allows: ${example.name}`, () => {
          const messages = lint(example.code, entry.name, {
            filename: example.filename ?? "test.js",
            settings: example.settings,
          });
          assert.equal(
            messages.length,
            0,
            `catalog good example "${example.name}" for ${entry.name} produced:\n${messages
              .map((message) => `  - ${message.messageId ?? "?"} ${message.message}`)
              .join("\n")}`,
          );
        });
      }
    });
  }
});
