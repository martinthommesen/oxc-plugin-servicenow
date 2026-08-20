import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import { repoRoot } from "./helpers.js";

function ensureBuiltDist(): void {
  try {
    readFileSync(path.join(repoRoot, "dist/index.js"));
  } catch {
    execFileSync("npm", ["run", "build"], { cwd: repoRoot, encoding: "utf8" });
  }
}

function packTarball(destination: string): string {
  ensureBuiltDist();
  // Ignore prepack so the workspace `dist/` is not deleted while other tests run.
  const stdout = execFileSync(
    "npm",
    ["pack", "--json", "--ignore-scripts", `--pack-destination=${destination}`],
    {
      encoding: "utf8",
      cwd: repoRoot,
    },
  );
  const parsed = JSON.parse(stdout) as Array<{ filename: string }>;
  const filename = parsed[0]?.filename;
  assert.ok(
    typeof filename === "string" && filename.startsWith("oxc-plugin-servicenow-"),
    `unexpected pack output: ${stdout}`,
  );
  return path.join(destination, filename);
}

function listTarball(tarball: string): string[] {
  return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).split("\n").filter(Boolean);
}

describe("packed package consumer", () => {
  it("packs, installs, imports public exports, and lints with oxlint", async () => {
    const staging = mkdtempSync(path.join(tmpdir(), "sn-oxc-pack-"));
    const tarball = packTarball(staging);
    const files = listTarball(tarball);
    const consumer = mkdtempSync(path.join(tmpdir(), "sn-oxc-consumer-"));
    try {
      assert.ok(files.includes("package/package.json"));
      assert.ok(files.includes("package/dist/index.js"));
      assert.ok(files.includes("package/dist/oxfmt/index.js"));
      assert.ok(files.includes("package/oxfmt.recommended.json"));
      assert.ok(files.includes("package/README.md"));
      assert.ok(files.includes("package/LICENSE"));
      assert.ok(!files.some((file) => file.startsWith("package/tests/")));
      assert.ok(!files.some((file) => file.startsWith("package/src/")));
      assert.ok(!files.some((file) => file.startsWith("package/.github/")));
      assert.ok(!files.some((file) => file.includes(".env")));

      writeFileSync(
        path.join(consumer, "package.json"),
        JSON.stringify({ name: "sn-oxc-consumer", private: true, type: "module" }, null, 2),
      );
      execFileSync("npm", ["install", tarball, "oxlint@1.79.0", "eslint@10.8.1", "oxfmt@0.16.0"], {
        cwd: consumer,
        encoding: "utf8",
      });

      const installed = path.join(consumer, "node_modules/oxc-plugin-servicenow");
      const pkg = JSON.parse(readFileSync(path.join(installed, "package.json"), "utf8")) as {
        name: string;
        version: string;
        exports: Record<string, unknown>;
      };
      assert.equal(pkg.name, "oxc-plugin-servicenow");
      assert.ok(pkg.exports["."]);
      assert.ok(pkg.exports["./oxfmt"]);
      assert.ok(pkg.exports["./oxfmt.recommended.json"]);

      const plugin = (await import(pathToFileURL(path.join(installed, "dist/index.js")).href)) as {
        default: { meta: { name: string } };
        configs: { recommendedRules: Record<string, string> };
        PACKAGE_VERSION: string;
      };
      assert.equal(plugin.default.meta.name, "servicenow");
      assert.equal(plugin.PACKAGE_VERSION, pkg.version);
      assert.equal(plugin.configs.recommendedRules["servicenow/no-hardcoded-sysid"], "error");
      assert.equal(plugin.configs.recommendedRules["servicenow/no-system-query-bypass"], undefined);

      const oxfmt = (await import(pathToFileURL(path.join(installed, "dist/oxfmt/index.js")).href)) as {
        recommendedOxfmtConfig: { singleQuote: boolean };
      };
      assert.equal(oxfmt.recommendedOxfmtConfig.singleQuote, true);

      const oxfmtJson = JSON.parse(
        readFileSync(path.join(installed, "oxfmt.recommended.json"), "utf8"),
      ) as { singleQuote: boolean };
      assert.equal(oxfmtJson.singleQuote, true);

      writeFileSync(
        path.join(consumer, ".oxlintrc.json"),
        JSON.stringify(
          {
            jsPlugins: [{ name: "servicenow", specifier: "oxc-plugin-servicenow" }],
            rules: {
              "servicenow/no-hardcoded-sysid": "error",
              "servicenow/require-query-before-next": "error",
            },
          },
          null,
          2,
        ),
      );
      writeFileSync(
        path.join(consumer, "bad.br.js"),
        'var assignmentGroup = "97c04b3b1b12100043ab85e5bd0713e2";\nvar rec = new GlideRecord("incident");\nrec.next();\n',
      );
      let stdout = "";
      try {
        stdout = execFileSync(
          path.join(consumer, "node_modules", ".bin", "oxlint"),
          ["--format", "json", "bad.br.js"],
          { encoding: "utf8", cwd: consumer },
        );
      } catch (error) {
        stdout = (error as { stdout?: string }).stdout ?? "";
      }
      const report = JSON.parse(stdout) as { diagnostics: Array<{ code: string }> };
      const codes = report.diagnostics.map((diagnostic) => diagnostic.code);
      assert.ok(
        codes.some((code) => code.includes("no-hardcoded-sysid")),
        `packed oxlint codes: ${codes.join(", ") || "(none)"}`,
      );
      assert.ok(
        codes.some((code) => code.includes("require-query-before-next")),
        `packed oxlint codes: ${codes.join(", ") || "(none)"}`,
      );

      writeFileSync(
        path.join(consumer, "eslint.config.js"),
        `import plugin from "oxc-plugin-servicenow";\nexport default [plugin.configs.flat.recommended];\n`,
      );
      let eslintStdout = "";
      try {
        eslintStdout = execFileSync(
          path.join(consumer, "node_modules", ".bin", "eslint"),
          ["--format", "json", "bad.br.js"],
          { encoding: "utf8", cwd: consumer },
        );
      } catch (error) {
        eslintStdout = (error as { stdout?: string }).stdout ?? "";
      }
      const eslintReport = JSON.parse(eslintStdout) as Array<{ messages: Array<{ ruleId: string }> }>;
      const eslintRules = eslintReport.flatMap((file) => file.messages.map((message) => message.ruleId));
      assert.ok(
        eslintRules.includes("servicenow/no-hardcoded-sysid"),
        `packed eslint rules: ${eslintRules.join(", ") || "(none)"}`,
      );

      writeFileSync(
        path.join(consumer, "sample.br.js"),
        'var rec = new GlideRecord("incident");\nrec.query();\n',
      );
      writeFileSync(
        path.join(consumer, ".oxfmtrc.json"),
        readFileSync(path.join(installed, "oxfmt.recommended.json"), "utf8"),
      );
      execFileSync(path.join(consumer, "node_modules", ".bin", "oxfmt"), ["-c", ".oxfmtrc.json", "sample.br.js"], {
        encoding: "utf8",
        cwd: consumer,
      });
      execFileSync(
        path.join(consumer, "node_modules", ".bin", "oxfmt"),
        ["-c", ".oxfmtrc.json", "--check", "sample.br.js"],
        { encoding: "utf8", cwd: consumer },
      );
    } finally {
      rmSync(consumer, { recursive: true, force: true });
      rmSync(staging, { recursive: true, force: true });
    }
  });

  it("lints typed Fluent files when the consumer adds typescript-eslint", async () => {
    const staging = mkdtempSync(path.join(tmpdir(), "sn-oxc-pack-ts-"));
    const tarball = packTarball(staging);
    const consumer = mkdtempSync(path.join(tmpdir(), "sn-oxc-ts-consumer-"));
    try {
      writeFileSync(
        path.join(consumer, "package.json"),
        JSON.stringify({ name: "sn-oxc-ts-consumer", private: true, type: "module" }, null, 2),
      );
      execFileSync(
        "npm",
        ["install", tarball, "eslint@9.39.5", "typescript-eslint@8.46.0", "typescript@5.8.0"],
        { cwd: consumer, encoding: "utf8" },
      );
      writeFileSync(
        path.join(consumer, "eslint.config.js"),
        `import servicenow from "oxc-plugin-servicenow";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["**/*.now.ts", "**/*.now.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { sourceType: "module", ecmaVersion: "latest" },
    },
  },
  servicenow.configs.flat.recommended,
];
`,
      );
      writeFileSync(
        path.join(consumer, "table.now.ts"),
        `import type { Table } from "@servicenow/sdk/core";
import { BusinessRule } from "@servicenow/sdk/core";

export const unused: Table | undefined = undefined;

BusinessRule({
  table: "incident",
  name: "Typed",
});
`,
      );
      writeFileSync(path.join(consumer, "app.ts"), `const x: string = "ordinary";\n`);
      let eslintStdout = "";
      try {
        eslintStdout = execFileSync(
          path.join(consumer, "node_modules", ".bin", "eslint"),
          ["--format", "json", "table.now.ts", "app.ts"],
          { encoding: "utf8", cwd: consumer },
        );
      } catch (error) {
        eslintStdout = (error as { stdout?: string }).stdout ?? "";
      }
      const report = JSON.parse(eslintStdout) as Array<{
        filePath: string;
        messages: Array<{ ruleId: string | null; fatal?: boolean }>;
      }>;
      const fluent = report.find((file) => file.filePath.endsWith("table.now.ts"));
      const ordinary = report.find((file) => file.filePath.endsWith("app.ts"));
      assert.ok(fluent, "expected table.now.ts in ESLint output");
      const fluentRules = fluent.messages.map((message) => message.ruleId);
      assert.ok(
        fluentRules.includes("servicenow/require-fluent-id"),
        `typed fluent rules: ${fluentRules.join(", ") || "(none)"}`,
      );
      assert.equal(
        ordinary?.messages.some((message) => message.ruleId?.startsWith("servicenow/")),
        false,
      );
      assert.equal(
        ordinary?.messages.some((message) => message.fatal),
        false,
      );
    } finally {
      rmSync(consumer, { recursive: true, force: true });
      rmSync(staging, { recursive: true, force: true });
    }
  });
});
