import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { repoRoot } from "./helpers.js";
import { parseNpmPackJson } from "../../scripts/parse-npm-pack.mjs";

const EXAMPLE_PROJECTS = [
  "business-rule",
  "classic-compatibility",
  "classic-es5",
  "client",
  "es2021",
  "fluent",
  "mixed",
  "ui-action",
];

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
  const filename = parseNpmPackJson(stdout).filename;
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
      assert.ok(files.includes("package/dist/analysis/index.js"));
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
      execFileSync(
        "npm",
        ["install", tarball, "oxlint@1.79.0", "eslint@10.8.1", "oxfmt@0.64.0", "typescript@7.0.2"],
        { cwd: consumer, encoding: "utf8" },
      );

      const installed = path.join(consumer, "node_modules/oxc-plugin-servicenow");
      const pkg = JSON.parse(readFileSync(path.join(installed, "package.json"), "utf8")) as {
        name: string;
        version: string;
        exports: Record<string, unknown>;
      };
      assert.equal(pkg.name, "oxc-plugin-servicenow");
      assert.ok(pkg.exports["."]);
      assert.ok(pkg.exports["./analysis"]);
      assert.ok(pkg.exports["./oxfmt"]);
      assert.ok(pkg.exports["./oxfmt.recommended.json"]);
      const installedReadme = readFileSync(path.join(installed, "README.md"), "utf8");
      assert.ok(installedReadme.includes(`/blob/v${pkg.version}/docs/rules/`));
      assert.equal(installedReadme.includes("/blob/main/docs/rules/"), false);
      assert.doesNotMatch(
        installedReadme,
        /\]\((?:docs\/|examples\/|CONTRIBUTING\.md)/,
        "published README links must not target files omitted from the package",
      );

      const imports = JSON.parse(
        execFileSync(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            `import * as root from "oxc-plugin-servicenow";
import * as analysis from "oxc-plugin-servicenow/analysis";
import * as oxfmt from "oxc-plugin-servicenow/oxfmt";
console.log(JSON.stringify({
  rootKeys: Object.keys(root).sort(),
  analysisKeys: Object.keys(analysis).sort(),
  metaName: root.default.meta.name,
  version: root.default.meta.version,
  hardcoded: root.configs.recommendedRules["servicenow/no-hardcoded-sysid"],
  bypass: root.configs.recommendedRules["servicenow/no-system-query-bypass"],
  singleQuote: oxfmt.recommendedOxfmtConfig.singleQuote,
}));`,
          ],
          { cwd: consumer, encoding: "utf8" },
        ),
      ) as {
        rootKeys: string[];
        analysisKeys: string[];
        metaName: string;
        version: string;
        hardcoded: string;
        bypass?: string;
        singleQuote: boolean;
      };
      assert.deepEqual(imports.rootKeys, ["configs", "default", "plugin"]);
      assert.deepEqual(imports.analysisKeys, ["analyzeProvenance", "getScriptContext"]);
      assert.equal(imports.metaName, "servicenow");
      assert.equal(imports.version, pkg.version);
      assert.equal(imports.hardcoded, "error");
      assert.equal(imports.bypass, undefined);
      assert.equal(imports.singleQuote, true);

      const catalogError = execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `try {
  await import("oxc-plugin-servicenow/catalog");
  console.log("loaded");
} catch (error) {
  console.log(error.code);
}`,
        ],
        { cwd: consumer, encoding: "utf8" },
      ).trim();
      assert.equal(catalogError, "ERR_PACKAGE_PATH_NOT_EXPORTED");

      writeFileSync(
        path.join(consumer, "consumer.ts"),
        `import plugin, {
  configs,
  type RuleConfigMap,
  type RuleName,
  type ServiceNowRelease,
  type ServiceNowSettings,
} from "oxc-plugin-servicenow";
import {
  analyzeProvenance,
  getScriptContext,
  type AnalysisProvenance,
  type AnalysisProvenanceQuery,
  type ServiceNowScriptContext,
} from "oxc-plugin-servicenow/analysis";
import { recommendedOxfmtConfig } from "oxc-plugin-servicenow/oxfmt";

const release: ServiceNowRelease = "australia";
const settings: ServiceNowSettings = { javascriptMode: "es2021", release };
const ruleName: RuleName = "no-hardcoded-sysid";
const rules: RuleConfigMap = { [ruleName]: "error" };
const analyze: typeof analyzeProvenance = analyzeProvenance;
const getContext: typeof getScriptContext = getScriptContext;
let query: AnalysisProvenanceQuery | undefined;
let provenance: AnalysisProvenance | undefined;
let context: ServiceNowScriptContext | undefined;
void [plugin, configs, settings, rules, analyze, getContext, query, provenance, context, recommendedOxfmtConfig];
`,
      );
      writeFileSync(
        path.join(consumer, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              noEmit: true,
              skipLibCheck: false,
            },
            include: ["consumer.ts"],
          },
          null,
          2,
        ),
      );
      execFileSync(path.join(consumer, "node_modules", ".bin", "tsc"), ["-p", "tsconfig.json"], {
        cwd: consumer,
        encoding: "utf8",
      });

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
      const eslintReport = JSON.parse(eslintStdout) as Array<{
        messages: Array<{ ruleId: string }>;
      }>;
      const eslintRules = eslintReport.flatMap((file) =>
        file.messages.map((message) => message.ruleId),
      );
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
      execFileSync(
        path.join(consumer, "node_modules", ".bin", "oxfmt"),
        ["-c", ".oxfmtrc.json", "sample.br.js"],
        {
          encoding: "utf8",
          cwd: consumer,
        },
      );
      execFileSync(
        path.join(consumer, "node_modules", ".bin", "oxfmt"),
        ["-c", ".oxfmtrc.json", "--check", "sample.br.js"],
        { encoding: "utf8", cwd: consumer },
      );

      for (const project of EXAMPLE_PROJECTS) {
        const source = path.join(repoRoot, "examples", project);
        const destination = path.join(consumer, "examples", project);
        cpSync(source, destination, { recursive: true });
        const config = JSON.parse(
          readFileSync(path.join(destination, ".oxlintrc.json"), "utf8"),
        ) as { jsPlugins: Array<{ specifier: string }> };
        assert.equal(config.jsPlugins[0]?.specifier, "oxc-plugin-servicenow");
        const readme = readFileSync(path.join(destination, "README.md"), "utf8");
        for (const command of [
          "npx oxlint -c .oxlintrc.json valid",
          "npx oxlint -c .oxlintrc.json invalid",
          "npx oxfmt -c oxfmt.config.ts --check valid",
        ]) {
          assert.ok(readme.includes(command), `${project} README omits ${command}`);
        }
        execFileSync("npx", ["oxlint", "-c", ".oxlintrc.json", "valid"], {
          cwd: destination,
          encoding: "utf8",
        });
        let invalidOutput = "";
        assert.throws(() => {
          try {
            execFileSync("npx", ["oxlint", "-c", ".oxlintrc.json", "invalid"], {
              cwd: destination,
              encoding: "utf8",
            });
          } catch (error) {
            const failed = error as { stdout?: string; stderr?: string };
            invalidOutput = (failed.stdout ?? "") + (failed.stderr ?? "");
            throw error;
          }
        });
        assert.match(invalidOutput, /servicenow/);
        execFileSync("npx", ["oxfmt", "-c", "oxfmt.config.ts", "--check", "valid"], {
          cwd: destination,
          encoding: "utf8",
        });
      }
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
        ["install", tarball, "eslint@9.39.5", "typescript-eslint@8.46.0", "typescript@5.8.3"],
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
      writeFileSync(
        path.join(consumer, "table.now.tsx"),
        `import type { Table } from "@servicenow/sdk/core";
import { BusinessRule } from "@servicenow/sdk/core";

export const unusedTsx: Table | undefined = undefined;

BusinessRule({
  table: "problem",
  name: "Typed TSX",
});
`,
      );
      writeFileSync(path.join(consumer, "app.ts"), `const x: string = "ordinary";\n`);
      let eslintStdout = "";
      try {
        eslintStdout = execFileSync(
          path.join(consumer, "node_modules", ".bin", "eslint"),
          ["--format", "json", "table.now.ts", "table.now.tsx", "app.ts"],
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
      const fluentTsx = report.find((file) => file.filePath.endsWith("table.now.tsx"));
      const ordinary = report.find((file) => file.filePath.endsWith("app.ts"));
      assert.ok(fluent, "expected table.now.ts in ESLint output");
      assert.ok(fluentTsx, "expected table.now.tsx in ESLint output");
      const fluentRules = fluent.messages.map((message) => message.ruleId);
      const fluentTsxRules = fluentTsx.messages.map((message) => message.ruleId);
      assert.ok(
        fluentRules.includes("servicenow/require-fluent-id"),
        `typed fluent rules: ${fluentRules.join(", ") || "(none)"}`,
      );
      assert.ok(
        fluentTsxRules.includes("servicenow/require-fluent-id"),
        `typed fluent tsx rules: ${fluentTsxRules.join(", ") || "(none)"}`,
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
