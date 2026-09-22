import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["update-incident"],
  table: "incident",
  name: "Update",
});

{
  const Now = { ID: { fake: "local" } };
  const shadowed = Now.ID.fake;
  void shadowed;
}
