import { definePlugin, eslintCompatPlugin } from "@oxlint/plugins";
import { recommended, recommendedRules } from "./configs/recommended.js";
import { strict, strictRules } from "./configs/strict.js";
import {
  acl,
  aclRules,
  businessRule,
  businessRuleRules,
  classicEs5,
  classicEs5Rules,
  client,
  clientRules,
  es2021,
  es2021Rules,
  fluent,
  fluentRules,
  policy,
  policyRules,
  security,
  securityRules,
} from "./configs/profiles.js";
import { PACKAGE_VERSION, PLUGIN_NAME } from "./constants.js";
import { ACL_FILE_GLOBS, BUSINESS_RULE_FILE_GLOBS, CLIENT_FILE_GLOBS } from "./context/filename.js";
import { rules } from "./rules/index.js";

const defined = definePlugin({
  meta: {
    name: PLUGIN_NAME,
  },
  rules,
});

/**
 * The published plugin.
 *
 * - oxlint reads `createOnce` directly (high-performance path).
 * - ESLint 9+ reads the `create` shim injected by `eslintCompatPlugin`.
 */
const plugin = eslintCompatPlugin(defined) as typeof defined & {
  configs: typeof configs;
  meta: { name: string; version: string };
};

// ESLint 10 defaults to JS/CJS/MJS only and would skip Fluent *.now.ts.
const ESLINT_FLAT_FILES = ["**/*.js", "**/*.cjs", "**/*.mjs", "**/*.now.ts", "**/*.now.tsx"];

function flatConfig(
  name: string,
  rulesMap: typeof recommendedRules,
  settings: Record<string, unknown> = {},
  files: readonly string[] = ESLINT_FLAT_FILES,
) {
  return {
    name: `${PLUGIN_NAME}/${name}`,
    files,
    plugins: { [PLUGIN_NAME]: plugin },
    settings: { servicenow: settings },
    rules: rulesMap,
  };
}

const CLASSIC_FILES = ["**/*.js", "**/*.cjs", "**/*.mjs"];
const FLUENT_FILES = ["**/*.now.ts", "**/*.now.tsx"];

export const configs = {
  recommended,
  strict,
  classicEs5,
  es2021,
  client,
  acl,
  businessRule,
  fluent,
  policy,
  security,
  recommendedRules,
  strictRules,
  classicEs5Rules,
  es2021Rules,
  clientRules,
  aclRules,
  businessRuleRules,
  fluentRules,
  policyRules,
  securityRules,
  /**
   * ESLint 9 flat-config objects. Spread into `export default [ ... ]`.
   */
  flat: {
    recommended: flatConfig("recommended", recommendedRules),
    strict: flatConfig("strict", strictRules),
    classicEs5: flatConfig(
      "classic-es5",
      classicEs5Rules,
      { authoring: "classic", javascriptMode: "es5", surfaces: "auto" },
      CLASSIC_FILES,
    ),
    es2021: flatConfig(
      "es2021",
      es2021Rules,
      { authoring: "classic", javascriptMode: "es2021", surfaces: "auto" },
      CLASSIC_FILES,
    ),
    client: flatConfig(
      "client",
      clientRules,
      { authoring: "classic", surfaces: ["client"] },
      CLIENT_FILE_GLOBS,
    ),
    acl: flatConfig("acl", aclRules, { authoring: "classic", surfaces: "auto" }, ACL_FILE_GLOBS),
    businessRule: flatConfig(
      "business-rule",
      businessRuleRules,
      { authoring: "classic", surfaces: ["business-rule"] },
      BUSINESS_RULE_FILE_GLOBS,
    ),
    fluent: flatConfig("fluent", fluentRules, { authoring: "fluent" }, FLUENT_FILES),
  },
};

plugin.configs = configs;
plugin.meta = { name: PLUGIN_NAME, version: PACKAGE_VERSION };

export default plugin;
export { plugin };
export type {
  ReadonlyServiceNowSettings,
  RuleConfigMap,
  ServiceNowRelease,
  ServiceNowSettings,
} from "./types.js";
export type { RuleName } from "./rules/index.js";
