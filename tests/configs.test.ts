import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendedOxfmtConfig } from "../src/oxfmt/index.js";
import { recommendedRules } from "../src/configs/recommended.js";
import { strictRules } from "../src/configs/strict.js";

describe("configs", () => {
  it("recommended enables the core classic + Fluent rules", () => {
    assert.equal(recommendedRules["servicenow/no-hardcoded-sysid"], "error");
    assert.equal(recommendedRules["servicenow/require-fluent-id"], "error");
    assert.equal(recommendedRules["servicenow/no-unsupported-syntax"], "error");
    assert.equal(recommendedRules["servicenow/no-sync-glideajax"], "error");
    assert.equal(recommendedRules["servicenow/no-hardcoded-table-names"], undefined);
  });

  it("strict adds optional rules", () => {
    assert.equal(strictRules["servicenow/no-hardcoded-table-names"], "warn");
    assert.equal(strictRules["servicenow/no-weak-references"], "error");
    assert.equal(strictRules["servicenow/prefer-now-include"], "error");
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
