import { describe, it } from "node:test";
import { lint } from "../helpers/rule-tester.js";
import { assertSubQuadratic } from "../helpers/scaling.js";

function aliasFixture(count: number): string {
  const lines = ['import { Table } from "@servicenow/sdk";'];
  for (let index = 0; index < count; index += 1) lines.push(`let a${index} = Table;`);
  for (let index = 0; index < count; index += 1) lines.push(`a${index}({ name: "row${index}" });`);
  return `${lines.join("\n")}\n`;
}

// @lat: [[tests#Analysis behavior#Alias resolution scales linearly]]
describe("alias scaling (FINDINGS.md PER-005)", () => {
  it("stays sub-quadratic when aliases and call sites quadruple", () => {
    const small = aliasFixture(100);
    const large = aliasFixture(400);
    assertSubQuadratic({
      label: "alias scaling",
      smallLabel: "100 aliases",
      largeLabel: "400",
      small: () => void lint(small, "require-fluent-id", { filename: "file.now.ts" }),
      large: () => void lint(large, "require-fluent-id", { filename: "file.now.ts" }),
    });
  });
});
