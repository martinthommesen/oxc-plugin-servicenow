import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GENERATED_ARTIFACT_PATHS,
  MARKED_SECTION_NAMES,
  replaceMarkedSection,
} from "../scripts/lib/generated-artifacts.mjs";

// @lat: [[tests#Scripts and tooling#Generated artifacts share one manifest]]
describe("generated artifact manifest", () => {
  it("covers every generated documentation family", () => {
    for (const path of [
      "src/version.ts",
      "docs/rules",
      "README.md",
      "docs/compatibility.md",
      "docs/australia-engine-updates.md",
      "examples",
      "tests/integration/profiles/mixed/.oxlintrc.json",
    ]) {
      assert.ok(GENERATED_ARTIFACT_PATHS.includes(path), path);
    }
    assert.deepEqual(MARKED_SECTION_NAMES, [
      "classic-rules",
      "engine-rules",
      "fluent-rules",
      "migration-1.1-to-2.0",
      "repository-links",
      "compatibility",
    ]);
  });

  it("replaces only registered marked sections", () => {
    assert.equal(
      replaceMarkedSection(
        "before\n<!-- generated:compatibility:start -->old<!-- generated:compatibility:end -->\nafter",
        "compatibility",
        "new",
      ),
      "before\n<!-- generated:compatibility:start -->\nnew\n<!-- generated:compatibility:end -->\nafter",
    );
    assert.throws(() => replaceMarkedSection("", "unknown", "new"), /Unknown generated section/);
  });
});
