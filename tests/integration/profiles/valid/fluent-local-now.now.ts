import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["update-incident"],
  table: "incident",
  name: "Update",
});

{
  const Now = { ID: { fake: "local" } };
  const unused = Now.ID.fake;
}
