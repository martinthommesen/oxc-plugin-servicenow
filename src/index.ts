import { definePlugin, eslintCompatPlugin } from "@oxlint/plugins";
import { recommended, recommendedRules } from "./configs/recommended.js";
import { strict, strictRules } from "./configs/strict.js";
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

export const configs = {
  recommended,
  strict,
  recommendedRules,
  strictRules,
  /**
   * ESLint 9 flat-config objects. Spread into `export default [ ... ]`.
   *
   * @example
   * ```js
   * import servicenow from "oxc-plugin-servicenow";
   * export default [servicenow.configs.flat.recommended];
   * ```
   */
  flat: {
    recommended: {
      name: `${PLUGIN_NAME}/recommended`,
      plugins: { [PLUGIN_NAME]: plugin },
      rules: recommendedRules,
    },
    strict: {
      name: `${PLUGIN_NAME}/strict`,
      plugins: { [PLUGIN_NAME]: plugin },
      rules: strictRules,
    },
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
export type { ServiceNowSettings, ScriptKind, RuleConfigMap } from "./types.js";
export type { RuleName } from "./rules/index.js";
export type { LintMessage, LintSourceOptions } from "./runtime/apply-rules.js";
