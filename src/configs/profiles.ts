import { PLUGIN_NAME } from "../constants.js";
import type { RuleConfigMap } from "../types.js";
import {
  aclRules,
  businessRuleRules,
  classicEs5Rules,
  clientRules,
  es2021Rules,
  fluentRules,
  policyRules,
  securityRules,
} from "./maps.js";

export {
  aclRules,
  businessRuleRules,
  classicEs5Rules,
  clientRules,
  es2021Rules,
  fluentRules,
  policyRules,
  securityRules,
};

function profile<N extends string>(name: N, rules: RuleConfigMap) {
  return { name: `${PLUGIN_NAME}/${name}`, rules };
}

export const classicEs5 = profile("classic-es5", classicEs5Rules);

export const es2021 = profile("es2021", es2021Rules);

export const client = profile("client", clientRules);

export const acl = profile("acl", aclRules);

export const businessRule = profile("business-rule", businessRuleRules);

export const fluent = profile("fluent", fluentRules);

export const policy = profile("policy", policyRules);

export const security = profile("security", securityRules);
