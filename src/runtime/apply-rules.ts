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
  /** Source after applying the diagnostic's own fix, if it provided one. */
  fixedSource?: string;
  suggestions?: Array<{ desc: string; fixedSource: string }>;
}

type FixEdit = { range: [number, number]; text: string };

const fixer = {
  replaceText: (n: { start?: number; end?: number }, text: string) => ({
    range: [n.start ?? 0, n.end ?? 0] as [number, number],
    text,
  }),
  replaceTextRange: (range: [number, number], text: string) => ({ range, text }),
  insertTextBefore: (n: { start?: number }, text: string) => ({
    range: [n.start ?? 0, n.start ?? 0] as [number, number],
    text,
  }),
  insertTextAfter: (n: { end?: number }, text: string) => ({
    range: [n.end ?? 0, n.end ?? 0] as [number, number],
    text,
  }),
  remove: (n: { start?: number; end?: number }) => ({
    range: [n.start ?? 0, n.end ?? 0] as [number, number],
    text: "",
  }),
};

function applyFixes(
  source: string,
  raw: FixEdit | FixEdit[] | null | undefined,
  ruleId: string,
): string | undefined {
  if (raw == null) return undefined;
  const edits = Array.isArray(raw) ? raw : [raw];
  if (edits.length === 0) return undefined;
  const sorted = edits.slice().sort((a, b) => b.range[0] - a.range[0] || b.range[1] - a.range[1]);
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    for (let j = i + 1; j < sorted.length; j++) {
      const other = sorted[j]!;
      if (current.range[0] < other.range[1] && other.range[0] < current.range[1]) {
        throw new Error(
          `${ruleId}: overlapping fix ranges ${JSON.stringify(current.range)} and ${JSON.stringify(other.range)}`,
        );
      }
    }
  }
  let result = source;
  for (const edit of sorted) {
    result = result.slice(0, edit.range[0]) + edit.text + result.slice(edit.range[1]);
  }
  return result;
}

export interface LintSourceOptions {
  filename?: string;
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
 * Used by the package test harness and by the documentation playground.
 * This is **not** a substitute for oxlint — it exists so rules can be unit
 * tested without the native oxlint binary.
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
    getAncestors(_node?: unknown) {
      return ancestors.slice(0, -1);
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
      cwd: "/",
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
        fix?: (f: typeof fixer) => FixEdit | FixEdit[] | null | undefined;
        suggest?: Array<{
          desc: string;
          fix: (f: typeof fixer) => FixEdit | FixEdit[] | null | undefined;
        }>;
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
        let fixedSource: string | undefined;
        let suggestions: Array<{ desc: string; fixedSource: string }> | undefined;
        try {
          if (diagnostic.fix) {
            fixedSource = applyFixes(source, diagnostic.fix(fixer), ruleId);
          }
          if (diagnostic.suggest) {
            suggestions = diagnostic.suggest.map((item) => ({
              desc: item.desc,
              fixedSource: applyFixes(source, item.fix(fixer), ruleId) ?? source,
            }));
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new Error(`fixer failed for ${ruleId}: ${detail}`, { cause: error });
        }
        messages.push({
          ruleId,
          message: interpolate(template, diagnostic.data ?? undefined),
          messageId: diagnostic.messageId ?? undefined,
          severity: "error",
          ...loc,
          fixedSource,
          suggestions,
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
