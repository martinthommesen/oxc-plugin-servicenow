import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["update-incident"],
  table: "incident",
  name: "Update",
});

// @fluent-ignore
