import { ruleDocsUrl } from "../constants.js";
import { unsupportedConstructorRule } from "./unsupported-constructor-rule.js";

export const noMapSet = unsupportedConstructorRule({
  description:
    "Disallow Map and Set in Compatibility and ES5 ServiceNow scripts. ES2021 supports both.",
  url: ruleDocsUrl("no-map-set"),
  message:
    "`{{name}}` is not supported in Compatibility or ES5 Standards mode. Use an ES5-compatible object or array representation.",
  messageId: "unsupported",
  features: { Map: "map", Set: "set" },
});
