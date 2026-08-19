// @ts-nocheck fixture is linted, not compiled; @servicenow/sdk is not installed.
import { BusinessRule } from "@servicenow/sdk";

BusinessRule({
  table: "incident",
  name: "Log state",
});
