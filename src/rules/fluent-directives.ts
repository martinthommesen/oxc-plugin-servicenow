import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { FLUENT_DIRECTIVE_TYPOS, ruleDocsUrl } from "../constants.js";
import { fallbackComments } from "../utils/ast.js";
import { knownDirectiveNames } from "../fluent/index.js";
import { isFluentContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

const DIRECTIVE = /@([A-Za-z][\w-]*)/g;

interface Comment {
  value: string;
  start: number;
  end: number;
  loc?: { start: { line: number; column?: number }; end: { line: number } };
}

function commentsOf(context: {
  sourceCode: { getAllComments?: () => Comment[]; text: string };
}): Comment[] {
  if (typeof context.sourceCode.getAllComments === "function") {
    return context.sourceCode.getAllComments();
  }
  return fallbackComments(context.sourceCode.text);
}

function stripBom(text: string): { text: string; bom: number } {
  if (text.charCodeAt(0) === 0xfeff) return { text: text.slice(1), bom: 1 };
  return { text, bom: 0 };
}

function firstNonEmptyLine(text: string): number {
  const { text: body } = stripBom(text);
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim().length > 0) return i + 1;
  }
  return 1;
}

function programStatements(program: ESTree.Node): Array<{ start: number; end: number }> {
  if (program.type !== "Program") return [];
  const found: Array<{ start: number; end: number }> = [];
  for (const statement of (program as ESTree.Program).body) {
    const start = (statement as { start?: number }).start;
    const end = (statement as { end?: number }).end;
    if (typeof start === "number" && typeof end === "number") {
      found.push({ start, end });
    }
  }
  return found;
}

function nextStatementAfter(
  statements: Array<{ start: number; end: number }>,
  offset: number,
): { start: number; end: number } | undefined {
  return statements.find((statement) => statement.start >= offset);
}

function onlyTriviaBetween(text: string, from: number, to: number, comments: Comment[]): boolean {
  let cursor = from;
  const ordered = [...comments].sort((left, right) => left.start - right.start);
  for (const comment of ordered) {
    if (comment.end <= from || comment.start >= to) continue;
    if (comment.start < cursor) continue;
    if (text.slice(cursor, comment.start).trim().length > 0) return false;
    cursor = comment.end;
  }
  return text.slice(cursor, to).trim().length === 0;
}

export const fluentDirectives = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Validate ServiceNow Fluent directives (`@fluent-ignore`, `@fluent-disable-sync`, `@fluent-disable-sync-for-file`) and catch typos. Previous-line directives attach to the next statement.",
      url: ruleDocsUrl("fluent-directives"),
    },
    messages: {
      unknown:
        "Unknown Fluent directive `@{{name}}`. Supported directives: {{supported}}.",
      typo: "Unknown Fluent directive `@{{name}}`. Did you mean `@{{suggestion}}`?",
      dangling:
        "`@fluent-ignore` has no following statement to suppress. Place it on the line immediately above the diagnostic.",
      misplaced:
        "`@{{name}}` is not attached to the immediately following statement. Place it on the previous line of that statement.",
      tsIgnore:
        "`@ts-ignore` does not suppress Fluent diagnostics. Use `@fluent-ignore` on the previous line.",
      firstLine:
        "`@fluent-disable-sync-for-file` applies to the whole file and must be on the first non-empty line after an optional BOM.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
      },
      Program(node) {
        const { file } = beginRuleFile(context);
        const comments = commentsOf(context);
        const text = context.sourceCode.text;
        const known = knownDirectiveNames(file.fluent.manifest);
        const supported = file.fluent.manifest.directives.map((item) => `@${item.name}`).join(", ");
        const statements = programStatements(node as ESTree.Node);

        for (const comment of comments) {
          const value = comment.value;
          if (/@ts-ignore\b/.test(value) || /@ts-expect-error\b/.test(value)) {
            context.report({
              loc: locOf(comment, text),
              messageId: "tsIgnore",
            });
          }

          DIRECTIVE.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = DIRECTIVE.exec(value))) {
            const name = match[1];
            if (!name || !name.startsWith("fluent-")) continue;
            const loc = locOfMatch(comment, text, match.index ?? 0);

            if (known.has(name)) {
              if (name === "fluent-ignore" || name === "fluent-disable-sync") {
                const next = nextStatementAfter(statements, comment.end);
                if (!next) {
                  context.report({ loc, messageId: "dangling" });
                } else if (!onlyTriviaBetween(text, comment.end, next.start, comments)) {
                  context.report({ loc, messageId: "misplaced", data: { name } });
                }
              }
              if (name === "fluent-disable-sync-for-file") {
                const line = locOf(comment, text).start.line;
                if (line !== firstNonEmptyLine(text)) {
                  context.report({ loc, messageId: "firstLine" });
                }
              }
              continue;
            }

            const suggestion = file.fluent.manifest.typos[name] ?? FLUENT_DIRECTIVE_TYPOS[name];
            if (suggestion) {
              context.report({
                loc,
                messageId: "typo",
                data: { name, suggestion },
              });
            } else {
              context.report({
                loc,
                messageId: "unknown",
                data: { name, supported },
              });
            }
          }
        }
      },
    };
  },
});

function locOf(comment: Comment, text: string) {
  if (comment.loc) {
    const start = comment.loc.start;
    return { start: { line: start.line, column: start.column ?? 0 } };
  }
  const before = text.slice(0, comment.start);
  const line = before.split("\n").length;
  const lastNl = before.lastIndexOf("\n");
  const column = comment.start - (lastNl + 1);
  return { start: { line, column } };
}

function locOfMatch(comment: Comment, text: string, matchIndex: number) {
  const base = locOf(comment, text);
  const prefix = comment.value.slice(0, matchIndex);
  const extraLines = prefix.split(/\r?\n/).length - 1;
  const lastNl = prefix.lastIndexOf("\n");
  const extraCols = lastNl === -1 ? matchIndex : matchIndex - (lastNl + 1);
  return {
    start: {
      line: base.start.line + extraLines,
      column: extraLines === 0 ? base.start.column + extraCols : extraCols,
    },
  };
}
