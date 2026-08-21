import { ruleDocsUrl } from "../constants.js";
import { unsupportedConstructorRule } from "./unsupported-constructor-rule.js";

export const noWeakCollections = unsupportedConstructorRule({
  description:
    "Disallow WeakMap and WeakSet in Compatibility and ES5 ServiceNow scripts. ES2021 supports both.",
  url: ruleDocsUrl("no-weak-collections"),
  message:
    "`{{name}}` is not supported in Compatibility or ES5 Standards mode. Use `Map` or `Set`.",
  features: { WeakMap: "weak-map", WeakSet: "weak-set" },
});
