import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { recommendedOxfmtConfig } from "../src/oxfmt/index.js";
import { ruleCatalog } from "../src/catalog.js";
import {
  classicEs5Rules,
  es2021Rules,
  policyRules,
  recommendedRules,
  securityRules,
  strictRules,
} from "../src/configs/maps.js";

const presets110 = JSON.parse(
  readFileSync(new URL("fixtures/presets-1.1.0.json", import.meta.url), "utf8"),
) as {
  version: string;
  source: { commit: string; tree: string; presetSourceSha256: string; paths: string[] };
  recommended: Record<string, string>;
  strict: Record<string, string>;
};

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
    assert.equal(recommendedRules["servicenow/no-packages-calls"], undefined);
  });

  it("strict adds optional rules", () => {
    assert.equal(strictRules["servicenow/no-hardcoded-table-names"], undefined);
    assert.equal(strictRules["servicenow/no-weak-references"], "error");
    assert.equal(strictRules["servicenow/prefer-now-include"], "warn");
    assert.equal(strictRules["servicenow/prefer-glideaggregate"], "warn");
    assert.equal(strictRules["servicenow/no-display-value-date-comparison"], "warn");
    assert.equal(strictRules["servicenow/no-gliderecord-query-in-loop"], "warn");
    assert.equal(strictRules["servicenow/no-system-query-bypass"], undefined);
    assert.equal(strictRules["servicenow/no-packages-calls"], undefined);
    assert.equal(policyRules["servicenow/no-packages-calls"], "warn");
  });

  it("enables release-aware engine rules in both mode profiles", () => {
    for (const rules of [classicEs5Rules, es2021Rules]) {
      assert.equal(rules["servicenow/no-object-hasown"], "error");
      assert.equal(rules["servicenow/no-typed-arrays"], "error");
      assert.equal(rules["servicenow/no-unsupported-syntax"], "error");
    }
    assert.equal(recommendedRules["servicenow/no-object-hasown"], undefined);
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
    assert.ok(
      recommendedOxfmtConfig.overrides.some((item) =>
        ["**/*.ui-action.js", "**/*.client.ui-action.js", "**/*.server.ui-action.js"].every(
          (file) => item.files.includes(file),
        ),
      ),
    );
    assert.ok(recommendedOxfmtConfig.ignorePatterns.includes("**/.now/**"));
  });

  it("pins the immutable 1.1 preset source and documents every map difference", () => {
    const cwd = new URL("..", import.meta.url).pathname;
    const package110 = JSON.parse(
      execFileSync("git", ["show", `${presets110.source.commit}:package.json`], {
        cwd,
        encoding: "utf8",
      }),
    ) as { version: string };
    assert.equal(package110.version, presets110.version);
    assert.equal(
      execFileSync("git", ["show", "-s", "--format=%T", presets110.source.commit], {
        cwd,
        encoding: "utf8",
      }).trim(),
      presets110.source.tree,
    );
    const source = presets110.source.paths
      .map((file) =>
        execFileSync("git", ["show", `${presets110.source.commit}:${file}`], {
          cwd,
          encoding: "utf8",
        }),
      )
      .join("");
    assert.equal(
      createHash("sha256").update(source).digest("hex"),
      presets110.source.presetSourceSha256,
    );

    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    const table = readme.match(
      /<!-- generated:migration-1\.1-to-2\.0:start -->([\s\S]*?)<!-- generated:migration-1\.1-to-2\.0:end -->/,
    )?.[1];
    assert.ok(table);
    for (const [preset, oldMap, currentMap] of [
      ["recommended", presets110.recommended, recommendedRules],
      ["strict", presets110.strict, strictRules],
    ] as const) {
      for (const ruleId of new Set([...Object.keys(oldMap), ...Object.keys(currentMap)])) {
        if (oldMap[ruleId] === currentMap[ruleId]) continue;
        assert.ok(
          ruleCatalog.some((entry) => entry.ruleId === ruleId),
          `${ruleId} has no 2.0 catalog entry`,
        );
        assert.match(table, new RegExp("\\| `" + ruleId + "` \\| " + preset + " \\|"));
      }
    }
  });
});
