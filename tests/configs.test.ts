import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendedOxfmtConfig } from "../src/oxfmt/index.js";
import { recommendedRules, securityRules, strictRules } from "../src/configs/maps.js";

describe("configs", () => {
  it("recommended enables the core classic + Fluent rules", () => {
    assert.equal(recommendedRules["servicenow/no-hardcoded-sysid"], "error");
    assert.equal(recommendedRules["servicenow/require-fluent-id"], "error");
    assert.equal(recommendedRules["servicenow/require-query-before-next"], "error");
    assert.equal(recommendedRules["servicenow/no-unsupported-syntax"], undefined);
    assert.equal(recommendedRules["servicenow/no-sync-glideajax"], "error");
    assert.equal(recommendedRules["servicenow/no-delete-multiple-with-windowing"], "error");
    assert.equal(recommendedRules["servicenow/require-callback-for-getreference"], "error");
    assert.equal(recommendedRules["servicenow/require-glideajax-sysparm-name"], "error");
    assert.equal(recommendedRules["servicenow/validate-glideaggregate-calls"], "error");
    assert.equal(recommendedRules["servicenow/no-now-id-as-reference"], "error");
    assert.equal(recommendedRules["servicenow/no-glideajax-getanswer"], "error");
    assert.equal(recommendedRules["servicenow/no-duplicate-fluent-id"], "error");
    assert.equal(recommendedRules["servicenow/no-glideelement-in-collection"], "error");
    assert.equal(recommendedRules["servicenow/no-gliderecord-query-modifier-after-query"], "error");
    assert.equal(recommendedRules["servicenow/require-business-rule-wrapper"], "error");
    assert.equal(recommendedRules["servicenow/no-unfiltered-gliderecord-bulk-operation"], "warn");
    assert.equal(recommendedRules["servicenow/no-display-value-date-comparison"], undefined);
    assert.equal(recommendedRules["servicenow/no-gliderecord-query-in-loop"], undefined);
    assert.equal(recommendedRules["servicenow/no-system-query-bypass"], undefined);
    assert.equal(recommendedRules["servicenow/no-hardcoded-table-names"], undefined);
    assert.equal(recommendedRules["servicenow/validate-gliderecord-calls"], undefined);
  });

  it("strict adds optional rules", () => {
    assert.equal(strictRules["servicenow/no-hardcoded-table-names"], undefined);
    assert.equal(strictRules["servicenow/no-weak-references"], "error");
    assert.equal(strictRules["servicenow/prefer-now-include"], "warn");
    assert.equal(strictRules["servicenow/prefer-glideaggregate"], "warn");
    assert.equal(strictRules["servicenow/no-display-value-date-comparison"], "warn");
    assert.equal(strictRules["servicenow/no-gliderecord-query-in-loop"], "warn");
    assert.equal(strictRules["servicenow/no-system-query-bypass"], undefined);
  });

  it("security is opt-in and warn-only", () => {
    assert.equal(securityRules["servicenow/no-system-query-bypass"], "warn");
    assert.equal(recommendedRules["servicenow/no-system-query-bypass"], undefined);
  });

  it("oxfmt recommended has Fluent and classic overrides", () => {
    assert.equal(recommendedOxfmtConfig.singleQuote, true);
    assert.ok(recommendedOxfmtConfig.overrides.some((item) => item.files.includes("**/*.now.ts")));
    assert.ok(
      recommendedOxfmtConfig.overrides.some((item) =>
        item.files.some((file) => file.includes(".server.js")),
      ),
    );
    assert.ok(recommendedOxfmtConfig.ignorePatterns.includes("**/.now/**"));
  });
});
