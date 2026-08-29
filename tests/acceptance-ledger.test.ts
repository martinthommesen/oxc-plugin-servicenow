import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  parseCriteria,
  repoFilePath,
  validateMapping,
} from "../scripts/verify-acceptance-ledger.mjs";
import { repoRoot } from "./integration/helpers.js";

const source = readFileSync(path.join(repoRoot, "PR51-REMEDIATION-GOAL.md"), "utf8");
const mapping = JSON.parse(
  readFileSync(path.join(repoRoot, "scripts/pr51-acceptance.json"), "utf8"),
);
const layers = readFileSync(path.join(repoRoot, "docs/pr-51-layers.md"), "utf8");

describe("PR51 acceptance mapping", () => {
  it("maps every authoritative atomic requirement exactly once", () => {
    const criteria = parseCriteria(source);
    assert.equal(criteria.length, 533);
    assert.equal(new Set(criteria.map((item) => item.id)).size, criteria.length);
    assert.equal(mapping.goal.criteria, criteria.length);
    assert.equal(mapping.goal.sha256, createHash("sha256").update(source).digest("hex"));
    assert.deepEqual(validateMapping(criteria, mapping), []);
    assert.equal(
      criteria.find((item) => item.source.heading === "## 4.1 Central method authority")?.owner.pr,
      79,
    );
  });

  it("rejects missing, duplicate, changed, and orphaned mappings", () => {
    const criteria = parseCriteria(source);
    const missing = structuredClone(mapping);
    missing.criteria.pop();
    assert.ok(
      validateMapping(criteria, missing).some((error) => error.startsWith("missing mapping")),
    );

    const duplicate = structuredClone(mapping);
    duplicate.criteria.push(structuredClone(duplicate.criteria[0]));
    assert.ok(
      validateMapping(criteria, duplicate).some((error) => error.startsWith("duplicate mapping")),
    );

    const changed = structuredClone(mapping);
    changed.criteria[0].source.text += " changed";
    assert.ok(
      validateMapping(criteria, changed).some((error) => error.startsWith("changed source")),
    );

    const orphaned = structuredClone(mapping);
    orphaned.criteria[0].id = "PR51-ORPHANED";
    assert.ok(
      validateMapping(criteria, orphaned).some((error) => error.startsWith("orphaned mapping")),
    );
  });

  it("keeps fixture reads inside the repository", () => {
    assert.equal(repoFilePath("tests/acceptance-ledger.test.ts"), import.meta.filename);
    for (const unsafe of ["../outside", "/tmp/outside", "folder\\outside", ""]) {
      assert.throws(() => repoFilePath(unsafe), /unsafe repository path/);
    }
  });

  it("assigns reviewed source paths to one historical layer", () => {
    assert.match(
      layers,
      /\| `src\/analysis\/` except `src\/analysis\/now-id\.ts` and `src\/analysis\/fluent-imports\.ts` \| 2 \|/,
    );
    assert.match(
      layers,
      /\| `src\/fluent\/`, Fluent rules, `src\/analysis\/now-id\.ts`, `src\/analysis\/fluent-imports\.ts` \| 4 \|/,
    );
    assert.match(
      layers,
      /\| `src\/catalog\.ts`, `src\/catalog-metadata\.ts`, `docs\/rules\/`, `scripts\/generate-rule-docs\.mjs`, `scripts\/check-catalog-docs\.mjs` \| 5 \|/,
    );
    assert.doesNotMatch(layers, /\| `src\/analysis\/` \| 2 \|/);
    assert.doesNotMatch(layers, /\*\*Owns:\*\*[^\n]*`src\/catalog\.ts`[^\n]*\n[\s\S]*?## Layer 2/);
  });
});
