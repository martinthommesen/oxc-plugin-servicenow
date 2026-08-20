import { definePlugin, eslintCompatPlugin } from "@oxlint/plugins";
import { recommended, recommendedRules } from "./configs/recommended.js";
import { strict, strictRules } from "./configs/strict.js";
import {
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
import { PACKAGE_NAME, PACKAGE_VERSION, PLUGIN_NAME } from "./constants.js";
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
const ESLINT_FLAT_FILES = [
  "**/*.js",
  "**/*.cjs",
  "**/*.mjs",
  "**/*.now.ts",
  "**/*.now.tsx",
];

function flatConfig(name: string, rulesMap: typeof recommendedRules) {
  return {
    name: `${PLUGIN_NAME}/${name}`,
    files: ESLINT_FLAT_FILES,
    plugins: { [PLUGIN_NAME]: plugin },
    rules: rulesMap,
  };
}

export const configs = {
  recommended,
  strict,
  classicEs5,
  es2021,
  client,
  businessRule,
  fluent,
  policy,
  security,
  recommendedRules,
  strictRules,
  classicEs5Rules,
  es2021Rules,
  clientRules,
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
    classicEs5: flatConfig("classic-es5", classicEs5Rules),
    es2021: flatConfig("es2021", es2021Rules),
    client: flatConfig("client", clientRules),
    businessRule: flatConfig("business-rule", businessRuleRules),
    fluent: flatConfig("fluent", fluentRules),
  },
};

plugin.configs = configs;
plugin.meta = { name: PLUGIN_NAME, version: PACKAGE_VERSION };

export default plugin;
export { plugin, rules };
export { recommendedOxfmtConfig, recommended as oxfmtRecommended } from "./oxfmt/index.js";
export { applyRules } from "./runtime/apply-rules.js";
export { ruleCatalog } from "./catalog.js";
export { PACKAGE_NAME, PACKAGE_VERSION, PLUGIN_NAME } from "./constants.js";
export { getScriptContext, resolveScriptContext } from "./context/index.js";
export { validateServiceNowSettings, ServiceNowSettingsError, ServiceNowConfigError } from "./settings/index.js";
export {
  parseRuleOptions,
  schemaFromDescriptor,
  optionDocsFromDescriptor,
  RULE_OPTION_DESCRIPTORS,
} from "./options/index.js";
export {
  DEFAULT_FLUENT_MANIFEST,
  CURRENT_FLUENT_SDK_VERSION,
  SUPPORTED_FLUENT_SDK_VERSIONS,
  resolveFluentManifest,
} from "./fluent/index.js";
export { ENGINE_FEATURES } from "./engine/index.js";
export {
  GLIDE_API_RELEASE,
  GLIDE_RECORD_METHODS,
  GLIDE_SYSTEM_BYPASS_METHODS,
} from "./glide/index.js";
export type {
  ServiceNowSettings,
  ServiceNowScriptContext,
  ScriptKind,
  ScriptSurface,
  JavaScriptMode,
  BusinessRuleWhen,
  RuleConfigMap,
} from "./types.js";
export type { RuleName } from "./rules/index.js";
export type { LintMessage, LintSourceOptions } from "./runtime/apply-rules.js";
