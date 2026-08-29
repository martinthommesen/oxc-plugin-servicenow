import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertInvalid, assertValid, lint } from "../helpers/rule-tester.js";

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

  it("does not rewrite a wrong-module import", () => {
    const messages = lint(
      `import { BusinessRule } from "@servicenow/sdk";`,
      "fluent-proper-imports",
      {
        filename: NOW,
      },
    );
    assert.ok(messages.length > 0);
  });

  it("allows a Fluent call above its hoisted import", () => {
    assertValid(
      'Table({ name: "x_a" });\nimport { Table } from "@servicenow/sdk/core";',
      "fluent-proper-imports",
      { filename: NOW },
    );
  });

  it("allows an aliased core import", () => {
    assertValid(
      `import { BusinessRule as BR } from "@servicenow/sdk/core";\nBR({ $id: Now.ID["x"], table: "incident" });`,
      "fluent-proper-imports",
      { filename: NOW },
    );
  });

  it("allows a namespace import from core", () => {
    assertValid(
      `import * as core from "@servicenow/sdk/core";\ncore.BusinessRule({ $id: Now.ID["x"], table: "incident" });`,
      "fluent-proper-imports",
      { filename: NOW },
    );
  });

  it("flags a namespace import from the wrong module", () => {
    assertInvalid(
      `import * as sdk from "@servicenow/sdk";\nsdk.BusinessRule({ $id: Now.ID["x"], table: "incident" });`,
      "fluent-proper-imports",
      { messageId: "wrongModule" },
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

  it("allows a temporal Now.ID alias as $id", () => {
    assertValid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let id = Now.ID["log-state"];
BusinessRule({ $id: id, table: "incident", name: "Log state" });
id = "later-reassignment";`,
      "require-fluent-id",
      { filename: NOW },
    );
  });

  it("flags a raw $id that is later assigned Now.ID", () => {
    assertInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let id = "raw-id";
BusinessRule({ $id: id, table: "incident", name: "Log state" });
id = Now.ID["log-state"];`,
      "require-fluent-id",
      { messageId: "preferNowId" },
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

  it("allows Now.include through an immutable Now alias", () => {
    assertValid(
      `import { BusinessRule } from "@servicenow/sdk/core";
const SDK = Now;
BusinessRule({ $id: SDK.ID["x"], script: (SDK.include("./x.server.js")) });`,
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

  it("flags a PascalCase key through a Now.ID alias", () => {
    assertInvalid(
      `const IDs = Now.ID;
BusinessRule({ $id: IDs["BadAliasKey"] });`,
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
    assertInvalid(
      `// @fluent-ignre\nexport const demo = 1;\n`,
      "fluent-directives",
      {
        messageId: "typo",
      },
      { filename: NOW },
    );
  });

  it("flags @ts-ignore", () => {
    assertInvalid(
      `// @ts-ignore\nexport const demo = 1;\n`,
      "fluent-directives",
      {
        messageId: "tsIgnore",
      },
      { filename: NOW },
    );
  });

  it("allows @fluent-disable-sync", () => {
    assertValid(
      `// @fluent-disable-sync\nimport { Record } from "@servicenow/sdk/core";\nRecord({ $id: Now.ID["x"], table: "incident", data: {} });\n`,
      "fluent-directives",
      { filename: NOW },
    );
  });

  it("allows @fluent-disable-sync-for-file on the first line", () => {
    assertValid(
      `// @fluent-disable-sync-for-file\nimport { Record } from "@servicenow/sdk/core";\nRecord({ $id: Now.ID["x"], table: "incident", data: {} });\n`,
      "fluent-directives",
      { filename: NOW },
    );
  });

  it("flags @fluent-disable-sync-for-file after the first line", () => {
    assertInvalid(
      `import { Record } from "@servicenow/sdk/core";\n// @fluent-disable-sync-for-file\nRecord({ $id: Now.ID["x"], table: "incident", data: {} });\n`,
      "fluent-directives",
      { messageId: "firstLine" },
      { filename: NOW },
    );
  });

  it("requires exact adjacency", () => {
    assertInvalid(
      `// @fluent-ignore\n\nexport const demo = 1;\n`,
      "fluent-directives",
      { messageId: "misplaced" },
      { filename: NOW },
    );
    assertInvalid(
      `// @fluent-disable-sync\n// unrelated\nexport const demo = 1;\n`,
      "fluent-directives",
      { messageId: "misplaced" },
      { filename: NOW },
    );
  });

  it("attaches inside nested statement lists", () => {
    assertValid(`function run() {\n  // @fluent-ignore\n  work();\n}\n`, "fluent-directives", {
      filename: NOW,
    });
    assertInvalid(
      `function run() {\n  // @fluent-ignore\n}\nwork();\n`,
      "fluent-directives",
      { messageId: "dangling" },
      { filename: NOW },
    );
  });

  it("handles one-line and multiline block comments", () => {
    assertValid(`/* @fluent-ignore */\nexport const demo = 1;\n`, "fluent-directives", {
      filename: NOW,
    });
    assertInvalid(
      `/* @fluent-ignore\n */\nexport const demo = 1;\n`,
      "fluent-directives",
      { messageId: "misplaced" },
      { filename: NOW },
    );
    const file = lint(
      `/* heading\n * @fluent-disable-sync-for-file\n */\nexport const demo = 1;\n`,
      "fluent-directives",
      { filename: NOW },
    );
    assert.equal(file[0]?.messageId, "firstLine");
    assert.deepEqual({ line: file[0]?.line, column: file[0]?.column }, { line: 2, column: 3 });
  });

  it("reports each directive at its exact occurrence", () => {
    const source = `\uFEFF  // @fluent-ignre @fluent-unknown\r\nexport const demo = 1;\r\n`;
    const messages = lint(source, "fluent-directives", { filename: NOW });
    assert.deepEqual(
      messages.map((message) => message.messageId),
      ["typo", "unknown"],
    );
    for (const [index, name] of ["@fluent-ignre", "@fluent-unknown"].entries()) {
      const start = source.indexOf(name);
      assert.deepEqual(
        {
          line: messages[index]?.line,
          column: messages[index]?.column,
          endLine: messages[index]?.endLine,
          endColumn: messages[index]?.endColumn,
        },
        { line: 1, column: start, endLine: 1, endColumn: start + name.length },
      );
    }
  });

  it("reports the exact TypeScript directive occurrence", () => {
    const message = lint(
      `  // note @ts-expect-error\nexport const demo = 1;\n`,
      "fluent-directives",
      {
        filename: NOW,
      },
    )[0];
    assert.deepEqual(
      {
        messageId: message?.messageId,
        line: message?.line,
        column: message?.column,
        endColumn: message?.endColumn,
      },
      { messageId: "tsIgnore", line: 1, column: 10, endColumn: 26 },
    );
  });
});
