import { BusinessRule } from "@servicenow/sdk/core";

let id = Now.ID["log-state"];
BusinessRule({
  $id: id,
  table: "incident",
  name: "Log state",
  when: "after",
  action: ["update"],
});
id = "later-reassignment";
