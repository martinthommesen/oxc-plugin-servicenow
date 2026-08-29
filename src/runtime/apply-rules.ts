import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { PLUGIN_NAME } from "../constants.js";
import { rules as allRules } from "../rules/index.js";
import type { RuleName } from "../rules/index.js";
import type { ServiceNowSettings } from "../types.js";
import { fallbackComments, isNode, walk } from "../utils/ast.js";

export interface LintMessage {
  ruleId: string;
  message: string;
  messageId?: string;
  severity: "error" | "warn";
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface LintSourceOptions {
  filename?: string;
  cwd?: string;
  ruleNames?: readonly RuleName[];
  settings?: ServiceNowSettings;
  options?: Partial<Record<RuleName, unknown[]>>;
}

export interface ParsedSource {
  ast: unknown;
  comments?: Array<{ value: string; start: number; end: number }>;
}

function interpolate(
  template: string,
  data?: Record<string, string | number | boolean | bigint | null | undefined>,
): string {
  if (!data) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(data[key] ?? ""));
}

function lineCol(text: string, index: number): { line: number; column: number } {
  const sliced = text.slice(0, Math.max(0, index));
  const lines = sliced.split("\n");
  return { line: lines.length, column: (lines[lines.length - 1] ?? "").length };
}

function locFromNode(
  node: {
    start?: number;
    end?: number;
    loc?: { start: { line: number; column: number }; end?: { line: number; column: number } };
  },
  text: string,
) {
  if (node.loc?.start) {
    return {
      line: node.loc.start.line,
      column: node.loc.start.column,
      endLine: node.loc.end?.line,
      endColumn: node.loc.end?.column,
    };
  }
  const start = typeof node.start === "number" ? node.start : 0;
  const end = typeof node.end === "number" ? node.end : start;
  const a = lineCol(text, start);
  const b = lineCol(text, end);
  return { line: a.line, column: a.column, endLine: b.line, endColumn: b.column };
}

/**
 * Run selected (or all) plugin rules against a pre-parsed ESTree AST.
 *
 * Used by the package test harness, catalog examples, and the documentation
 * playground. This harness is **not authoritative**:
 *
 * - it does not use the host `getScope()` implementation
 * - it does not enforce host JSON-schema before `createOnce`
 * - SourceCode and traversal are emulated
 * - severity is always recorded as `error`
 *
 * Production behavior must be proven with Oxlint and ESLint host tests.
 * Rule-option parsing still uses the same descriptors as the hosts.
 */
export function applyRules(
  source: string,
  parsed: ParsedSource,
  options: LintSourceOptions = {},
): LintMessage[] {
  const filename = options.filename ?? "test.js";
  const selected = options.ruleNames ?? (Object.keys(allRules) as RuleName[]);
  const comments = parsed.comments ?? fallbackComments(source);
  const messages: LintMessage[] = [];
  const ancestors: ESTree.Node[] = [];
  const ancestorIndex = new WeakMap<object, readonly ESTree.Node[]>();
  walk(parsed.ast as ESTree.Node, {}, [], new WeakSet(), ancestorIndex);

  const sourceCode = {
    text: source,
    ast: parsed.ast,
    lines: source.split("\n"),
    getText(node?: { start?: number; end?: number } | null) {
      if (!node || typeof node.start !== "number" || typeof node.end !== "number") return source;
      return source.slice(node.start, node.end);
    },
    getAllComments() {
      return comments;
    },
    getAncestors(node?: unknown) {
      return isNode(node) ? [...(ancestorIndex.get(node) ?? [])] : ancestors.slice(0, -1);
    },
  };

  for (const name of selected) {
    const rule = allRules[name] as Rule | undefined;
    if (!rule) continue;
    const createOnce = "createOnce" in rule ? rule.createOnce : undefined;
    const create = "create" in rule ? rule.create : undefined;
    if (!createOnce && !create) continue;

    const context = {
      id: `${PLUGIN_NAME}/${name}`,
      filename,
      physicalFilename: filename,
      cwd: options.cwd ?? "/",
      options: options.options?.[name] ?? [],
      settings: { servicenow: options.settings ?? {} },
      sourceCode,
      getFilename: () => filename,
      getSourceCode: () => sourceCode,
      report(diagnostic: {
        message?: string | null;
        messageId?: string | null;
        node?: {
          start?: number;
          end?: number;
          loc?: { start: { line: number; column: number }; end?: { line: number; column: number } };
        };
        loc?: { start: { line: number; column: number }; end?: { line: number; column: number } };
        data?: Record<string, string | number | boolean | bigint | null | undefined>;
      }) {
        const meta = rule.meta as { messages?: Record<string, string> } | undefined;
        const template =
          diagnostic.message ??
          (diagnostic.messageId && meta?.messages
            ? meta.messages[diagnostic.messageId]
            : undefined) ??
          diagnostic.messageId ??
          "violation";
        const loc = diagnostic.loc
          ? {
              line: diagnostic.loc.start.line,
              column: diagnostic.loc.start.column,
              endLine: diagnostic.loc.end?.line,
              endColumn: diagnostic.loc.end?.column,
            }
          : diagnostic.node
            ? locFromNode(diagnostic.node, source)
            : { line: 1, column: 0 };
        const ruleId = `${PLUGIN_NAME}/${name}`;
        messages.push({
          ruleId,
          message: interpolate(template, diagnostic.data ?? undefined),
          messageId: diagnostic.messageId ?? undefined,
          severity: "error",
          ...loc,
        });
      },
    } as unknown as Context;

    const visitors = createOnce ? createOnce.call(rule, context) : create!(context);
    if (!visitors) continue;
    const hooks = visitors as { before?: () => boolean | void; after?: () => void };
    if (hooks.before?.() === false) continue;

    walk(
      parsed.ast as ESTree.Node,
      visitors as Record<string, ((node: ESTree.Node) => void) | undefined>,
      ancestors,
    );

    hooks.after?.();
  }

  return messages;
}

export function isEstreeNode(value: unknown): value is ESTree.Node {
  return isNode(value);
}
