import { defineConfig } from "oxlint";
import { configs } from "oxc-plugin-servicenow";

export default defineConfig({
  jsPlugins: [{ name: "servicenow", specifier: "oxc-plugin-servicenow" }],
  settings: {
    servicenow: {
      scopePrefix: "x_acme",
    },
  },
  rules: configs.recommendedRules,
});
