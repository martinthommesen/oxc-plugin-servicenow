import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("performance baseline", () => {
  it("records deterministic fixture sizes and a release threshold", () => {
    const raw = readFileSync(path.join(root, "docs/performance-baseline.json"), "utf8");
    const baseline = JSON.parse(raw) as {
      command: string;
      oxlintPeer: string;
      thresholdMs: number;
      rows: Array<{ size: number; elapsed: number }>;
    };
    assert.equal(baseline.command, "npm run bench");
    assert.equal(baseline.oxlintPeer, ">=1.79.0 <2");
    assert.equal(baseline.thresholdMs, 2000);
    assert.deepEqual(
      baseline.rows.map((row) => row.size),
      [20, 80, 200],
    );
    for (const row of baseline.rows) {
      assert.ok(row.elapsed >= 0);
      assert.ok(row.elapsed < baseline.thresholdMs);
    }
  });
});
