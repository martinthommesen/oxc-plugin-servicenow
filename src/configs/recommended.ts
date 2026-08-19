import { PLUGIN_NAME } from "../constants.js";
import type { RuleConfigMap } from "../types.js";

/** oxlint / ESLint rule map for the recommended preset. */
export const recommendedRules: RuleConfigMap = {
  [`${PLUGIN_NAME}/no-hardcoded-sysid`]: "error",
  [`${PLUGIN_NAME}/no-promise`]: "error",
  [`${PLUGIN_NAME}/no-async-await`]: "error",
  [`${PLUGIN_NAME}/no-bigint`]: "error",
  [`${PLUGIN_NAME}/prefer-glideaggregate`]: "warn",
  [`${PLUGIN_NAME}/no-client-gliderecord`]: "error",
  [`${PLUGIN_NAME}/no-gs-now`]: "error",
  [`${PLUGIN_NAME}/validate-gliderecord-calls`]: "warn",
  [`${PLUGIN_NAME}/no-br-current-update`]: "error",
  [`${PLUGIN_NAME}/fluent-proper-imports`]: "error",
  [`${PLUGIN_NAME}/fluent-directives`]: "warn",
  [`${PLUGIN_NAME}/prefer-now-include`]: "warn",
  [`${PLUGIN_NAME}/require-fluent-id`]: "error",
  [`${PLUGIN_NAME}/fluent-naming-convention`]: "warn",
  [`${PLUGIN_NAME}/no-complex-fluent-logic`]: "warn",
  [`${PLUGIN_NAME}/no-at-method`]: "warn",
  [`${PLUGIN_NAME}/no-packages-calls`]: "error",
  [`${PLUGIN_NAME}/no-typed-arrays`]: "error",
  [`${PLUGIN_NAME}/no-proxy`]: "error",
  [`${PLUGIN_NAME}/no-unsupported-syntax`]: "error",
  [`${PLUGIN_NAME}/no-sync-glideajax`]: "error",
};

export const recommended = {
  name: `${PLUGIN_NAME}/recommended`,
  rules: recommendedRules,
};
