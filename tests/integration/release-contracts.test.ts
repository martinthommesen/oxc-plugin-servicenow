import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { Linter } from "eslint";
import plugin from "../../src/index.js";
import type { ServiceNowSettings } from "../../src/types.js";
import { pluginRuleId, repoRoot, runOxlintProcess } from "./helpers.js";

interface ReleaseContract {
  readonly id: string;
  readonly filename: string;
  readonly code: string;
  readonly rule: string;
  readonly settings: ServiceNowSettings;
  readonly messageId?: string;
}

const ENGINE = `var values = new BigInt64Array(4);`;
const ENGINE_FACTORY = `var values = BigInt64Array.from(source);`;
const HAS_OWN = `var owns = Object.hasOwn(record, "number");`;
const GUARDED_HAS_OWN = `var owns = Object.hasOwn && Object.hasOwn(record, "number");`;
const TAINTED_HAS_OWN = `Object.hasOwn(record, "number");
Object.hasOwn = polyfill;`;
const DATAVIEW_GETTER = `const view = new DataView(buffer);
const alias = view;
var value = alias["getBigInt64"](0);`;
const QUERY_NO_DOMAIN = `var record = new GlideRecord("incident");
record.queryNoDomain();
record.next();`;
const AUSTRALIA_METHOD_PROPERTY = `var methods = [];
var record = new GlideRecord("incident");
record.query();
while (record.next()) methods.push(record.getTableName);`;

const contracts: readonly ReleaseContract[] = [
  {
    id: "zurich-bigint64",
    filename: "zurich-bigint64.server.js",
    code: ENGINE,
    rule: "no-typed-arrays",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "bigintCtor",
  },
  {
    id: "australia-bigint64",
    filename: "australia-bigint64.server.js",
    code: ENGINE,
    rule: "no-typed-arrays",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "zurich-bigint64-factory",
    filename: "zurich-bigint64-factory.server.js",
    code: ENGINE_FACTORY,
    rule: "no-typed-arrays",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "factory",
  },
  {
    id: "australia-bigint64-factory",
    filename: "australia-bigint64-factory.server.js",
    code: ENGINE_FACTORY,
    rule: "no-typed-arrays",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "omitted-release-bigint64",
    filename: "omitted-release-bigint64.server.js",
    code: ENGINE,
    rule: "no-typed-arrays",
    settings: { javascriptMode: "es2021" },
  },
  {
    id: "zurich-object-hasown",
    filename: "zurich-object-hasown.server.js",
    code: HAS_OWN,
    rule: "no-object-hasown",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "unsupported",
  },
  {
    id: "australia-object-hasown",
    filename: "australia-object-hasown.server.js",
    code: HAS_OWN,
    rule: "no-object-hasown",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "zurich-guarded-object-hasown",
    filename: "zurich-guarded-object-hasown.server.js",
    code: GUARDED_HAS_OWN,
    rule: "no-object-hasown",
    settings: { release: "zurich", javascriptMode: "es2021" },
  },
  {
    id: "zurich-tainted-object-hasown",
    filename: "zurich-tainted-object-hasown.server.js",
    code: TAINTED_HAS_OWN,
    rule: "no-object-hasown",
    settings: { release: "zurich", javascriptMode: "es2021" },
  },
  {
    id: "australia-dataview-getter",
    filename: "australia-dataview-getter.server.js",
    code: DATAVIEW_GETTER,
    rule: "no-typed-arrays",
    settings: { release: "australia", javascriptMode: "es2021" },
    messageId: "bigintGetter",
  },
  {
    id: "omitted-release-private-instance",
    filename: "omitted-release-private.server.js",
    code: `class RecordState { #value = 1; }`,
    rule: "no-unsupported-syntax",
    settings: { javascriptMode: "es2021" },
    messageId: "privateInstance",
  },
  {
    id: "australia-global-query-no-domain",
    filename: "australia-global-query.server.js",
    code: QUERY_NO_DOMAIN,
    rule: "require-query-before-next",
    settings: { release: "australia", scope: "global" },
  },
  {
    id: "australia-scoped-query-no-domain",
    filename: "australia-scoped-query.server.js",
    code: QUERY_NO_DOMAIN,
    rule: "require-query-before-next",
    settings: { release: "australia", scope: "scoped" },
    messageId: "missingQuery",
  },
  {
    id: "australia-unknown-scope-query-no-domain",
    filename: "australia-unknown-query.server.js",
    code: QUERY_NO_DOMAIN,
    rule: "require-query-before-next",
    settings: { release: "australia", scope: "unknown" },
  },
  {
    id: "australia-documented-method-property",
    filename: "australia-method-property.server.js",
    code: AUSTRALIA_METHOD_PROPERTY,
    rule: "no-glideelement-in-collection",
    settings: { release: "australia", scope: "scoped" },
  },
  {
    id: "australia-sdk-4-4-fluent",
    filename: "australia-sdk-4-4.now.ts",
    code: `import { BusinessRule } from "@servicenow/sdk/core";
BusinessRule({ table: "incident", name: "Update" });`,
    rule: "require-fluent-id",
    settings: { release: "australia", fluentSdkVersion: "4.4.1" },
    messageId: "missing",
  },
];

describe("ServiceNow release contracts in real hosts", () => {
  for (const contract of contracts) {
    it(contract.id, () => {
      const directory = mkdtempSync(path.join(tmpdir(), "sn-release-host-"));
      const source = path.join(directory, contract.filename);
      const config = path.join(directory, ".oxlintrc.json");
      try {
        writeFileSync(source, contract.code);
        writeFileSync(
          config,
          JSON.stringify({
            jsPlugins: [{ name: "servicenow", specifier: path.join(repoRoot, "dist/index.js") }],
            settings: { servicenow: contract.settings },
            rules: { [`servicenow/${contract.rule}`]: "error" },
          }),
        );
        const oxlint = runOxlintProcess(config, [source]);
        assert.equal(oxlint.stderr, "");
        const oxlintRules = oxlint.report.diagnostics
          .map((diagnostic) => pluginRuleId(diagnostic.code))
          .filter((ruleId): ruleId is string => ruleId !== undefined);

        const linter = new Linter({ configType: "flat" });
        const eslint = linter.verify(
          contract.code,
          [
            {
              files: ["**/*.{js,ts}"],
              plugins: { servicenow: plugin as unknown as import("eslint").ESLint.Plugin },
              settings: { servicenow: contract.settings },
              rules: { [`servicenow/${contract.rule}`]: "error" },
            },
          ],
          { filename: contract.filename },
        );

        if (contract.messageId === undefined) {
          assert.deepEqual(oxlintRules, []);
          assert.deepEqual(eslint, []);
          assert.equal(oxlint.status, 0);
          return;
        }
        assert.deepEqual(oxlintRules, [`servicenow/${contract.rule}`]);
        assert.equal(oxlint.status, 1);
        assert.deepEqual(
          eslint.map((message) => ({ ruleId: message.ruleId, messageId: message.messageId })),
          [{ ruleId: `servicenow/${contract.rule}`, messageId: contract.messageId }],
        );
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
});
