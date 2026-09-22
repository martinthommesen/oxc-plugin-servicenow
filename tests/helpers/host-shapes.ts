import type { RuleName } from "../../src/rules/index.js";
import { applyRules, type LintMessage } from "./apply-rules.js";
import { parse } from "./rule-tester.js";

/**
 * Models a host adapter that supplies `range` (and `loc`) but neither `start`
 * nor `end`, as typescript-eslint and range-only Espree configurations do.
 */
export function toRangeOnly(value: unknown, seen = new Set<object>()): void {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) toRangeOnly(item, seen);
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record["start"] === "number" && typeof record["end"] === "number") {
    record["range"] = [record["start"], record["end"]];
  }
  delete record["start"];
  delete record["end"];
  for (const key of Object.keys(record)) {
    if (key === "loc") continue;
    toRangeOnly(record[key], seen);
  }
}

/**
 * Strips every offset shape `nodeStart()` understands while keeping `loc`, so
 * the AST models a host adapter that supplies no byte offsets at all and
 * execution order between a write and its use is genuinely unknown.
 */
export function stripOffsets(value: unknown, seen = new Set<object>()): void {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) stripOffsets(item, seen);
    return;
  }
  const record = value as Record<string, unknown>;
  delete record["start"];
  delete record["end"];
  delete record["range"];
  delete record["span"];
  for (const key of Object.keys(record)) {
    if (key === "loc") continue;
    stripOffsets(record[key], seen);
  }
}

/**
 * Parses `code`, lets `reshape` rewrite the AST into one host offset shape,
 * and lints a single rule over the result.
 */
export function lintReshaped(options: {
  readonly code: string;
  readonly filename: string;
  readonly rule: RuleName;
  readonly reshape?: ((ast: unknown) => void) | undefined;
}): LintMessage[] {
  const parsed = parse(options.code, options.filename);
  options.reshape?.(parsed.ast);
  return applyRules(options.code, parsed, {
    filename: options.filename,
    ruleNames: [options.rule],
  });
}
