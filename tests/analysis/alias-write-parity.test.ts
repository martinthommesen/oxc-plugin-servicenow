import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintReshaped, stripOffsets, toRangeOnly } from "../helpers/host-shapes.js";

const FILENAME = "file.now.ts";
const HEAD = 'import { BusinessRule } from "@servicenow/sdk/core";\nfunction local() {}';
const CALL = 'T({ name: "x_test", table: "incident" });';

function lintShape(code: string, reshape?: (ast: unknown) => void): string[] {
  return lintReshaped({ code, filename: FILENAME, rule: "require-fluent-id", reshape }).map(
    (message) => message.messageId ?? message.message,
  );
}

// @lat: [[tests#Analysis behavior#Alias writes resolve identically on every offset shape]]
describe("alias write parity across host offset shapes (FINDINGS.md COR-007)", () => {
  const rebound = `${HEAD}\nlet T = BusinessRule;\nT = local;\n${CALL}`;
  const restored = `${HEAD}\nlet T = local;\nT = BusinessRule;\n${CALL}`;

  it("resolves the latest alias write on a range-only host exactly as on an offset host", () => {
    assert.deepEqual(lintShape(rebound), []);
    assert.deepEqual(lintShape(rebound, toRangeOnly), []);
    assert.deepEqual(lintShape(restored), ["missing"]);
    assert.deepEqual(lintShape(restored, toRangeOnly), ["missing"]);
  });

  it("suppresses the alias fact instead of guessing when nodes carry no offsets", () => {
    assert.deepEqual(lintShape(rebound, stripOffsets), []);
    assert.deepEqual(lintShape(restored, stripOffsets), []);
  });

  it("still resolves an unwritten alias without offsets", () => {
    assert.deepEqual(lintShape(`${HEAD}\nlet T = BusinessRule;\n${CALL}`, stripOffsets), [
      "missing",
    ]);
  });
});
