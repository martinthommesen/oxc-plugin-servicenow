import assert from "node:assert/strict";
import { parseSync } from "oxc-parser";
import {
  applyRules,
  type LintMessage,
  type LintSourceOptions,
} from "../../src/runtime/apply-rules.js";
import type { RuleName } from "../../src/rules/index.js";
import type { ServiceNowSettings } from "../../src/types.js";

export const ES5: ServiceNowSettings = { javascriptMode: "es5" };
export const ES2021: ServiceNowSettings = { javascriptMode: "es2021" };

const CLIENT_RULES = new Set<RuleName>([
  "no-client-gliderecord",
  "no-glideajax-getanswer",
  "require-glideajax-sysparm-name",
  "require-callback-for-getreference",
  "no-sync-glideajax",
]);

function defaultFilename(rule: RuleName): string {
  if (
    rule.startsWith("fluent") ||
    rule.startsWith("prefer-now") ||
    rule.startsWith("require-fluent") ||
    rule.startsWith("no-complex") ||
    rule === "no-now-id-as-reference" ||
    rule === "no-duplicate-fluent-id"
  ) {
    return "file.now.ts";
  }
  if (CLIENT_RULES.has(rule)) return "test.client.js";
  return "src/server/test.js";
}

export interface RunOptions extends LintSourceOptions {
  filename?: string;
}

export function parse(code: string, filename = "test.js") {
  const lang = filename.endsWith(".ts") || filename.endsWith(".tsx") ? "ts" : "js";
  const result = parseSync(filename, code, { sourceType: "module", lang });
  return {
    ast: result.program,
    comments: (result.comments ?? []).map((comment) => ({
      value: comment.value,
      start: comment.start,
      end: comment.end,
    })),
  };
}

export function lint(code: string, rule: RuleName, options: RunOptions = {}): LintMessage[] {
  const filename = options.filename ?? defaultFilename(rule);
  const parsed = parse(code, filename);
  return applyRules(code, parsed, { ...options, filename, ruleNames: [rule] });
}

export function assertValid(code: string, rule: RuleName, options: RunOptions = {}): void {
  const messages = lint(code, rule, options);
  assert.equal(
    messages.length,
    0,
    `Expected no diagnostics, got:\n${messages.map((m) => `  - ${m.message}`).join("\n")}`,
  );
}

export function assertInvalid(
  code: string,
  rule: RuleName,
  expected: { messageId?: string; count?: number; includes?: string } = {},
  options: RunOptions = {},
): LintMessage[] {
  const messages = lint(code, rule, options);
  const count = expected.count ?? 1;
  assert.equal(
    messages.length,
    count,
    `Expected exactly ${count} diagnostic(s), got ${messages.length}:\n${messages.map((m) => `  - ${m.messageId ?? "?"} ${m.message}`).join("\n")}`,
  );
  if (expected.messageId) {
    assert.ok(
      messages.some((m) => m.messageId === expected.messageId),
      `Expected messageId ${expected.messageId}, got ${messages.map((m) => m.messageId).join(", ")}`,
    );
  }
  if (expected.includes) {
    assert.ok(
      messages.some((m) => m.message.includes(expected.includes!)),
      `Expected a message containing ${JSON.stringify(expected.includes)}`,
    );
  }
  return messages;
}
