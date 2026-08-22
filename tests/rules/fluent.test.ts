import { describe, it } from "node:test";
import { assertFix, assertInvalid, assertValid } from "../helpers/rule-tester.js";

const NOW = "file.now.ts";

describe("fluent-proper-imports", () => {
  it("flags imports from @servicenow/sdk", () => {
    assertInvalid(
      `import { BusinessRule } from "@servicenow/sdk";\nBusinessRule({ $id: Now.ID["x"], table: "incident" });`,
      "fluent-proper-imports",
      { messageId: "wrongModule" },
      { filename: NOW },
    );
  });

  it("flags a Fluent API used without an import", () => {
    assertInvalid(
      `BusinessRule({ $id: Now.ID["x"], table: "incident" });`,
      "fluent-proper-imports",
      { messageId: "missingCore" },
      { filename: NOW },
    );
  });

  it("allows @servicenow/sdk/core", () => {
    assertValid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["x"], table: "incident" });`,
      "fluent-proper-imports",
      { filename: NOW },
    );
  });

  it("ignores classic scripts", () => {
    assertValid(`BusinessRule({ table: "incident" });`, "fluent-proper-imports", {
      filename: "legacy.js",
    });
  });

  it("rewrites a wrong-module import to @servicenow/sdk/core", () => {
    assertFix(
      `import { BusinessRule } from "@servicenow/sdk";`,
      "fluent-proper-imports",
      `import { BusinessRule } from "@servicenow/sdk/core";`,
      { filename: NOW },
    );
  });

  it("allows a Fluent call above its hoisted import", () => {
    assertValid(
      'Table({ name: "x_a" });\nimport { Table } from "@servicenow/sdk/core";',
      "fluent-proper-imports",
      { filename: NOW },
    );
  });
});

describe("require-fluent-id", () => {
  it("flags a missing $id", () => {
    assertInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ table: "incident", name: "Log" });`,
      "require-fluent-id",
      { messageId: "missing" },
      { filename: NOW },
    );
  });

  it("flags a raw sys_id $id", () => {
    assertInvalid(
      `import { Record } from "@servicenow/sdk/core";\nRecord({ $id: "97c04b3b1b12100043ab85e5bd0713e2", table: "incident", data: {} });`,
      "require-fluent-id",
      { messageId: "rawSysId" },
      { filename: NOW },
    );
  });

  it("allows Now.ID", () => {
    assertValid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["log-state"], table: "incident" });`,
      "require-fluent-id",
      { filename: NOW },
    );
  });

  it("allows a quoted $id key", () => {
    assertValid(
      'import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ "$id": Now.ID["x"], table: "incident", name: "n" });',
      "require-fluent-id",
      { filename: NOW },
    );
  });
});

describe("prefer-now-include", () => {
  it("flags a large inline script", () => {
    const script = Array.from({ length: 10 }, (_, i) => `    gs.info(${i});`).join("\\n");
    assertInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["x"], script: \`${script}\` });`,
      "prefer-now-include",
      { messageId: "large" },
      { filename: NOW },
    );
  });

  it("allows Now.include", () => {
    assertValid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["x"], script: Now.include("./x.server.js") });`,
      "prefer-now-include",
      { filename: NOW },
    );
  });

  it("flags a large payload under a quoted script key", () => {
    const script = Array.from({ length: 10 }, (_, i) => `    gs.info(${i});`).join("\\n");
    assertInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["x"], "script": \`${script}\` });`,
      "prefer-now-include",
      { messageId: "large" },
      { filename: NOW },
    );
  });
});

describe("fluent-naming-convention", () => {
  it("flags a PascalCase filename", () => {
    assertInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["ok-id"] });`,
      "fluent-naming-convention",
      { messageId: "file" },
      { filename: "LogState.now.ts" },
    );
  });

  it("flags a PascalCase Now.ID key", () => {
    assertInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["LogState"] });`,
      "fluent-naming-convention",
      { messageId: "nowId" },
      { filename: "log-state.now.ts" },
    );
  });

  it("allows kebab-case", () => {
    assertValid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["log-state"] });`,
      "fluent-naming-convention",
      { filename: "log-state.now.ts" },
    );
  });
});

describe("no-complex-fluent-logic", () => {
  it("flags a for loop", () => {
    assertInvalid(
      `import { Record } from "@servicenow/sdk/core";\nfor (var i = 0; i < 3; i++) { Record({ $id: Now.ID["x"] }); }`,
      "no-complex-fluent-logic",
      { messageId: "banned" },
      { filename: NOW },
    );
  });

  it("allows declarative records", () => {
    assertValid(
      `import { Record } from "@servicenow/sdk/core";\nRecord({ $id: Now.ID["seed"], table: "incident", data: { short_description: "Seed" } });`,
      "no-complex-fluent-logic",
      { filename: NOW },
    );
  });
});

describe("fluent-directives", () => {
  it("flags a typo", () => {
    assertInvalid(`// @fluent-ignre\nexport const demo = 1;\n`, "fluent-directives", {
      messageId: "typo",
    }, { filename: NOW });
  });

  it("flags @ts-ignore", () => {
    assertInvalid(`// @ts-ignore\nexport const demo = 1;\n`, "fluent-directives", {
      messageId: "tsIgnore",
    }, { filename: NOW });
  });

  it("allows @fluent-disable-sync", () => {
    assertValid(
      `// @fluent-disable-sync\nimport { Record } from "@servicenow/sdk/core";\nRecord({ $id: Now.ID["x"], table: "incident", data: {} });\n`,
      "fluent-directives",
      { filename: NOW },
    );
  });

  it("requires the file-wide directive on line one", () => {
    assertInvalid(
      `import { Record } from "@servicenow/sdk/core";\n// @fluent-disable-sync-for-file\n`,
      "fluent-directives",
      { messageId: "misplaced" },
      { filename: NOW },
    );
  });
});
