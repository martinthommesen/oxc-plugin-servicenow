import { ruleCatalog, type RuleProfile } from "../catalog.js";
import type { RuleConfigMap } from "../types.js";

function collect(profile: RuleProfile): RuleConfigMap {
  const rules: RuleConfigMap = {};
  for (const entry of ruleCatalog) {
    for (const placement of entry.placements) {
      if (placement.profile === profile) {
        rules[entry.ruleId] = placement.severity;
      }
    }
  }
  return rules;
}

/**
 * High-confidence, context-neutral diagnostics.
 * Mode-specific engine bans are not included. Rules that need a surface skip
 * when that surface is unknown.
 *
 * Derived from `ruleCatalog` placements. Do not edit this map by hand.
 */
export const recommendedRules: RuleConfigMap = collect("recommended");

/** Compatibility / ES5 instance restrictions. */
export const classicEs5Rules: RuleConfigMap = collect("classic-es5");

/** Remaining platform restrictions after ES2021 is enabled. */
export const es2021Rules: RuleConfigMap = collect("es2021");

export const clientRules: RuleConfigMap = collect("client");

export const businessRuleRules: RuleConfigMap = collect("business-rule");

export const fluentRules: RuleConfigMap = collect("fluent");

/**
 * Strong but non-universal additions. Heuristic performance stays warn.
 * Subjective style stays warn. Engine bans are not forced to error here.
 */
export const strictRules: RuleConfigMap = {
  ...recommendedRules,
  ...collect("strict"),
};

/** Organizational policy. Not part of recommended or strict. */
export const policyRules: RuleConfigMap = collect("policy");

/** Privilege-sensitive APIs. Review diagnostics, not automatic bans. */
export const securityRules: RuleConfigMap = collect("security");
