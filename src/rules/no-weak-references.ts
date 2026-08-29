import { ruleDocsUrl } from "../constants.js";
import { unsupportedConstructorRule } from "./unsupported-constructor-rule.js";

export const noWeakReferences = unsupportedConstructorRule({
  description:
    "Disallow WeakRef and FinalizationRegistry in instance-executed ServiceNow scripts. Both remain disallowed in ES2021.",
  url: ruleDocsUrl("no-weak-references"),
  message:
    "`{{name}}` is disallowed on the ServiceNow JavaScript engine, including ES2021 mode. Use `Map` / `Set` only when those types are supported by the script mode.",
  features: { WeakRef: "weak-ref", FinalizationRegistry: "finalization-registry" },
});
