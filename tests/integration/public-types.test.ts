import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { repoRoot } from "./helpers.js";

// @lat: [[tests#Release governance#Strict consumers distinguish omitted settings from undefined]]
describe("strict public declaration consumer", () => {
  it("compiles immutable context and omission-based settings through package exports", () => {
    const consumer = mkdtempSync(path.join(tmpdir(), "sn-public-types-"));
    try {
      const modules = path.join(consumer, "node_modules");
      const installed = path.join(modules, "oxc-plugin-servicenow");
      mkdirSync(installed, { recursive: true });
      cpSync(path.join(repoRoot, "dist"), path.join(installed, "dist"), { recursive: true });
      cpSync(path.join(repoRoot, "package.json"), path.join(installed, "package.json"));
      symlinkSync(path.join(repoRoot, "node_modules/@oxlint"), path.join(modules, "@oxlint"));
      writeFileSync(
        path.join(consumer, "package.json"),
        JSON.stringify({ private: true, type: "module" }),
      );
      writeFileSync(
        path.join(consumer, "consumer.ts"),
        `
import type { ApplicationScope, ContextSourceMap, ReadonlyServiceNowSettings, ServiceNowScriptContext, ServiceNowSettings } from "oxc-plugin-servicenow";
import type { ContextSourceMap as AnalysisSources, ServiceNowScriptContext as AnalysisContext } from "oxc-plugin-servicenow/analysis";
declare const context: ServiceNowScriptContext;
declare const analysis: AnalysisContext;
declare const scope: ApplicationScope | undefined;
const omitted: ServiceNowSettings = {};
const readonlyOmitted: ReadonlyServiceNowSettings = {};
const conditional: ServiceNowSettings = scope === undefined ? {} : { scope };
const sources: ContextSourceMap = context.sources;
const analysisSources: AnalysisSources = analysis.sources;
// @ts-expect-error Optional settings accept omission, not explicit undefined.
const explicitUndefined: ServiceNowSettings = { scope: undefined };
// @ts-expect-error The readonly authored view has the same optional value contract.
const readonlyUndefined: ReadonlyServiceNowSettings = { scope: undefined };
// @ts-expect-error Root-exported contexts are frozen.
context.scope = "global";
// @ts-expect-error Root-exported source maps are frozen.
sources.scope = "explicit";
// @ts-expect-error Analysis-exported contexts are frozen.
analysis.scope = "global";
// @ts-expect-error Analysis-exported source maps are frozen.
analysisSources.scope = "explicit";
const local = { ...context, sources: { ...context.sources } };
local.scope = "global";
local.sources.scope = "explicit";
void [omitted, readonlyOmitted, conditional, explicitUndefined, readonlyUndefined, local];
`,
      );
      writeFileSync(
        path.join(consumer, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            module: "NodeNext",
            moduleResolution: "NodeNext",
            lib: ["ES2023"],
            strict: true,
            exactOptionalPropertyTypes: true,
            noEmit: true,
            skipLibCheck: false,
          },
          include: ["consumer.ts"],
        }),
      );
      const result = spawnSync(
        path.join(repoRoot, "node_modules/.bin/tsc"),
        ["-p", "tsconfig.json"],
        {
          cwd: consumer,
          encoding: "utf8",
        },
      );
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    } finally {
      rmSync(consumer, { recursive: true, force: true });
    }
  });
});
