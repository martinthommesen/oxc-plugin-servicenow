import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const REF = "no-now-id-as-reference" as const;
const DUP = "no-duplicate-fluent-id" as const;
const NOW = { filename: "catalog.now.ts" };

describe("no-now-id-as-reference", () => {
  it("allows a direct $id use", () => {
    assertValid(
      `import { VariableSet } from "@servicenow/sdk/core";
VariableSet({ $id: Now.ID["user-information"], title: "User information" });`,
      REF,
      NOW,
    );
  });

  it("allows a local object reference", () => {
    assertValid(
      `import { CatalogItem, VariableSet } from "@servicenow/sdk/core";
const userInformation = VariableSet({
  $id: Now.ID["user-information"],
  title: "User information",
});
CatalogItem({
  $id: Now.ID["software-request"],
  variableSets: [{ variableSet: userInformation, order: 100 }],
});`,
      REF,
      NOW,
    );
  });

  it("allows external Now.ref", () => {
    assertValid(
      `import { CatalogItem } from "@servicenow/sdk/core";
CatalogItem({
  $id: Now.ID["software-request"],
  flow: Now.ref("sys_hub_flow", "existing-flow-id"),
});`,
      REF,
      NOW,
    );
  });

  it("flags Now.ID in an arbitrary property and array", () => {
    assertInvalid(
      `CatalogItem({
  $id: Now.ID["software-request"],
  variableSets: [{ variableSet: Now.ID["user-information"], order: 100 }],
});`,
      REF,
      { messageId: "asReference" },
      NOW,
    );
  });

  it("allows an ID constant used only for $id", () => {
    assertValid(
      `const id = Now.ID["user-information"];
VariableSet({ $id: id, title: "User information" });`,
      REF,
      NOW,
    );
  });

  it("flags an ID constant used for both $id and a reference", () => {
    assertInvalid(
      `const id = Now.ID["user-information"];
VariableSet({ $id: id, title: "User information" });
CatalogItem({ $id: Now.ID["software-request"], variableSet: id });`,
      REF,
      { messageId: "asReference" },
      NOW,
    );
  });

  it("flags immutable namespace aliases used as references", () => {
    assertInvalid(
      `const SDK = Now;
const IDs = SDK.ID;
const MoreIDs = IDs;
consume(SDK.ID["first"]);
consume(MoreIDs["second"]);`,
      REF,
      { messageId: "asReference", count: 2 },
      NOW,
    );
  });

  it("accepts wrapped identity sinks", () => {
    assertValid(
      `const id = (Now.ID["wrapped"] as unknown)!;
BusinessRule({ $id: (id satisfies unknown) });
const config = {};
config.$id = (id as unknown);`,
      REF,
      NOW,
    );
  });

  it("accepts a directly wrapped identity sink", () => {
    assertValid(`BusinessRule({ $id: (Now.ID["wrapped-direct"] as string)! });`, REF, NOW);
  });

  it("reports reading an identity on the left of a compound assignment", () => {
    assertInvalid(
      `let id = Now.ID["compound-left"];
id += "suffix";`,
      REF,
      { messageId: "asReference" },
      NOW,
    );
  });

  it("flags nested metadata objects", () => {
    assertInvalid(
      `Flow({
  $id: Now.ID["notify"],
  steps: [{ $id: Now.ID["step-one"], ref: Now.ID["step-two"] }],
});`,
      REF,
      { messageId: "asReference" },
      NOW,
    );
  });

  it("ignores a local Now binding", () => {
    assertValid(
      `const Now = { ID: { x: "1" } };
const value = Now.ID["x"];
other({ ref: value });`,
      REF,
      NOW,
    );
  });

  it("stays silent for a dynamic key used only as $id", () => {
    assertValid(
      `const id = Now.ID[key];
Record({ $id: id });`,
      REF,
      NOW,
    );
  });

  it("skips non-.now.ts files", () => {
    assertValid(`CatalogItem({ variableSet: Now.ID["user-information"] });`, REF, {
      filename: "legacy.js",
    });
  });
});

describe("no-duplicate-fluent-id", () => {
  it("flags duplicate top-level IDs", () => {
    assertInvalid(
      `BusinessRule({ $id: Now.ID["update-assignment"], name: "Update assignment", table: "incident" });
BusinessRule({ $id: Now.ID["update-assignment"], name: "Notify assignment", table: "incident" });`,
      DUP,
      { messageId: "duplicate" },
    );
  });

  it("allows unique IDs", () => {
    assertValid(
      `BusinessRule({ $id: Now.ID["update-assignment"], name: "Update assignment", table: "incident" });
BusinessRule({ $id: Now.ID["notify-assignment"], name: "Notify assignment", table: "incident" });`,
      DUP,
    );
  });

  it("flags duplicate nested Flow-step IDs", () => {
    assertInvalid(
      `Flow({
  $id: Now.ID["notify"],
  steps: [
    { $id: Now.ID["step-one"], name: "A" },
    { $id: Now.ID["step-one"], name: "B" },
  ],
});`,
      DUP,
      { messageId: "duplicate" },
    );
  });

  it("does not count the same text outside $id", () => {
    assertValid(
      `BusinessRule({ $id: Now.ID["update-assignment"], name: "update-assignment", table: "incident" });
const label = "update-assignment";`,
      DUP,
    );
  });

  it("stays silent for dynamic keys", () => {
    assertValid(
      `BusinessRule({ $id: Now.ID[key], name: "A", table: "incident" });
BusinessRule({ $id: Now.ID[key], name: "B", table: "incident" });`,
      DUP,
    );
  });

  it("ignores a local Now binding", () => {
    assertValid(
      `const Now = { ID: { x: "1" } };
BusinessRule({ $id: Now.ID["x"], name: "A" });
BusinessRule({ $id: Now.ID["x"], name: "B" });`,
      DUP,
    );
  });

  it("resolves ID constants", () => {
    assertInvalid(
      `const id = Now.ID["shared"];
BusinessRule({ $id: id, name: "A", table: "incident" });
BusinessRule({ $id: id, name: "B", table: "incident" });`,
      DUP,
      { messageId: "duplicate" },
    );
  });

  it("counts directly wrapped identity sinks", () => {
    assertInvalid(
      `BusinessRule({ $id: Now.ID["wrapped-shared"] as string });
BusinessRule({ $id: (Now.ID["wrapped-shared"] satisfies string)! });`,
      DUP,
      { messageId: "duplicate" },
      NOW,
    );
  });

  it("resolves duplicate keys through namespace aliases", () => {
    assertInvalid(
      `const SDK = Now;
const IDs = SDK.ID;
const MoreIDs = IDs;
BusinessRule({ $id: SDK.ID["shared-alias"], name: "A" });
BusinessRule({ $id: MoreIDs["shared-alias"], name: "B" });`,
      DUP,
      { messageId: "duplicate" },
      NOW,
    );
  });

  it("ignores comments and strings", () => {
    assertValid(
      `BusinessRule({ $id: Now.ID["update-assignment"], name: "A", table: "incident" });
const note = 'Now.ID["update-assignment"]';
// $id: Now.ID["update-assignment"]`,
      DUP,
    );
  });
});
