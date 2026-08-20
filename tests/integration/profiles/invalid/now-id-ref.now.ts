import { CatalogItem, VariableSet } from "@servicenow/sdk/core";

VariableSet({
  $id: Now.ID["user-information"],
  title: "User information",
});

CatalogItem({
  $id: Now.ID["software-request"],
  variableSets: [{ variableSet: Now.ID["user-information"], order: 100 }],
});
