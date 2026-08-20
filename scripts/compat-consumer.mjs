import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(readFileSync(path.join(root, "scripts/compat-matrix.json"), "utf8"));

function fail(kind, message) {
  const error = new Error(`${kind}: ${message}`);
  error.kind = kind;
  throw error;
}

function currentNodeMajor() {
  return Number(process.versions.node.split(".")[0]);
}

function cellApplies(cell) {
  if (cell.node === "current") return true;
  if (cell.node === "20" || cell.node === "20.19.0") return currentNodeMajor() === 20 || process.env.SN_COMPAT_FULL === "1";
  if (cell.node === "22") return currentNodeMajor() === 22 || process.env.SN_COMPAT_FULL === "1";
  return true;
}

function ensureBuiltDist() {
  try {
    readFileSync(path.join(root, "dist/index.js"));
  } catch {
    execFileSync("npm", ["run", "build"], { cwd: root, encoding: "utf8" });
  }
}

function packTarball(destination) {
  const tarballFlag = process.argv.includes("--tarball")
    ? process.argv[process.argv.indexOf("--tarball") + 1]
    : process.env.SN_COMPAT_TARBALL;
  if (tarballFlag) {
    return path.resolve(tarballFlag);
  }
  ensureBuiltDist();
  const stdout = execFileSync("npm", ["pack", "--json", "--ignore-scripts", `--pack-destination=${destination}`], {
    encoding: "utf8",
    cwd: root,
  });
  const parsed = JSON.parse(stdout);
  const filename = parsed[0]?.filename;
  if (typeof filename !== "string") fail("package", `unexpected pack output: ${stdout}`);
  return path.join(destination, filename);
}

async function runCell(tarball, cell) {
  const consumer = mkdtempSync(path.join(tmpdir(), `sn-oxc-compat-${cell.id}-`));
  try {
    writeFileSync(
      path.join(consumer, "package.json"),
      JSON.stringify({ name: `sn-oxc-compat-${cell.id}`, private: true, type: "module" }, null, 2),
    );
    try {
      execFileSync("npm", ["install", tarball, `oxlint@${cell.oxlint}`, `eslint@${cell.eslint}`, `oxfmt@${cell.oxfmt}`], {
        cwd: consumer,
        encoding: "utf8",
      });
    } catch (error) {
      fail("host-api", `${cell.id} install failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const installed = path.join(consumer, "node_modules/oxc-plugin-servicenow");
    let plugin;
    try {
      plugin = await import(pathToFileURL(path.join(installed, "dist/index.js")).href);
    } catch (error) {
      fail("package", `${cell.id} import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (plugin.default?.meta?.name !== "servicenow") {
      fail("package", `${cell.id} public export meta.name is ${plugin.default?.meta?.name}`);
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
    let oxlintStdout = "";
    try {
      oxlintStdout = execFileSync(path.join(consumer, "node_modules", ".bin", "oxlint"), ["--format", "json", "bad.br.js"], {
        encoding: "utf8",
        cwd: consumer,
      });
    } catch (error) {
      oxlintStdout = error.stdout ?? "";
    }
    let report;
    try {
      report = JSON.parse(oxlintStdout);
    } catch {
      fail("host-api", `${cell.id} oxlint did not emit JSON: ${oxlintStdout.slice(0, 400)}`);
    }
    const codes = (report.diagnostics ?? []).map((diagnostic) => diagnostic.code);
    if (!codes.some((code) => String(code).includes("no-hardcoded-sysid"))) {
      fail("runtime", `${cell.id} oxlint missed no-hardcoded-sysid (${codes.join(", ") || "none"})`);
    }
    if (!codes.some((code) => String(code).includes("require-query-before-next"))) {
      fail("runtime", `${cell.id} oxlint missed require-query-before-next (${codes.join(", ") || "none"})`);
    }

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
      eslintStdout = error.stdout ?? "";
    }
    let eslintReport;
    try {
      eslintReport = JSON.parse(eslintStdout);
    } catch {
      fail("parser", `${cell.id} eslint did not emit JSON: ${eslintStdout.slice(0, 400)}`);
    }
    const eslintRules = eslintReport.flatMap((file) => file.messages.map((message) => message.ruleId));
    if (!eslintRules.includes("servicenow/no-hardcoded-sysid")) {
      fail("runtime", `${cell.id} eslint missed no-hardcoded-sysid (${eslintRules.join(", ") || "none"})`);
    }
    if (!eslintRules.includes("servicenow/require-query-before-next")) {
      fail("runtime", `${cell.id} eslint missed require-query-before-next (${eslintRules.join(", ") || "none"})`);
    }

    writeFileSync(path.join(consumer, "sample.br.js"), 'var rec = new GlideRecord("incident");\nrec.query();\n');
    writeFileSync(
      path.join(consumer, ".oxfmtrc.json"),
      readFileSync(path.join(installed, "oxfmt.recommended.json"), "utf8"),
    );
    try {
      execFileSync(path.join(consumer, "node_modules", ".bin", "oxfmt"), ["-c", ".oxfmtrc.json", "sample.br.js"], {
        encoding: "utf8",
        cwd: consumer,
      });
      execFileSync(
        path.join(consumer, "node_modules", ".bin", "oxfmt"),
        ["-c", ".oxfmtrc.json", "--check", "sample.br.js"],
        { encoding: "utf8", cwd: consumer },
      );
    } catch (error) {
      fail("formatter", `${cell.id} oxfmt failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { id: cell.id, ok: true };
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
}

const cellFlag = process.argv.includes("--cell")
  ? process.argv[process.argv.indexOf("--cell") + 1]
  : process.env.SN_COMPAT_CELL;
const requested = process.argv.includes("--all") || process.env.SN_COMPAT_FULL === "1";
const cells = matrix.cells.filter((cell) => {
  if (cellFlag) return cell.id === cellFlag;
  return requested || cellApplies(cell) || cell.id === "eslint9-current";
});
if (cells.length === 0) {
  fail("runtime", `no compatibility cells selected (cell=${cellFlag ?? "auto"})`);
}

const staging = mkdtempSync(path.join(tmpdir(), "sn-oxc-compat-pack-"));
const results = [];
try {
  const tarball = packTarball(staging);
  for (const cell of cells) {
    console.log(`compat cell ${cell.id} oxlint@${cell.oxlint} eslint@${cell.eslint} oxfmt@${cell.oxfmt}`);
    results.push(await runCell(tarball, cell));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  rmSync(staging, { recursive: true, force: true });
}

console.log(JSON.stringify({ cells: results }, null, 2));
