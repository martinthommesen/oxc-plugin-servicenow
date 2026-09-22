import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lint } from "../helpers/rule-tester.js";

function aliasFixture(count: number): string {
  const lines = ['import { Table } from "@servicenow/sdk";'];
  for (let index = 0; index < count; index += 1) lines.push(`let a${index} = Table;`);
  for (let index = 0; index < count; index += 1) lines.push(`a${index}({ name: "row${index}" });`);
  return `${lines.join("\n")}\n`;
}

function medianMs(source: string): number {
  const samples: number[] = [];
  for (let run = 0; run < 5; run += 1) {
    const start = performance.now();
    lint(source, "require-fluent-id", { filename: "file.now.ts" });
    samples.push(performance.now() - start);
  }
  return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)] ?? 0;
}

// @lat: [[tests#Analysis behavior#Alias resolution scales linearly]]
describe("alias scaling (FINDINGS.md PER-005)", () => {
  it("stays sub-quadratic when aliases and call sites quadruple", () => {
    const small = aliasFixture(100);
    const large = aliasFixture(400);
    lint(small, "require-fluent-id", { filename: "file.now.ts" });
    lint(large, "require-fluent-id", { filename: "file.now.ts" });
    const smallMs = medianMs(small);
    const largeMs = medianMs(large);
    assert.ok(
      largeMs < smallMs * 9,
      `alias scaling regressed: 100 aliases took ${smallMs.toFixed(1)}ms, 400 took ${largeMs.toFixed(1)}ms`,
    );
  });
});
