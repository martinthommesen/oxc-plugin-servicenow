import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { Linter } from "eslint";
import plugin from "../../src/index.js";
import type { ServiceNowSettings } from "../../src/types.js";
import { pluginRuleId, repoRoot, runOxlint } from "./helpers.js";

const fixtureDir = path.join(repoRoot, "tests/integration/context-fixtures");
const configDir = path.join(repoRoot, "tests/integration/context-configs");

type Expected = { ruleId: string; messageId: string; message: string };

const AUTO_RULES = {
  "servicenow/no-client-gliderecord": "error",
  "servicenow/no-gs-now": "error",
  "servicenow/no-promise": "error",
  "servicenow/no-system-query-bypass": "error",
  "servicenow/validate-gliderecord-calls": "error",
} as const;

const cases: Array<{
  name: string;
  fixture: string;
  config: string;
  settings: ServiceNowSettings;
  rules: Record<string, "error">;
  expected: Expected[];
}> = [
  {
    name: "unknown surface runs only the mode rule",
    fixture: "unknown.js",
    config: "auto-es5.oxlintrc.json",
    settings: { javascriptMode: "es5" },
    rules: AUTO_RULES,
    expected: [
      {
        ruleId: "servicenow/no-promise",
        messageId: "staticMethod",
        message:
          "`Promise.resolve()` is not supported in Compatibility or ES5 Standards mode. Use synchronous Glide APIs, or set `settings.servicenow.javascriptMode` to `es2021` when the script runs in that mode.",
      },
    ],
  },
  {
    name: "known server runs server contracts",
    fixture: "known.server.js",
    config: "auto-es5.oxlintrc.json",
    settings: { javascriptMode: "es5" },
    rules: AUTO_RULES,
    expected: [
      {
        ruleId: "servicenow/no-gs-now",
        messageId: "server",
        message:
          "`gs.now()` returns a display string in the session timezone and is easy to misuse. Prefer `new GlideDateTime()` when you need an object, or an explicit display-value API when you need a string.",
      },
      {
        ruleId: "servicenow/validate-gliderecord-calls",
        messageId: "unusedReturn",
        message:
          "The return value of `record.insert()` is ignored. Check `insert`, `update`, `get`, and `next`. Bulk methods such as `updateMultiple` and `deleteMultiple` are not flagged.",
      },
      {
        ruleId: "servicenow/no-system-query-bypass",
        messageId: "bypass",
        message:
          "`addSystemQuery()` bypasses query ACL enforcement. Keep it only when system-level access is intended, and document the reason in a disable comment.",
      },
      {
        ruleId: "servicenow/no-system-query-bypass",
        messageId: "possibleBypass",
        message:
          "Computed access on a GlideRecord can select a query ACL-bypass method. Use an explicit method and document system-level access.",
      },
    ],
  },
  {
    name: "known client runs client contracts",
    fixture: "known.client.js",
    config: "auto-es5.oxlintrc.json",
    settings: { javascriptMode: "es5" },
    rules: AUTO_RULES,
    expected: [
      {
        ruleId: "servicenow/no-client-gliderecord",
        messageId: "glideRecord",
        message:
          "Do not use `GlideRecord` in client scripts — it is slow, poorly supported, and often blocked. Call a Script Include via `GlideAjax`, a Scripted REST API, or use `g_form.getReference()`.",
      },
      {
        ruleId: "servicenow/no-client-gliderecord",
        messageId: "glideRecord",
        message:
          "Do not use `GlideRecord` in client scripts — it is slow, poorly supported, and often blocked. Call a Script Include via `GlideAjax`, a Scripted REST API, or use `g_form.getReference()`.",
      },
      {
        ruleId: "servicenow/no-client-gliderecord",
        messageId: "glideRecord",
        message:
          "Do not use `GlideRecord` in client scripts — it is slow, poorly supported, and often blocked. Call a Script Include via `GlideAjax`, a Scripted REST API, or use `g_form.getReference()`.",
      },
      {
        ruleId: "servicenow/no-gs-now",
        messageId: "client",
        message:
          "`gs.now()` has not been available in client scripts since London. Ask the server for a GlideDateTime display value.",
      },
    ],
  },
  {
    name: "mixed UI Action suppresses the file-wide client rule",
    fixture: "mixed.ui-action.js",
    config: "mixed.oxlintrc.json",
    settings: { authoring: "classic", surfaces: ["ui-action", "client", "server"] },
    rules: { "servicenow/no-client-gliderecord": "error" },
    expected: [],
  },
  {
    name: "canonical wrapper shares current provenance",
    fixture: "canonical.br.js",
    config: "wrapper.oxlintrc.json",
    settings: {
      authoring: "classic",
      surfaces: ["business-rule"],
      businessRuleSourceFormat: "full-script",
    },
    rules: {
      "servicenow/no-br-current-update": "error",
      "servicenow/require-business-rule-wrapper": "error",
    },
    expected: [
      {
        ruleId: "servicenow/no-br-current-update",
        messageId: "update",
        message:
          "Do not call `current.update()` in a Business Rule. Assign fields on `current` and let the platform save the record (use a *before* rule). Calling `update()` retriggers other Business Rules and can recurse.",
      },
    ],
  },
];

function sorted<T extends { ruleId: string; message: string }>(items: T[]): T[] {
  return items.sort((left, right) =>
    `${left.ruleId}\u0000${left.message}`.localeCompare(`${right.ruleId}\u0000${right.message}`),
  );
}

describe("real-host context contracts", () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      const file = path.join(fixtureDir, testCase.fixture);
      const code = readFileSync(file, "utf8");
      const oxlint = sorted(
        runOxlint(path.join(configDir, testCase.config), [file])
          .diagnostics.map((diagnostic) => ({
            ruleId: pluginRuleId(diagnostic.code),
            message: diagnostic.message,
          }))
          .filter((item): item is { ruleId: string; message: string } => Boolean(item.ruleId)),
      );
      assert.deepEqual(
        oxlint,
        sorted(testCase.expected.map(({ ruleId, message }) => ({ ruleId, message }))),
      );

      const linter = new Linter({ configType: "flat" });
      const eslint = sorted(
        linter
          .verify(
            code,
            [
              {
                files: ["**/*.js"],
                plugins: { servicenow: plugin as never },
                settings: { servicenow: testCase.settings },
                rules: testCase.rules,
              },
            ],
            { filename: testCase.fixture },
          )
          .filter((message) => message.ruleId?.startsWith("servicenow/"))
          .map((message) => ({
            ruleId: message.ruleId!,
            messageId: message.messageId!,
            message: message.message,
          })),
      );
      assert.deepEqual(eslint, sorted(testCase.expected.map((item) => ({ ...item }))));
    });
  }
});
