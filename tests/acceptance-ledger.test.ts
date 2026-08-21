import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  parseCriteria,
  repoFilePath,
  validateMapping,
  validateSnapshot,
} from "../scripts/verify-acceptance-ledger.mjs";
import { repoRoot } from "./integration/helpers.js";

const mapping = JSON.parse(
  readFileSync(path.join(repoRoot, "scripts/pr51-acceptance.json"), "utf8"),
);

describe("PR51 acceptance mapping", () => {
  it("maps every authoritative atomic requirement exactly once", () => {
    assert.equal(mapping.goal.criteria, 533);
    assert.equal(
      mapping.goal.sha256,
      "22f9e1d3d370eaa88001d8c7587f2878b7955a8d9b80922de5848696096a2dc1",
    );
    assert.deepEqual(validateSnapshot(mapping), []);
    assert.equal(
      mapping.criteria.find(
        (item: { source: { heading: string }; owner: { pr: number } }) =>
          item.source.heading === "## 4.1 Central method authority",
      )?.owner.pr,
      79,
    );
  });

  it("rejects missing, duplicate, changed, and orphaned mappings", () => {
    const source = "# Goal\n\n# 1. Requirements\n\n- first\n- second\n";
    const criteria = parseCriteria(source);
    const fixture = {
      goal: { criteria: criteria.length },
      criteria: criteria.map((item) => ({ ...item, disposition: "Pending" })),
    };
    const missing = structuredClone(fixture);
    missing.criteria.pop();
    assert.ok(
      validateMapping(criteria, missing).some((error) => error.startsWith("missing mapping")),
    );

    const duplicate = structuredClone(fixture);
    duplicate.criteria.push(structuredClone(duplicate.criteria[0]!));
    assert.ok(
      validateMapping(criteria, duplicate).some((error) => error.startsWith("duplicate mapping")),
    );

    const changed = structuredClone(fixture);
    changed.criteria[0]!.source.text += " changed";
    assert.ok(
      validateMapping(criteria, changed).some((error) => error.startsWith("changed source")),
    );

    const orphaned = structuredClone(fixture);
    orphaned.criteria[0]!.id = "PR51-ORPHANED";
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
});
