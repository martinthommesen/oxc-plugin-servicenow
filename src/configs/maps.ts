import { PLUGIN_NAME } from "../constants.js";
import type { RuleConfigMap } from "../types.js";

function id(name: string): string {
  return `${PLUGIN_NAME}/${name}`;
}

/**
 * High-confidence, context-neutral diagnostics.
 * Mode-specific engine bans are not included. Rules that need a surface skip
 * when that surface is unknown.
 */
export const recommendedRules: RuleConfigMap = {
  [id("no-hardcoded-sysid")]: "error",
  [id("no-packages-calls")]: "error",
  [id("no-gs-now")]: "error",
  [id("require-query-before-next")]: "error",
  [id("no-client-gliderecord")]: "error",
  [id("no-br-current-update")]: "error",
  [id("no-sync-glideajax")]: "error",
  [id("no-delete-multiple-with-windowing")]: "error",
  [id("require-callback-for-getreference")]: "error",
  [id("require-glideajax-sysparm-name")]: "error",
  [id("validate-glideaggregate-calls")]: "error",
  [id("no-now-id-as-reference")]: "error",
  [id("no-glideajax-getanswer")]: "error",
  [id("no-duplicate-fluent-id")]: "error",
  [id("no-async-iterators")]: "error",
  [id("no-weak-references")]: "error",
  [id("fluent-proper-imports")]: "error",
  [id("fluent-directives")]: "warn",
  [id("require-fluent-id")]: "error",
};

/** Compatibility / ES5 instance restrictions. */
export const classicEs5Rules: RuleConfigMap = {
  [id("no-promise")]: "error",
  [id("no-async-await")]: "error",
  [id("no-bigint")]: "error",
  [id("no-at-method")]: "error",
  [id("no-typed-arrays")]: "error",
  [id("no-proxy")]: "error",
  [id("no-weak-collections")]: "error",
  [id("no-unsupported-syntax")]: "error",
  [id("no-async-iterators")]: "error",
  [id("no-weak-references")]: "error",
};

/** Remaining platform restrictions after ES2021 is enabled. */
export const es2021Rules: RuleConfigMap = {
  [id("no-async-iterators")]: "error",
  [id("no-weak-references")]: "error",
  [id("no-typed-arrays")]: "error",
};

export const clientRules: RuleConfigMap = {
  [id("no-client-gliderecord")]: "error",
  [id("no-sync-glideajax")]: "error",
  [id("no-gs-now")]: "error",
  [id("require-callback-for-getreference")]: "error",
  [id("require-glideajax-sysparm-name")]: "error",
  [id("no-glideajax-getanswer")]: "error",
};

export const businessRuleRules: RuleConfigMap = {
  [id("no-br-current-update")]: "error",
  [id("require-query-before-next")]: "error",
  [id("no-delete-multiple-with-windowing")]: "error",
  [id("validate-glideaggregate-calls")]: "error",
};

export const fluentRules: RuleConfigMap = {
  [id("fluent-proper-imports")]: "error",
  [id("fluent-directives")]: "warn",
  [id("require-fluent-id")]: "error",
  [id("no-now-id-as-reference")]: "error",
  [id("no-duplicate-fluent-id")]: "error",
};

/**
 * Strong but non-universal additions. Heuristic performance stays warn.
 * Subjective style stays warn. Engine bans are not forced to error here.
 */
export const strictRules: RuleConfigMap = {
  ...recommendedRules,
  [id("prefer-glideaggregate")]: "warn",
  [id("prefer-now-include")]: "warn",
  [id("fluent-naming-convention")]: "warn",
};

/** Organizational policy. Not part of recommended or strict. */
export const policyRules: RuleConfigMap = {
  [id("no-hardcoded-table-names")]: "warn",
  [id("no-complex-fluent-logic")]: "warn",
};

/** Privilege-sensitive APIs. Empty until Phase 3 security rules land. */
export const securityRules: RuleConfigMap = {};
