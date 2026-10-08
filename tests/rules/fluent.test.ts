import { ruleTester } from "../helpers/rule-tester.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertInvalid, lint } from "../helpers/rule-tester.js";

const NOW = "file.now.ts";

describe("fluent-proper-imports", () => {
  const { expectInvalid, expectValid, expectSkipped } = ruleTester(
    "fluent-proper-imports",
    {
      filename: "legacy.js",
    },
    { messageId: "wrongModule" },
  );

  it("flags imports from @servicenow/sdk", () =>
    void expectInvalid(
      `import { BusinessRule } from "@servicenow/sdk";\nBusinessRule({ $id: Now.ID["x"], table: "incident" });`,
      undefined,
      { filename: NOW },
    ));

  it("flags a Fluent API used without an import", () =>
    void expectInvalid(
      `BusinessRule({ $id: Now.ID["x"], table: "incident" });`,
      { messageId: "missingCore" },
      { filename: NOW },
    ));

  it("allows @servicenow/sdk/core", () =>
    void expectValid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["x"], table: "incident" });`,
      { filename: NOW },
    ));

  it("ignores classic scripts", () => void expectSkipped(`BusinessRule({ table: "incident" });`));

  it("allows a Fluent call above its hoisted import", () =>
    void expectValid('Table({ name: "x_a" });\nimport { Table } from "@servicenow/sdk/core";', {
      filename: NOW,
    }));

  it("allows an aliased core import", () =>
    void expectValid(
      `import { BusinessRule as BR } from "@servicenow/sdk/core";\nBR({ $id: Now.ID["x"], table: "incident" });`,
      { filename: NOW },
    ));

  it("allows a namespace import from core", () =>
    void expectValid(
      `import * as core from "@servicenow/sdk/core";\ncore.BusinessRule({ $id: Now.ID["x"], table: "incident" });`,
      { filename: NOW },
    ));

  it("flags a namespace import from the wrong module", () =>
    void expectInvalid(
      `import * as sdk from "@servicenow/sdk";\nsdk.BusinessRule({ $id: Now.ID["x"], table: "incident" });`,
      undefined,
      { filename: NOW },
    ));
});

describe("require-fluent-id", () => {
  const { expectInvalid, expectValid } = ruleTester(
    "require-fluent-id",
    {},
    { messageId: "missing" },
  );

  it("flags a missing $id", () =>
    void expectInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ table: "incident", name: "Log" });`,
      undefined,
      { filename: NOW },
    ));

  it("flags a raw sys_id $id", () =>
    void expectInvalid(
      `import { Record } from "@servicenow/sdk/core";\nRecord({ $id: "97c04b3b1b12100043ab85e5bd0713e2", table: "incident", data: {} });`,
      { messageId: "rawSysId" },
      { filename: NOW },
    ));

  it("allows Now.ID", () =>
    void expectValid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["log-state"], table: "incident" });`,
      { filename: NOW },
    ));

  it("allows a quoted $id key", () =>
    void expectValid(
      'import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ "$id": Now.ID["x"], table: "incident", name: "n" });',
      { filename: NOW },
    ));

  it("allows a temporal Now.ID alias as $id", () =>
    void expectValid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let id = Now.ID["log-state"];
BusinessRule({ $id: id, table: "incident", name: "Log state" });
id = "later-reassignment";`,
      { filename: NOW },
    ));

  it("flags a raw $id that is later assigned Now.ID", () =>
    void expectInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";
let id = "raw-id";
BusinessRule({ $id: id, table: "incident", name: "Log state" });
id = Now.ID["log-state"];`,
      { messageId: "preferNowId" },
      { filename: NOW },
    ));
});

describe("prefer-now-include", () => {
  const { expectInvalid, expectValid } = ruleTester(
    "prefer-now-include",
    {},
    { messageId: "large" },
  );

  it("flags a large inline script", () => {
    const script = Array.from({ length: 10 }, (_, i) => `    gs.info(${i});`).join("\\n");
    expectInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["x"], script: \`${script}\` });`,
      undefined,
      { filename: NOW },
    );
  });

  it("allows Now.include", () =>
    void expectValid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["x"], script: Now.include("./x.server.js") });`,
      { filename: NOW },
    ));

  it("allows Now.include through an immutable Now alias", () =>
    void expectValid(
      `import { BusinessRule } from "@servicenow/sdk/core";
const SDK = Now;
BusinessRule({ $id: SDK.ID["x"], script: (SDK.include("./x.server.js")) });`,
      { filename: NOW },
    ));

  it("flags a large payload under a quoted script key", () => {
    const script = Array.from({ length: 10 }, (_, i) => `    gs.info(${i});`).join("\\n");
    expectInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["x"], "script": \`${script}\` });`,
      undefined,
      { filename: NOW },
    );
  });
});

describe("fluent-naming-convention", () => {
  const { expectActive, expectInvalid, expectValid } = ruleTester(
    "fluent-naming-convention",
    { filename: "log-state.now.ts" },
    { messageId: "nowId" },
  );

  it("checks the filename convention only for Fluent filenames (FINDINGS.md COR-014)", () => {
    // Explicit Fluent authoring routes non-Fluent filenames into this rule;
    // their stems are outside the convention and must not report.
    expectActive(`export const x = 1;`, {
      filename: "app-module.ts",
      settings: { authoring: "fluent" },
    });
  });

  it("flags a PascalCase filename", () =>
    void expectInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["ok-id"] });`,
      { messageId: "file" },
      { filename: "LogState.now.ts" },
    ));

  it("flags a PascalCase Now.ID key", () =>
    void expectInvalid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["LogState"] });`,
    ));

  it("flags a PascalCase key through a Now.ID alias", () =>
    void expectInvalid(`const IDs = Now.ID;
BusinessRule({ $id: IDs["BadAliasKey"] });`));

  it("allows kebab-case", () =>
    void expectValid(
      `import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["log-state"] });`,
    ));
});

describe("no-complex-fluent-logic", () => {
  const { expectInvalid, expectValid } = ruleTester(
    "no-complex-fluent-logic",
    {},
    { messageId: "asyncFn", count: 1 },
  );

  it("flags a for loop", () =>
    void expectInvalid(
      `import { Record } from "@servicenow/sdk/core";\nfor (var i = 0; i < 3; i++) { Record({ $id: Now.ID["x"] }); }`,
      { messageId: "banned" },
      { filename: NOW },
    ));

  it("flags multi-statement function expressions and arrows at the same threshold", () => {
    expectInvalid(
      `export const build = function () {\n  prepare();\n  execute();\n  finish();\n};`,
      { messageId: "banned", includes: "multi-statement function expressions" },
      { filename: NOW },
    );
    expectInvalid(
      `export const build = () => {\n  prepare();\n  execute();\n  finish();\n};`,
      { messageId: "banned", includes: "multi-statement arrow functions" },
      { filename: NOW },
    );
  });

  it("allows short synchronous callbacks but rejects both async forms once", () => {
    expectValid(
      `export const build = function () {\n  prepare();\n  execute();\n};\nexport const finish = () => {\n  prepare();\n  execute();\n};`,
      { filename: NOW },
    );
    expectInvalid(
      `export const build = async function () {\n  prepare();\n  execute();\n  finish();\n};`,
      undefined,
      { filename: NOW },
    );
    expectInvalid(
      `export const build = async () => {\n  prepare();\n  execute();\n  finish();\n};`,
      undefined,
      { filename: NOW },
    );
  });

  it("allows declarative records", () =>
    void expectValid(
      `import { Record } from "@servicenow/sdk/core";\nRecord({ $id: Now.ID["seed"], table: "incident", data: { short_description: "Seed" } });`,
      { filename: NOW },
    ));
});

describe("fluent-directives", () => {
  const { expectInvalid, expectValid } = ruleTester(
    "fluent-directives",
    {},
    { messageId: "misplaced" },
  );

  it("flags a typo", () => {
    expectInvalid(
      `// @fluent-ignre\nexport const demo = 1;\n`,
      {
        messageId: "typo",
      },
      { filename: NOW },
    );
  });

  it("flags TypeScript compiler directives without calling them Fluent suppressions", () => {
    expectInvalid(
      `// @ts-ignore\nexport const demo = 1;\n`,
      {
        messageId: "tsIgnore",
        includes: "TypeScript compiler directive",
      },
      { filename: NOW },
    );
  });

  it("allows @fluent-disable-sync", () => {
    expectValid(
      `// @fluent-disable-sync\nimport { Record } from "@servicenow/sdk/core";\nRecord({ $id: Now.ID["x"], table: "incident", data: {} });\n`,
      { filename: NOW },
    );
  });

  it("allows @fluent-disable-sync-for-file on the first line", () => {
    expectValid(
      `// @fluent-disable-sync-for-file\nimport { Record } from "@servicenow/sdk/core";\nRecord({ $id: Now.ID["x"], table: "incident", data: {} });\n`,
      { filename: NOW },
    );
  });

  it("flags @fluent-disable-sync-for-file after the first line", () => {
    expectInvalid(
      `import { Record } from "@servicenow/sdk/core";\n// @fluent-disable-sync-for-file\nRecord({ $id: Now.ID["x"], table: "incident", data: {} });\n`,
      { messageId: "firstLine" },
      { filename: NOW },
    );
  });

  it("requires exact adjacency", () => {
    expectInvalid(`// @fluent-ignore\n\nexport const demo = 1;\n`, undefined, { filename: NOW });
    expectInvalid(`// @fluent-disable-sync\n// unrelated\nexport const demo = 1;\n`, undefined, {
      filename: NOW,
    });
  });

  it("attaches inside nested statement lists", () => {
    expectValid(`function run() {\n  // @fluent-ignore\n  work();\n}\n`, {
      filename: NOW,
    });
    expectInvalid(
      `function run() {\n  // @fluent-ignore\n}\nwork();\n`,
      { messageId: "dangling" },
      { filename: NOW },
    );
  });

  it("handles one-line and multiline block comments", () => {
    expectValid(`/* @fluent-ignore */\nexport const demo = 1;\n`, {
      filename: NOW,
    });
    expectInvalid(`/* @fluent-ignore\n */\nexport const demo = 1;\n`, undefined, { filename: NOW });
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
    assert.equal(
      message?.message,
      "`@ts-expect-error` is a TypeScript compiler directive, not a ServiceNow Fluent SDK directive or an Oxlint/ESLint disable comment.",
    );
  });

  it("does not treat a Fluent SDK directive as a lint disable comment", () => {
    const source = `import { Record } from "@servicenow/sdk/core";\n// @fluent-ignore\nRecord({ table: "incident", data: {} });\n`;
    expectValid(source, { filename: NOW });
    assertInvalid(source, "require-fluent-id", { messageId: "missing" }, { filename: NOW });
  });
});
