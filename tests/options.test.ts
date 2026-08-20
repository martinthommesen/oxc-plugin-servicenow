import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Linter } from "eslint";
import type { Linter as EsLinter } from "eslint";
import plugin, { configs, parseRuleOptions, RULE_OPTION_DESCRIPTORS, schemaFromDescriptor } from "../src/index.js";
import { ServiceNowConfigError } from "../src/settings/index.js";
import { lint } from "./helpers/rule-tester.js";

const SYS_ID = "97c04b3b1b12100043ab85e5bd0713e2";

describe("rule option descriptors", () => {
  it("derives host schema from each descriptor", () => {
    for (const [name, descriptor] of Object.entries(RULE_OPTION_DESCRIPTORS)) {
      const schema = schemaFromDescriptor(descriptor);
      const rule = plugin.rules[name as keyof typeof plugin.rules] as { meta?: { schema?: unknown } };
      assert.deepEqual(rule.meta?.schema, schema, `${name} schema drifted from descriptor`);
    }
  });

  it("accepts missing options and applies defaults", () => {
    const parsed = parseRuleOptions(RULE_OPTION_DESCRIPTORS["no-hardcoded-sysid"], []);
    assert.deepEqual(parsed.allowedSysIds, []);
    assert.equal(parsed.ignoreHashNames, true);
    assertValidSysIdHonor();
  });

  it("rejects a boolean string without coercion", () => {
    assert.throws(
      () =>
        parseRuleOptions(RULE_OPTION_DESCRIPTORS["no-hardcoded-sysid"], [{ ignoreHashNames: "false" }]),
      (error: unknown) =>
        error instanceof ServiceNowConfigError &&
        error.path === "options[0].ignoreHashNames" &&
        /boolean/.test(error.message),
    );
  });

  it("rejects spreading a string as allowedSysIds", () => {
    assert.throws(
      () => parseRuleOptions(RULE_OPTION_DESCRIPTORS["no-hardcoded-sysid"], [{ allowedSysIds: "abc" }]),
      /options\[0\]\.allowedSysIds: expected an array of strings, got string/,
    );
  });

  it("rejects a non-string array item with a complete path", () => {
    assert.throws(
      () =>
        parseRuleOptions(RULE_OPTION_DESCRIPTORS["no-hardcoded-sysid"], [
          { allowedSysIds: [SYS_ID, SYS_ID, 2] },
        ]),
      /options\[0\]\.allowedSysIds\[2\]: expected a string, got number/,
    );
  });

  it("rejects a numeric string for maxLines", () => {
    assert.throws(
      () => parseRuleOptions(RULE_OPTION_DESCRIPTORS["prefer-now-include"], [{ maxLines: "8" }]),
      /options\[0\]\.maxLines: expected an integer/,
    );
  });

  it("rejects maxLines below the documented minimum", () => {
    assert.throws(
      () => parseRuleOptions(RULE_OPTION_DESCRIPTORS["prefer-now-include"], [{ maxLines: 0 }]),
      /options\[0\]\.maxLines: expected an integer >= 1/,
    );
  });

  it("rejects allowedTables that are not an array", () => {
    assert.throws(
      () => parseRuleOptions(RULE_OPTION_DESCRIPTORS["no-hardcoded-table-names"], [{ allowedTables: 42 }]),
      /options\[0\]\.allowedTables: expected an array of strings, got number/,
    );
  });

  it("rejects an unknown key", () => {
    assert.throws(
      () => parseRuleOptions(RULE_OPTION_DESCRIPTORS["require-fluent-id"], [{ extra: true }]),
      /options\[0\]\.extra: unknown option/,
    );
  });

  it("rejects an invalid naming enum", () => {
    assert.throws(
      () =>
        parseRuleOptions(RULE_OPTION_DESCRIPTORS["fluent-naming-convention"], [{ idStyle: "PascalCase" }]),
      /options\[0\]\.idStyle: expected one of kebab-case, snake_case, either/,
    );
  });

  it("rejects a second positional option", () => {
    assert.throws(
      () => parseRuleOptions(RULE_OPTION_DESCRIPTORS["require-fluent-id"], [{ preferNowId: false }, true]),
      /options\[1\]: unexpected extra option value/,
    );
  });

  it("applyRules uses the same parser as the descriptor", () => {
    assert.throws(
      () =>
        lint(`var id = "${SYS_ID}";`, "no-hardcoded-sysid", {
          options: { "no-hardcoded-sysid": [{ ignoreHashNames: "false" }] },
        }),
      /options\[0\]\.ignoreHashNames/,
    );
    const messages = lint(`var id = "${SYS_ID}";`, "no-hardcoded-sysid", {
      options: { "no-hardcoded-sysid": [{ allowedSysIds: [SYS_ID], ignoreHashNames: true }] },
    });
    assert.equal(messages.length, 0);
  });

  it("ESLint host schema rejects invalid option types", () => {
    const linter = new Linter({ configType: "flat" });
    const config = [
      {
        ...configs.flat.recommended,
        rules: {
          "servicenow/no-hardcoded-sysid": ["error", { ignoreHashNames: "false" }],
        },
      } as unknown as EsLinter.Config,
    ];
    try {
      const messages = linter.verify(`var id = "${SYS_ID}";`, config, {
        filename: "incident.br.js",
      });
      assert.ok(
        messages.some(
          (message) =>
            message.fatal === true ||
            /ignoreHashNames|schema|Configuration|boolean/.test(message.message),
        ),
        `expected host schema rejection, got ${JSON.stringify(messages)}`,
      );
    } catch (error) {
      assert.match(String(error), /ignoreHashNames|boolean|schema|Configuration/);
    }
  });
});

function assertValidSysIdHonor(): void {
  const messages = lint(`var id = "${SYS_ID}";`, "no-hardcoded-sysid");
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.messageId, "hardcoded");
}
