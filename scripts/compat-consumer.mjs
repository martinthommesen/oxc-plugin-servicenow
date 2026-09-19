import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packTarball as buildTarball } from "./check-release-artifact.mjs";
import { parseOxlintStdout, pluginRuleIds, runHostProcess } from "./lib/host-verifier.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(readFileSync(path.join(root, "scripts/compat-matrix.json"), "utf8"));
const fluentEvidence = JSON.parse(
  readFileSync(path.join(root, "tests/fixtures/fluent-sdk-declarations.json"), "utf8"),
);

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("-")) fail("runtime", `${name} requires a value`);
  return value;
}

function fail(kind, message) {
  const error = new Error(`${kind}: ${message}`);
  error.kind = kind;
  throw error;
}

function packTarball(destination) {
  const tarballFlag = argValue("--tarball", process.env.SN_COMPAT_TARBALL);
  return tarballFlag ? path.resolve(tarballFlag) : buildTarball(destination).tarball;
}

function oxlintReport(consumer, args, errorKind, message) {
  const host = runHostProcess({
    bin: path.join(consumer, "node_modules", ".bin", "oxlint"),
    args,
    cwd: consumer,
  });
  const { report, parseError } = parseOxlintStdout(host.stdout);
  if (!report) fail(errorKind, `${message}: ${parseError ?? host.stderr.slice(0, 400)}`);
  return report;
}

async function runCell(tarball, cell, sameRuntimeSmoke) {
  const consumer = mkdtempSync(path.join(tmpdir(), `sn-oxc-compat-${cell.id}-`));
  try {
    writeFileSync(
      path.join(consumer, "package.json"),
      JSON.stringify({ name: `sn-oxc-compat-${cell.id}`, private: true, type: "module" }, null, 2),
    );
    try {
      const installArgs = [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        tarball,
        `oxlint@${cell.oxlint}`,
        `eslint@${cell.eslint}`,
        `oxfmt@${cell.oxfmt}`,
      ];
      if (cell.typescriptEslint) {
        installArgs.push(
          `typescript-eslint@${cell.typescriptEslint}`,
          `@typescript-eslint/parser@${cell.typescriptEslint}`,
          `typescript@${cell.typescript}`,
        );
      }
      execFileSync("npm", installArgs, {
        cwd: consumer,
        encoding: "utf8",
      });
    } catch (error) {
      fail(
        "host-api",
        `${cell.id} install failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const installedVersions = {
      node: process.versions.node,
      npm: execFileSync("npm", ["--version"], { cwd: consumer, encoding: "utf8" }).trim(),
      oxlint: JSON.parse(
        readFileSync(path.join(consumer, "node_modules/oxlint/package.json"), "utf8"),
      ).version,
      eslint: JSON.parse(
        readFileSync(path.join(consumer, "node_modules/eslint/package.json"), "utf8"),
      ).version,
      oxfmt: JSON.parse(
        readFileSync(path.join(consumer, "node_modules/oxfmt/package.json"), "utf8"),
      ).version,
      ...(cell.typescriptEslint
        ? {
            typescriptEslint: JSON.parse(
              readFileSync(
                path.join(consumer, "node_modules/typescript-eslint/package.json"),
                "utf8",
              ),
            ).version,
            typescript: JSON.parse(
              readFileSync(path.join(consumer, "node_modules/typescript/package.json"), "utf8"),
            ).version,
          }
        : {}),
    };
    for (const [name, expected] of Object.entries(cell)) {
      if (name === "id" || (sameRuntimeSmoke && (name === "node" || name === "npm"))) continue;
      if (installedVersions[name] !== expected) {
        fail(
          "host-api",
          `${cell.id} ${name} is ${installedVersions[name] ?? "absent"}; expected ${expected}`,
        );
      }
    }
    console.log(JSON.stringify({ cell: cell.id, versions: installedVersions, sameRuntimeSmoke }));

    let publicApi;
    try {
      // Resolve through the consumer's package exports, not a filesystem dist path.
      const importScript = `
import { createRequire } from "node:module";
const plugin = await import("oxc-plugin-servicenow");
const analysis = await import("oxc-plugin-servicenow/analysis");
const oxfmt = await import("oxc-plugin-servicenow/oxfmt");
const require = createRequire(import.meta.url);
const pkg = require("oxc-plugin-servicenow/package.json");
const recommended = require("oxc-plugin-servicenow/oxfmt.recommended.json");
console.log(JSON.stringify({
  metaName: plugin.default?.meta?.name,
  version: plugin.default?.meta?.version,
  rootKeys: Object.keys(plugin).sort(),
  analysisKeys: Object.keys(analysis).sort(),
  oxfmt: typeof oxfmt === "object",
  recommended: Boolean(recommended && typeof recommended === "object"),
  packageVersion: pkg.version,
}));`;
      publicApi = JSON.parse(
        execFileSync(process.execPath, ["--input-type=module", "-e", importScript], {
          cwd: consumer,
          encoding: "utf8",
        }),
      );
    } catch (error) {
      fail(
        "package",
        `${cell.id} public export import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (publicApi.metaName !== "servicenow") {
      fail("package", `${cell.id} public export meta.name is ${publicApi.metaName}`);
    }
    if (publicApi.packageVersion !== publicApi.version) {
      fail(
        "package",
        `${cell.id} package.json version is ${publicApi.packageVersion}, plugin version is ${publicApi.version}`,
      );
    }
    if (JSON.stringify(publicApi.rootKeys) !== JSON.stringify(["configs", "default", "plugin"])) {
      fail("package", `${cell.id} root exports are ${publicApi.rootKeys.join(", ")}`);
    }
    if (
      JSON.stringify(publicApi.analysisKeys) !==
      JSON.stringify(["analyzeProvenance", "getScriptContext"])
    ) {
      fail("package", `${cell.id} analysis exports are ${publicApi.analysisKeys.join(", ")}`);
    }
    if (!publicApi.oxfmt || !publicApi.recommended) {
      fail("package", `${cell.id} public subpath exports did not load`);
    }
    try {
      execFileSync(
        process.execPath,
        ["--input-type=module", "-e", 'await import("oxc-plugin-servicenow/catalog")'],
        { cwd: consumer, encoding: "utf8", stdio: "pipe" },
      );
      fail("package", `${cell.id} internal catalog subpath was exported`);
    } catch (error) {
      if (error.kind === "package") throw error;
      if (!String(error.stderr ?? error.message).includes("ERR_PACKAGE_PATH_NOT_EXPORTED")) {
        fail("package", `${cell.id} catalog rejection was not ERR_PACKAGE_PATH_NOT_EXPORTED`);
      }
    }
    if (cell.typescriptEslint) {
      try {
        const parserScript = `import * as tseslintParser from "@typescript-eslint/parser"; const result = tseslintParser.parseForESLint("const table: string = \\"incident\\";", { filePath: "sample.now.tsx" }); if (!result?.ast) throw new Error("TypeScript parser returned no AST");`;
        execFileSync(process.execPath, ["--input-type=module", "-e", parserScript], {
          cwd: consumer,
          encoding: "utf8",
        });
      } catch (error) {
        fail(
          "parser",
          `${cell.id} TypeScript parser failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

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
    const report = oxlintReport(
      consumer,
      ["--format", "json", "bad.br.js"],
      "host-api",
      `${cell.id} oxlint did not emit JSON`,
    );
    const codes = pluginRuleIds(report);
    if (!codes.some((code) => String(code).includes("no-hardcoded-sysid"))) {
      fail(
        "runtime",
        `${cell.id} oxlint missed no-hardcoded-sysid (${codes.join(", ") || "none"})`,
      );
    }
    if (!codes.some((code) => String(code).includes("require-query-before-next"))) {
      fail(
        "runtime",
        `${cell.id} oxlint missed require-query-before-next (${codes.join(", ") || "none"})`,
      );
    }

    writeFileSync(
      path.join(consumer, "eslint.config.js"),
      cell.typescriptEslint
        ? `import plugin from "oxc-plugin-servicenow";
import tseslint from "typescript-eslint";
export default [
  {
    files: ["**/*.now.ts", "**/*.now.tsx"],
    languageOptions: { parser: tseslint.parser },
  },
  plugin.configs.flat.recommended,
];
`
        : `import plugin from "oxc-plugin-servicenow";\nexport default [plugin.configs.flat.recommended];\n`,
    );
    let eslintStdout = "";
    try {
      eslintStdout = execFileSync(
        path.join(consumer, "node_modules", ".bin", "eslint"),
        ["--format", "json", "bad.br.js"],
        { encoding: "utf8", cwd: consumer },
      );
    } catch (error) {
      eslintStdout = error.stdout ?? "";
    }
    let eslintReport;
    try {
      eslintReport = JSON.parse(eslintStdout);
    } catch {
      fail("parser", `${cell.id} eslint did not emit JSON: ${eslintStdout.slice(0, 400)}`);
    }
    const eslintRules = eslintReport.flatMap((file) =>
      file.messages.map((message) => message.ruleId),
    );
    if (!eslintRules.includes("servicenow/no-hardcoded-sysid")) {
      fail(
        "runtime",
        `${cell.id} eslint missed no-hardcoded-sysid (${eslintRules.join(", ") || "none"})`,
      );
    }
    if (!eslintRules.includes("servicenow/require-query-before-next")) {
      fail(
        "runtime",
        `${cell.id} eslint missed require-query-before-next (${eslintRules.join(", ") || "none"})`,
      );
    }

    const installed = path.join(consumer, "node_modules", "oxc-plugin-servicenow");
    writeFileSync(
      path.join(consumer, "sample.br.js"),
      'var rec = new GlideRecord("incident");\nrec.query();\n',
    );
    writeFileSync(
      path.join(consumer, "sample.now.ts"),
      'import { List } from "@servicenow/sdk/core";\nexport const incident = List({ table: "incident", columns: [], view: "Default" });\n',
    );
    writeFileSync(
      path.join(consumer, "sample.now.tsx"),
      "const Component = () => <div />;\nexport default Component;\n",
    );
    if (cell.typescriptEslint) {
      let typedStdout = "";
      try {
        typedStdout = execFileSync(
          path.join(consumer, "node_modules", ".bin", "eslint"),
          ["--format", "json", "sample.now.ts", "sample.now.tsx"],
          { encoding: "utf8", cwd: consumer },
        );
      } catch (error) {
        typedStdout = error.stdout ?? "";
      }
      let typedReport;
      try {
        typedReport = JSON.parse(typedStdout);
      } catch {
        fail("parser", `${cell.id} typed ESLint output was not JSON: ${typedStdout.slice(0, 400)}`);
      }
      if (typedReport.some((file) => file.messages.some((message) => message.fatal))) {
        fail("parser", `${cell.id} typed ESLint reported a fatal parser diagnostic`);
      }
      if (!typedReport.some((file) => file.filePath.endsWith("sample.now.ts"))) {
        fail("parser", `${cell.id} typed ESLint omitted sample.now.ts`);
      }
      if (!typedReport.some((file) => file.filePath.endsWith("sample.now.tsx"))) {
        fail("parser", `${cell.id} typed ESLint omitted sample.now.tsx`);
      }
    }
    for (const fluentSdkVersion of matrix.fluentSdk ?? ["3.0.0", "4.1.0"]) {
      const fluentConfig = path.join(consumer, `.oxlintrc-${fluentSdkVersion}.json`);
      writeFileSync(
        fluentConfig,
        JSON.stringify(
          {
            jsPlugins: [{ name: "servicenow", specifier: "oxc-plugin-servicenow" }],
            settings: { servicenow: { release: "australia", fluentSdkVersion } },
            rules: { "servicenow/require-fluent-id": "error" },
          },
          null,
          2,
        ),
      );
      const fluentReport = oxlintReport(
        consumer,
        ["--format", "json", "-c", fluentConfig, "sample.now.ts"],
        "runtime",
        `${cell.id} Fluent ${fluentSdkVersion} output was not JSON`,
      );
      const fluentCodes = pluginRuleIds(fluentReport);
      const hasMissingId = fluentCodes.some((code) => String(code).includes("require-fluent-id"));
      const requiresListId =
        fluentEvidence.versions?.[fluentSdkVersion]?.capabilities?.List?.idPolicy === "required";
      if (requiresListId !== hasMissingId) {
        fail(
          "runtime",
          `${cell.id} Fluent ${fluentSdkVersion} ID policy mismatch (${fluentCodes.join(", ") || "none"})`,
        );
      }
    }
    for (const javascriptMode of matrix.javascriptModes ?? [
      "compatibility",
      "es5",
      "es2021",
      "unknown",
    ]) {
      const modeConfig = path.join(consumer, `.oxlintrc-${javascriptMode}.json`);
      writeFileSync(
        modeConfig,
        JSON.stringify(
          {
            jsPlugins: [{ name: "servicenow", specifier: "oxc-plugin-servicenow" }],
            settings: { servicenow: { javascriptMode } },
            rules: { "servicenow/no-promise": "error" },
          },
          null,
          2,
        ),
      );
      writeFileSync(
        path.join(consumer, `mode-${javascriptMode}.server.js`),
        "Promise.resolve(1);\n",
      );
      const modeReport = oxlintReport(
        consumer,
        ["--format", "json", "-c", modeConfig, `mode-${javascriptMode}.server.js`],
        "runtime",
        `${cell.id} ${javascriptMode} mode output was not JSON`,
      );
      const modeCodes = pluginRuleIds(modeReport);
      const reportsPromise = javascriptMode === "compatibility" || javascriptMode === "es5";
      const hasPromiseDiagnostic = modeCodes.some((code) => String(code).includes("no-promise"));
      if (reportsPromise !== hasPromiseDiagnostic) {
        fail(
          "runtime",
          `${cell.id} ${javascriptMode} mode Promise policy mismatch (${modeCodes.join(", ") || "none"})`,
        );
      }
    }
    const releaseExpectations = {
      zurich: { bigint64Arrays: true, objectHasOwn: true },
      australia: { bigint64Arrays: false, objectHasOwn: false },
    };
    writeFileSync(
      path.join(consumer, "release-engine.server.js"),
      'new BigInt64Array(1);\nObject.hasOwn(record, "number");\nclass RecordState { #value = 1; }\n',
    );
    const releaseCases = [
      ...(matrix.serviceNowReleases ?? []).map((release) => ({ name: release, release })),
      { name: "omitted", release: undefined },
    ];
    for (const releaseCase of releaseCases) {
      const expectation =
        releaseCase.release === undefined
          ? { bigint64Arrays: false, objectHasOwn: false }
          : releaseExpectations[releaseCase.release];
      if (!expectation) {
        fail("runtime", `missing engine expectations for release ${releaseCase.release}`);
      }
      const releaseConfig = path.join(consumer, `.oxlintrc-release-${releaseCase.name}.json`);
      writeFileSync(
        releaseConfig,
        JSON.stringify(
          {
            jsPlugins: [{ name: "servicenow", specifier: "oxc-plugin-servicenow" }],
            settings: {
              servicenow: {
                javascriptMode: "es2021",
                ...(releaseCase.release ? { release: releaseCase.release } : {}),
              },
            },
            rules: {
              "servicenow/no-typed-arrays": "error",
              "servicenow/no-object-hasown": "error",
              "servicenow/no-unsupported-syntax": "error",
            },
          },
          null,
          2,
        ),
      );
      const releaseReport = oxlintReport(
        consumer,
        ["--format", "json", "-c", releaseConfig, "release-engine.server.js"],
        "runtime",
        `${cell.id} ${releaseCase.name} release output was not JSON`,
      );
      const releaseCodes = pluginRuleIds(releaseReport);
      const actual = {
        bigint64Arrays: releaseCodes.some((code) => code.includes("no-typed-arrays")),
        objectHasOwn: releaseCodes.some((code) => code.includes("no-object-hasown")),
        privateInstance: releaseCodes.some((code) => code.includes("no-unsupported-syntax")),
      };
      if (
        actual.bigint64Arrays !== expectation.bigint64Arrays ||
        actual.objectHasOwn !== expectation.objectHasOwn ||
        !actual.privateInstance
      ) {
        fail(
          "runtime",
          `${cell.id} ${releaseCase.name} release policy mismatch (${releaseCodes.join(", ") || "none"})`,
        );
      }
    }
    writeFileSync(
      path.join(consumer, ".oxfmtrc.json"),
      readFileSync(path.join(installed, "oxfmt.recommended.json"), "utf8"),
    );
    try {
      execFileSync(
        path.join(consumer, "node_modules", ".bin", "oxfmt"),
        ["-c", ".oxfmtrc.json", "--write", "sample.br.js", "sample.now.ts", "sample.now.tsx"],
        {
          encoding: "utf8",
          cwd: consumer,
        },
      );
      execFileSync(
        path.join(consumer, "node_modules", ".bin", "oxfmt"),
        ["-c", ".oxfmtrc.json", "--check", "sample.br.js", "sample.now.ts", "sample.now.tsx"],
        { encoding: "utf8", cwd: consumer },
      );
    } catch (error) {
      fail(
        "formatter",
        `${cell.id} oxfmt failed: ${error instanceof Error ? error.message : String(error)}\n${error?.stderr ?? ""}`,
      );
    }
    return { id: cell.id, ok: true };
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
}

const cellFlag = argValue("--cell", process.env.SN_COMPAT_CELL);
const expectedSha256 = argValue("--sha256", process.env.SN_COMPAT_SHA256);
if (expectedSha256 && !/^[0-9a-f]{64}$/.test(expectedSha256)) {
  fail("package", "expected tarball SHA-256 must be 64 lowercase hexadecimal characters");
}
const sameRuntimeSmoke = process.argv.includes("--all") || !cellFlag;
const cells = matrix.cells.filter((cell) => {
  if (cellFlag) return cell.id === cellFlag;
  if (process.argv.includes("--all")) return true;
  return cell.id === matrix.localSmokeCell;
});
if (cells.length === 0) {
  fail("runtime", `no compatibility cells selected (cell=${cellFlag ?? "auto"})`);
}

const staging = mkdtempSync(path.join(tmpdir(), "sn-oxc-compat-pack-"));
const results = [];
try {
  const tarball = packTarball(staging);
  const tarballSha256 = createHash("sha256").update(readFileSync(tarball)).digest("hex");
  if (expectedSha256 && tarballSha256 !== expectedSha256) {
    fail("package", `tarball SHA-256 is ${tarballSha256}; expected ${expectedSha256}`);
  }
  console.log(JSON.stringify({ tarball: path.basename(tarball), sha256: tarballSha256 }));
  for (const cell of cells) {
    console.log(
      `compat cell ${cell.id} oxlint@${cell.oxlint} eslint@${cell.eslint} oxfmt@${cell.oxfmt} typescript-eslint@${cell.typescriptEslint}`,
    );
    results.push(await runCell(tarball, cell, sameRuntimeSmoke));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  rmSync(staging, { recursive: true, force: true });
}

console.log(JSON.stringify({ cells: results }, null, 2));
