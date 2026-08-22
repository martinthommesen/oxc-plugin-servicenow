import { PLUGIN_NAME } from "../constants.js";
import {
  businessRuleRules,
  classicEs5Rules,
  clientRules,
  es2021Rules,
  fluentRules,
  policyRules,
  securityRules,
} from "./maps.js";

export {
  businessRuleRules,
  classicEs5Rules,
  clientRules,
  es2021Rules,
  fluentRules,
  policyRules,
  securityRules,
};

export const classicEs5 = {
  name: `${PLUGIN_NAME}/classic-es5`,
  rules: classicEs5Rules,
};

export const es2021 = {
  name: `${PLUGIN_NAME}/es2021`,
  rules: es2021Rules,
};

export const client = {
  name: `${PLUGIN_NAME}/client`,
  rules: clientRules,
};

export const businessRule = {
  name: `${PLUGIN_NAME}/business-rule`,
  rules: businessRuleRules,
};

export const fluent = {
  name: `${PLUGIN_NAME}/fluent`,
  rules: fluentRules,
};

export const policy = {
  name: `${PLUGIN_NAME}/policy`,
  rules: policyRules,
};

export const security = {
  name: `${PLUGIN_NAME}/security`,
  rules: securityRules,
};
