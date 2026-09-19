import type { Rule } from "@oxlint/plugins";
import { ruleImplementations, type RuleName } from "../catalog.js";

export type { RuleName };

/**
 * Rule registry derived from `ruleCatalog`. Do not add exports here.
 * Add the implementation file and one catalog descriptor instead.
 */
export const rules = Object.fromEntries(
  ruleImplementations.map((entry) => [entry.name, entry.implementation]),
) as { [K in RuleName]: Rule };
