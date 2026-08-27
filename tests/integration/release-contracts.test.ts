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
const TYPED_ARRAY_FACTORY = `var values = Int8Array.from(source);`;
const HAS_OWN = `var owns = Object.hasOwn(record, "number");`;
const ERROR_IS_ERROR = `var isPlatformError = Error.isError(value);`;
const PROMISE_TRY = `var promise = Promise.try(load);`;
const PROMISE_WITH_RESOLVERS = `var deferred = Promise.withResolvers();`;
const BIGINT_AS_UINT_N = `var unsigned = BigInt.asUintN(64, -1n);`;
const ARRAY_FROM_PRIMITIVE_THIS = `var values = Array.from(source, function (value) { return value; }, null);`;
const ARRAY_FROM_OMITTED_THIS = `var values = Array.from(source, function (value) { return this.normalize(value); });`;
const BLOCK_FUNCTION_BEFORE_DECLARATION = `{
  var value = helper();
  function helper() { return 1; }
}`;
const MAP = `var cache = new Map();`;
const SET = `var seen = new Set();`;
const SET_UNION = `const values = new Set(left);
const alias = values;
var merged = alias["union"](right);`;
const SHORT_DATE_FRACTION = `var parsed = new Date("2025-05-07T09:05:20.78Z");`;
const SHORT_DATE_PARSE = `var parsed = Date.parse("2025-05-07T09:05:20.78Z");`;
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
    id: "zurich-typed-array-factory",
    filename: "zurich-typed-array-factory.server.js",
    code: TYPED_ARRAY_FACTORY,
    rule: "no-typed-arrays",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "factory",
  },
  {
    id: "australia-typed-array-factory",
    filename: "australia-typed-array-factory.server.js",
    code: TYPED_ARRAY_FACTORY,
    rule: "no-typed-arrays",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "omitted-release-typed-array-factory",
    filename: "omitted-typed-array-factory.server.js",
    code: TYPED_ARRAY_FACTORY,
    rule: "no-typed-arrays",
    settings: { javascriptMode: "es2021" },
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
    id: "zurich-error-iserror",
    filename: "zurich-error-iserror.server.js",
    code: ERROR_IS_ERROR,
    rule: "no-unsupported-static-methods",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "unsupported",
  },
  {
    id: "australia-error-iserror",
    filename: "australia-error-iserror.server.js",
    code: ERROR_IS_ERROR,
    rule: "no-unsupported-static-methods",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "omitted-release-error-iserror",
    filename: "omitted-error-iserror.server.js",
    code: ERROR_IS_ERROR,
    rule: "no-unsupported-static-methods",
    settings: { javascriptMode: "es2021" },
  },
  {
    id: "australia-es5-error-iserror",
    filename: "australia-es5-error-iserror.server.js",
    code: ERROR_IS_ERROR,
    rule: "no-unsupported-static-methods",
    settings: { release: "australia", javascriptMode: "es5" },
    messageId: "unsupported",
  },
  {
    id: "zurich-promise-try",
    filename: "zurich-promise-try.server.js",
    code: PROMISE_TRY,
    rule: "no-unsupported-static-methods",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "unsupported",
  },
  {
    id: "australia-promise-try",
    filename: "australia-promise-try.server.js",
    code: PROMISE_TRY,
    rule: "no-unsupported-static-methods",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "zurich-promise-withresolvers",
    filename: "zurich-promise-withresolvers.server.js",
    code: PROMISE_WITH_RESOLVERS,
    rule: "no-unsupported-static-methods",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "unsupported",
  },
  {
    id: "australia-promise-withresolvers",
    filename: "australia-promise-withresolvers.server.js",
    code: PROMISE_WITH_RESOLVERS,
    rule: "no-unsupported-static-methods",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "zurich-array-from-primitive-this",
    filename: "zurich-array-from-primitive-this.server.js",
    code: ARRAY_FROM_PRIMITIVE_THIS,
    rule: "no-incorrect-array-from-thisarg",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "primitive",
  },
  {
    id: "australia-array-from-primitive-this",
    filename: "australia-array-from-primitive-this.server.js",
    code: ARRAY_FROM_PRIMITIVE_THIS,
    rule: "no-incorrect-array-from-thisarg",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "omitted-release-array-from-primitive-this",
    filename: "omitted-array-from-primitive-this.server.js",
    code: ARRAY_FROM_PRIMITIVE_THIS,
    rule: "no-incorrect-array-from-thisarg",
    settings: { javascriptMode: "es2021" },
  },
  {
    id: "zurich-array-from-omitted-this",
    filename: "zurich-array-from-omitted-this.server.js",
    code: ARRAY_FROM_OMITTED_THIS,
    rule: "no-incorrect-array-from-thisarg",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "omitted",
  },
  {
    id: "australia-array-from-omitted-this",
    filename: "australia-array-from-omitted-this.server.js",
    code: ARRAY_FROM_OMITTED_THIS,
    rule: "no-incorrect-array-from-thisarg",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "omitted-release-array-from-omitted-this",
    filename: "omitted-array-from-omitted-this.server.js",
    code: ARRAY_FROM_OMITTED_THIS,
    rule: "no-incorrect-array-from-thisarg",
    settings: { javascriptMode: "es2021" },
  },
  {
    id: "zurich-es5-block-function-hoisting",
    filename: "zurich-es5-block-function-hoisting.server.js",
    code: BLOCK_FUNCTION_BEFORE_DECLARATION,
    rule: "no-unhoisted-block-function-use",
    settings: { release: "zurich", javascriptMode: "es5" },
    messageId: "unhoisted",
  },
  {
    id: "australia-es5-block-function-hoisting",
    filename: "australia-es5-block-function-hoisting.server.js",
    code: BLOCK_FUNCTION_BEFORE_DECLARATION,
    rule: "no-unhoisted-block-function-use",
    settings: { release: "australia", javascriptMode: "es5" },
  },
  {
    id: "zurich-es2021-block-function-hoisting",
    filename: "zurich-es2021-block-function-hoisting.server.js",
    code: BLOCK_FUNCTION_BEFORE_DECLARATION,
    rule: "no-unhoisted-block-function-use",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "unhoisted",
  },
  {
    id: "australia-es2021-block-function-hoisting",
    filename: "australia-es2021-block-function-hoisting.server.js",
    code: BLOCK_FUNCTION_BEFORE_DECLARATION,
    rule: "no-unhoisted-block-function-use",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "omitted-release-block-function-hoisting",
    filename: "omitted-release-block-function-hoisting.server.js",
    code: BLOCK_FUNCTION_BEFORE_DECLARATION,
    rule: "no-unhoisted-block-function-use",
    settings: { javascriptMode: "es2021" },
  },
  {
    id: "zurich-bigint-asuintn",
    filename: "zurich-bigint-asuintn.server.js",
    code: BIGINT_AS_UINT_N,
    rule: "no-incorrect-bigint-asuintn",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "incorrect",
  },
  {
    id: "australia-bigint-asuintn",
    filename: "australia-bigint-asuintn.server.js",
    code: BIGINT_AS_UINT_N,
    rule: "no-incorrect-bigint-asuintn",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "omitted-release-bigint-asuintn",
    filename: "omitted-bigint-asuintn.server.js",
    code: BIGINT_AS_UINT_N,
    rule: "no-incorrect-bigint-asuintn",
    settings: { javascriptMode: "es2021" },
  },
  {
    id: "zurich-es5-map",
    filename: "zurich-es5-map.server.js",
    code: MAP,
    rule: "no-map-set",
    settings: { release: "zurich", javascriptMode: "es5" },
    messageId: "unsupported",
  },
  {
    id: "australia-es5-set",
    filename: "australia-es5-set.server.js",
    code: SET,
    rule: "no-map-set",
    settings: { release: "australia", javascriptMode: "es5" },
    messageId: "unsupported",
  },
  {
    id: "omitted-release-es5-set",
    filename: "omitted-es5-set.server.js",
    code: SET,
    rule: "no-map-set",
    settings: { javascriptMode: "es5" },
    messageId: "unsupported",
  },
  {
    id: "australia-es2021-map",
    filename: "australia-es2021-map.server.js",
    code: MAP,
    rule: "no-map-set",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "zurich-set-union",
    filename: "zurich-set-union.server.js",
    code: SET_UNION,
    rule: "no-unsupported-set-methods",
    settings: { release: "zurich", javascriptMode: "es2021" },
    messageId: "unsupported",
  },
  {
    id: "australia-set-union",
    filename: "australia-set-union.server.js",
    code: SET_UNION,
    rule: "no-unsupported-set-methods",
    settings: { release: "australia", javascriptMode: "es2021" },
  },
  {
    id: "omitted-release-set-union",
    filename: "omitted-set-union.server.js",
    code: SET_UNION,
    rule: "no-unsupported-set-methods",
    settings: { javascriptMode: "es2021" },
  },
  {
    id: "zurich-short-date-fraction",
    filename: "zurich-date-fraction.server.js",
    code: SHORT_DATE_FRACTION,
    rule: "no-unsupported-date-fraction",
    settings: { release: "zurich", javascriptMode: "compatibility" },
    messageId: "unsupported",
  },
  {
    id: "australia-short-date-fraction",
    filename: "australia-date-fraction.server.js",
    code: SHORT_DATE_FRACTION,
    rule: "no-unsupported-date-fraction",
    settings: { release: "australia", javascriptMode: "compatibility" },
  },
  {
    id: "omitted-release-short-date-fraction",
    filename: "omitted-date-fraction.server.js",
    code: SHORT_DATE_FRACTION,
    rule: "no-unsupported-date-fraction",
    settings: { javascriptMode: "compatibility" },
  },
  {
    id: "zurich-short-date-parse",
    filename: "zurich-date-parse.server.js",
    code: SHORT_DATE_PARSE,
    rule: "no-unsupported-date-fraction",
    settings: { release: "zurich", javascriptMode: "compatibility" },
    messageId: "unsupported",
  },
  {
    id: "australia-short-date-parse",
    filename: "australia-date-parse.server.js",
    code: SHORT_DATE_PARSE,
    rule: "no-unsupported-date-fraction",
    settings: { release: "australia", javascriptMode: "compatibility" },
  },
  {
    id: "omitted-release-short-date-parse",
    filename: "omitted-date-parse.server.js",
    code: SHORT_DATE_PARSE,
    rule: "no-unsupported-date-fraction",
    settings: { javascriptMode: "compatibility" },
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
    id: "es5-promise-static-alias",
    filename: "es5-promise-alias.server.js",
    code: `const P = Promise;
P.resolve(1);`,
    rule: "no-promise",
    settings: { javascriptMode: "es5" },
    messageId: "staticMethod",
  },
  {
    id: "es5-proxy-revocable-alias",
    filename: "es5-proxy-alias.server.js",
    code: `const P = Proxy;
P.revocable(target, handler);`,
    rule: "no-proxy",
    settings: { javascriptMode: "es5" },
    messageId: "revocable",
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
        const oxlintPluginDiagnostics = oxlint.report.diagnostics.flatMap((diagnostic) => {
          const ruleId = pluginRuleId(diagnostic.code);
          return ruleId === undefined ? [] : [{ diagnostic, ruleId }];
        });
        const oxlintRules = oxlintPluginDiagnostics.map(({ ruleId }) => ruleId);

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
        assert.deepEqual(
          oxlintPluginDiagnostics.map(({ diagnostic }) => diagnostic.message),
          eslint.map((message) => message.message),
          `${contract.id}: Oxlint and ESLint must select the same message identity`,
        );
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
});
