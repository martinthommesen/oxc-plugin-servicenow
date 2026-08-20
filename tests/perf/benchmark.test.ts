import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pluginRulesFor, repoRoot, runOxlint } from "../integration/helpers.js";

const recommendedConfig = path.join(
  repoRoot,
  "tests/integration/profiles/configs/recommended.oxlintrc.json",
);

describe("real oxlint performance smoke", () => {
  it("lints a branch-heavy fixture through oxlint in under two seconds", () => {
    const file = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../integration/profiles/valid/noop-join.br.js",
    );
    const started = Date.now();
    const report = runOxlint(recommendedConfig, [file]);
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 2000, `oxlint took ${elapsed}ms`);
    assert.deepEqual(pluginRulesFor(report), []);
  });
});
