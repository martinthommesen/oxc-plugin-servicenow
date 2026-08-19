import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import { repoRoot } from "./helpers.js";

function packTarball(): string {
  const stdout = execFileSync("npm", ["pack", "--json"], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  const parsed = JSON.parse(stdout) as Array<{ filename: string }>;
  const filename = parsed[0]?.filename;
  assert.ok(
    typeof filename === "string" && filename.startsWith("oxc-plugin-servicenow-"),
    `unexpected pack output: ${stdout}`,
  );
  return path.join(repoRoot, filename);
}

function listTarball(tarball: string): string[] {
  return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).split("\n").filter(Boolean);
}

describe("packed package consumer", () => {
  it("packs, installs, imports public exports, and lints with oxlint", async () => {
    const tarball = packTarball();
    const files = listTarball(tarball);
    const consumer = mkdtempSync(path.join(tmpdir(), "sn-oxc-pack-"));
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
      execFileSync("npm", ["install", tarball, "oxlint@1.79.0"], {
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
            rules: { "servicenow/no-hardcoded-sysid": "error" },
          },
          null,
          2,
        ),
      );
      writeFileSync(
        path.join(consumer, "bad.br.js"),
        'var assignmentGroup = "97c04b3b1b12100043ab85e5bd0713e2";\n',
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
    } finally {
      rmSync(consumer, { recursive: true, force: true });
      rmSync(tarball, { force: true });
    }
  });
});
