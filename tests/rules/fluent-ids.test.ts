import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {} from "../helpers/rule-tester.js";

const NOW = { filename: "catalog.now.ts" };

describe("no-now-id-as-reference", () => {
  const { expectValid, expectInvalid, expectActive, expectSkipped } = ruleTester(
    "no-now-id-as-reference",
    {
      filename: "legacy.js",
    },
    { messageId: "asReference" },
  );

  it("allows a direct $id use", () =>
    void expectValid(
      `import { VariableSet } from "@servicenow/sdk/core";
VariableSet({ $id: Now.ID["user-information"], title: "User information" });`,
      NOW,
    ));

  it("allows a local object reference", () =>
    void expectValid(
      `import { CatalogItem, VariableSet } from "@servicenow/sdk/core";
const userInformation = VariableSet({
  $id: Now.ID["user-information"],
  title: "User information",
});
CatalogItem({
  $id: Now.ID["software-request"],
  variableSets: [{ variableSet: userInformation, order: 100 }],
});`,
      NOW,
    ));

  it("allows external Now.ref", () =>
    void expectValid(
      `import { CatalogItem } from "@servicenow/sdk/core";
CatalogItem({
  $id: Now.ID["software-request"],
  flow: Now.ref("sys_hub_flow", "existing-flow-id"),
});`,
      NOW,
    ));

  it("flags Now.ID in an arbitrary property and array", () =>
    void expectInvalid(
      `CatalogItem({
  $id: Now.ID["software-request"],
  variableSets: [{ variableSet: Now.ID["user-information"], order: 100 }],
});`,
      undefined,
      NOW,
    ));

  it("allows an ID constant used only for $id", () =>
    void expectValid(
      `const id = Now.ID["user-information"];
VariableSet({ $id: id, title: "User information" });`,
      NOW,
    ));

  it("flags an ID constant used for both $id and a reference", () =>
    void expectInvalid(
      `const id = Now.ID["user-information"];
VariableSet({ $id: id, title: "User information" });
CatalogItem({ $id: Now.ID["software-request"], variableSet: id });`,
      undefined,
      NOW,
    ));

  it("flags immutable namespace aliases used as references", () =>
    void expectInvalid(
      `const SDK = Now;
const IDs = SDK.ID;
const MoreIDs = IDs;
consume(SDK.ID["first"]);
consume(MoreIDs["second"]);`,
      { messageId: "asReference", count: 2 },
      NOW,
    ));

  it("accepts wrapped identity sinks", () =>
    void expectValid(
      `const id = (Now.ID["wrapped"] as unknown)!;
BusinessRule({ $id: (id satisfies unknown) });
const config = {};
config.$id = (id as unknown);`,
      NOW,
    ));

  it("accepts a directly wrapped identity sink", () =>
    void expectValid(`BusinessRule({ $id: (Now.ID["wrapped-direct"] as string)! });`, NOW));

  it("reports reading an identity on the left of a compound assignment", () =>
    void expectInvalid(
      `let id = Now.ID["compound-left"];
id += "suffix";`,
      undefined,
      NOW,
    ));

  it("flags nested metadata objects", () =>
    void expectInvalid(
      `Flow({
  $id: Now.ID["notify"],
  steps: [{ $id: Now.ID["step-one"], ref: Now.ID["step-two"] }],
});`,
      undefined,
      NOW,
    ));

  it("ignores a local Now binding", () =>
    void expectActive(
      `const Now = { ID: { x: "1" } };
const value = Now.ID["x"];
other({ ref: value });`,
      NOW,
    ));

  it("stays silent for a dynamic key used only as $id", () =>
    void expectActive(
      `const id = Now.ID[key];
Record({ $id: id });`,
      NOW,
    ));

  it("skips non-.now.ts files", () =>
    void expectSkipped(`CatalogItem({ variableSet: Now.ID["user-information"] });`));
});

describe("no-duplicate-fluent-id", () => {
  const { expectInvalid, expectValid, expectActive } = ruleTester(
    "no-duplicate-fluent-id",
    {},
    { messageId: "duplicate" },
  );

  it("flags duplicate top-level IDs", () =>
    void expectInvalid(`BusinessRule({ $id: Now.ID["update-assignment"], name: "Update assignment", table: "incident" });
BusinessRule({ $id: Now.ID["update-assignment"], name: "Notify assignment", table: "incident" });`));

  it("allows unique IDs", () =>
    void expectValid(`BusinessRule({ $id: Now.ID["update-assignment"], name: "Update assignment", table: "incident" });
BusinessRule({ $id: Now.ID["notify-assignment"], name: "Notify assignment", table: "incident" });`));

  it("flags duplicate nested Flow-step IDs", () =>
    void expectInvalid(`Flow({
  $id: Now.ID["notify"],
  steps: [
    { $id: Now.ID["step-one"], name: "A" },
    { $id: Now.ID["step-one"], name: "B" },
  ],
});`));

  it("does not count the same text outside $id", () =>
    void expectValid(`BusinessRule({ $id: Now.ID["update-assignment"], name: "update-assignment", table: "incident" });
const label = "update-assignment";`));

  it("stays silent for dynamic keys", () =>
    void expectActive(`BusinessRule({ $id: Now.ID[key], name: "A", table: "incident" });
BusinessRule({ $id: Now.ID[key], name: "B", table: "incident" });`));

  it("ignores a local Now binding", () =>
    void expectActive(`const Now = { ID: { x: "1" } };
BusinessRule({ $id: Now.ID["x"], name: "A" });
BusinessRule({ $id: Now.ID["x"], name: "B" });`));

  it("resolves ID constants", () =>
    void expectInvalid(`const id = Now.ID["shared"];
BusinessRule({ $id: id, name: "A", table: "incident" });
BusinessRule({ $id: id, name: "B", table: "incident" });`));

  it("counts directly wrapped identity sinks", () =>
    void expectInvalid(
      `BusinessRule({ $id: Now.ID["wrapped-shared"] as string });
BusinessRule({ $id: (Now.ID["wrapped-shared"] satisfies string)! });`,
      undefined,
      NOW,
    ));

  it("resolves duplicate keys through namespace aliases", () =>
    void expectInvalid(
      `const SDK = Now;
const IDs = SDK.ID;
const MoreIDs = IDs;
BusinessRule({ $id: SDK.ID["shared-alias"], name: "A" });
BusinessRule({ $id: MoreIDs["shared-alias"], name: "B" });`,
      undefined,
      NOW,
    ));

  it("ignores comments and strings", () => {
    expectActive(`BusinessRule({ $id: Now.ID["update-assignment"], name: "A", table: "incident" });
const note = 'Now.ID["update-assignment"]';
// $id: Now.ID["update-assignment"]`);
  });
});
