import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { applyRules, type LintMessage } from "../../src/runtime/apply-rules.js";
import type { RuleName } from "../../src/rules/index.js";
import { parse } from "../helpers/rule-tester.js";

const NOW = "file.now.ts";

/**
 * Rebuild a parsed tree in the shape `typescript-eslint` produces: every
 * node carries `range` and `loc` but no `start`/`end` (FINDINGS.md COR-007).
 */
function toRangeOnly<T>(value: T): T {
  const clone = structuredClone(value);
  const strip = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) strip(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record.start === "number" && typeof record.end === "number") {
      record.range = [record.start, record.end];
      delete record.start;
      delete record.end;
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === "loc" || key === "range") continue;
      strip(child);
    }
  };
  strip(clone);
  return clone;
}

function normalize(messages: LintMessage[]): unknown[] {
  return messages.map(({ ruleId, messageId, message, line, column, endLine, endColumn }) => ({
    ruleId,
    messageId,
    message,
    line,
    column,
    endLine,
    endColumn,
  }));
}

function assertParity(code: string, rule: RuleName): LintMessage[] {
  const parsed = parse(code, NOW);
  const withOffsets = applyRules(code, parsed, { filename: NOW, ruleNames: [rule] });
  const rangeOnly = applyRules(
    code,
    {
      ast: toRangeOnly(parsed.ast),
      comments: parsed.comments.map(({ value, start, end }) => ({
        value,
        range: [start, end] as const,
      })),
    },
    { filename: NOW, ruleNames: [rule] },
  );
  assert.deepEqual(
    normalize(rangeOnly),
    normalize(withOffsets),
    `rule ${rule} diverges between offset-bearing and range-only ASTs`,
  );
  return withOffsets;
}

const ALIAS_CASE = `import { Record } from "@servicenow/sdk/core";
import { helper } from "other";
let F = Record;
F = helper;
F({ table: "incident", name: "Alias" });
`;

const MISSING_ID_CASE = `import { Record } from "@servicenow/sdk/core";
Record({ table: "incident", data: {} });
`;

const ATTACHED_DIRECTIVE_CASE = `import { BusinessRule } from "@servicenow/sdk/core";
// @fluent-ignore
export const demo = 1;
`;

const DANGLING_DIRECTIVE_CASE = `function run() {
  // @fluent-ignore
}
work();
`;

describe("host AST offset portability (FINDINGS.md COR-007)", () => {
  it("resolves aliases identically when nodes carry only ranges", () => {
    const messages = assertParity(ALIAS_CASE, "require-fluent-id");
    assert.equal(messages.length, 0);
  });

  it("reports a missing $id identically when nodes carry only ranges", () => {
    const messages = assertParity(MISSING_ID_CASE, "require-fluent-id");
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.messageId, "missing");
  });

  it("attaches previous-line directives identically when comments carry only ranges", () => {
    const messages = assertParity(ATTACHED_DIRECTIVE_CASE, "fluent-directives");
    assert.equal(messages.length, 0);
  });

  it("locates a dangling directive identically when comments carry only ranges", () => {
    const messages = assertParity(DANGLING_DIRECTIVE_CASE, "fluent-directives");
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.messageId, "dangling");
    assert.ok((messages[0]?.line ?? 0) > 1, "diagnostic must not collapse to line 1");
  });

  it("keeps the other Fluent rules stable on range-only ASTs", () => {
    for (const rule of ["fluent-proper-imports", "fluent-naming-convention"] as const) {
      assertParity(ALIAS_CASE, rule);
      assertParity(MISSING_ID_CASE, rule);
    }
  });

  it("reads AST offsets only through the portable accessors", () => {
    const root = join(import.meta.dirname, "../../src");
    const banned = [
      "{ start?: number }).start",
      "{ end?: number }).end",
      ".node.start",
      ".node.end",
    ];
    const offenders: string[] = [];
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(path);
          continue;
        }
        if (!entry.name.endsWith(".ts") || path.endsWith(join("utils", "ast.ts"))) continue;
        const text = readFileSync(path, "utf8");
        for (const pattern of banned) {
          if (text.includes(pattern)) offenders.push(`${path}: ${pattern}`);
        }
      }
    };
    visit(root);
    assert.deepEqual(
      offenders,
      [],
      "read offsets through nodeStart/nodeEnd/commentOffsets in src/utils/ast.ts",
    );
  });
});
