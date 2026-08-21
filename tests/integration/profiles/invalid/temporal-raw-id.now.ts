import { BusinessRule } from "@servicenow/sdk/core";

let id = "raw-id";
BusinessRule({
  $id: id,
  table: "incident",
  name: "Log state",
  when: "after",
  action: ["update"],
});
id = Now.ID["log-state"];
