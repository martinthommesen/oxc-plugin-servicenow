import { PLUGIN_NAME } from "../constants.js";
import type { RuleConfigMap } from "../types.js";
import { recommendedRules } from "./recommended.js";

/** Everything in recommended, plus the noisy / optional rules at error. */
export const strictRules: RuleConfigMap = {
  ...recommendedRules,
  [`${PLUGIN_NAME}/prefer-glideaggregate`]: "error",
  [`${PLUGIN_NAME}/validate-gliderecord-calls`]: "error",
  [`${PLUGIN_NAME}/prefer-now-include`]: "error",
  [`${PLUGIN_NAME}/fluent-directives`]: "error",
  [`${PLUGIN_NAME}/fluent-naming-convention`]: "error",
  [`${PLUGIN_NAME}/no-complex-fluent-logic`]: "error",
  [`${PLUGIN_NAME}/no-at-method`]: "error",
  [`${PLUGIN_NAME}/no-hardcoded-table-names`]: "warn",
  [`${PLUGIN_NAME}/no-weak-references`]: "error",
  [`${PLUGIN_NAME}/no-async-iterators`]: "error",
};

export const strict = {
  name: `${PLUGIN_NAME}/strict`,
  rules: strictRules,
};
