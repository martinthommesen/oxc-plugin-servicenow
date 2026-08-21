import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { FLUENT_DIRECTIVE_TYPOS, ruleDocsUrl } from "../constants.js";
import { knownDirectiveNames } from "../fluent/index.js";
import { isFluentContext } from "../context/index.js";
import { isNode, walk } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

const DIRECTIVE = /@([A-Za-z][\w-]*)/g;
const TS_DIRECTIVE = /@ts-(?:ignore|expect-error)\b/g;

interface Comment {
  value: string;
  start: number;
  end: number;
}

interface StatementRef {
  start: number;
  end: number;
  line: number;
}

interface StatementContainer {
  start: number;
  end: number;
  statements: StatementRef[];
}

interface Occurrence {
  loc: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

function commentsOf(context: { sourceCode: { getAllComments?: () => Comment[] } }): Comment[] {
  return typeof context.sourceCode.getAllComments === "function"
    ? context.sourceCode.getAllComments()
    : [];
}

function firstNonEmptyLine(text: string): number {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = body.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]!.trim().length > 0) return index + 1;
  }
  return 1;
}

function pointAt(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, offset));
  const newline = before.lastIndexOf("\n");
  return { line: before.split("\n").length, column: before.length - newline - 1 };
}

function occurrenceAt(comment: Comment, text: string, index: number, length: number): Occurrence {
  const start = comment.start + 2 + index;
  return { loc: { start: pointAt(text, start), end: pointAt(text, start + length) } };
}

function nodeRange(node: ESTree.Node, text: string): StatementRef | null {
  const start = (node as { start?: number }).start;
  const end = (node as { end?: number }).end;
  if (typeof start !== "number" || typeof end !== "number") return null;
  const line = (node as { loc?: { start?: { line?: number } } }).loc?.start?.line;
  return { start, end, line: typeof line === "number" ? line : pointAt(text, start).line };
}

function statementRefs(nodes: readonly ESTree.Node[], text: string): StatementRef[] {
  return nodes.flatMap((node) => {
    const range = nodeRange(node, text);
    return range ? [range] : [];
  });
}

function collectStatementContainers(program: ESTree.Node, text: string): StatementContainer[] {
  const containers: StatementContainer[] = [];
  const add = (owner: ESTree.Node, statements: readonly ESTree.Node[]): void => {
    const range = nodeRange(owner, text);
    if (range) containers.push({ ...range, statements: statementRefs(statements, text) });
  };
  const addBody = (owner: ESTree.Node, body: unknown): void => {
    if (isNode(body) && body.type !== "BlockStatement") add(owner, [body]);
  };

  walk(program, {
    Program(node) {
      containers.push({
        start: 0,
        end: text.length,
        statements: statementRefs((node as ESTree.Program).body, text),
      });
    },
    BlockStatement(node) {
      add(node, (node as ESTree.BlockStatement).body);
    },
    SwitchCase(node) {
      add(node, (node as ESTree.SwitchCase).consequent);
    },
    IfStatement(node) {
      const statement = node as ESTree.IfStatement;
      addBody(node, statement.consequent);
      addBody(node, statement.alternate);
    },
    ForStatement(node) {
      addBody(node, (node as ESTree.ForStatement).body);
    },
    ForInStatement(node) {
      addBody(node, (node as ESTree.ForInStatement).body);
    },
    ForOfStatement(node) {
      addBody(node, (node as ESTree.ForOfStatement).body);
    },
    WhileStatement(node) {
      addBody(node, (node as ESTree.WhileStatement).body);
    },
    DoWhileStatement(node) {
      addBody(node, (node as ESTree.DoWhileStatement).body);
    },
    LabeledStatement(node) {
      addBody(node, (node as ESTree.LabeledStatement).body);
    },
    WithStatement(node) {
      addBody(node, (node as ESTree.WithStatement).body);
    },
  });
  return containers;
}

function containingStatementList(
  containers: readonly StatementContainer[],
  comment: Comment,
): StatementContainer | undefined {
  return containers
    .filter((container) => container.start <= comment.start && comment.end <= container.end)
    .sort((left, right) => left.end - left.start - (right.end - right.start))
    .find(
      (container) =>
        !container.statements.some(
          (statement) => statement.start < comment.start && comment.end < statement.end,
        ),
    );
}

function isExactPreviousLine(
  text: string,
  comment: Comment,
  next: StatementRef,
  occurrence: Occurrence,
): boolean {
  return (
    occurrence.loc.start.line === next.line - 1 &&
    /^(?:\r?\n)[\t ]*$/.test(text.slice(comment.end, next.start))
  );
}

export const fluentDirectives = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Validate ServiceNow Fluent directives (`@fluent-ignore`, `@fluent-disable-sync`, `@fluent-disable-sync-for-file`) and catch typos. Previous-line directives attach to the next statement.",
      url: ruleDocsUrl("fluent-directives"),
    },
    schema: [],
    messages: {
      unknown: "Unknown Fluent directive `@{{name}}`. Supported directives: {{supported}}.",
      typo: "Unknown Fluent directive `@{{name}}`. Did you mean `@{{suggestion}}`?",
      dangling:
        "`@{{name}}` has no following statement to suppress. Place it on the line immediately above the diagnostic.",
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
        const byName = new Map(file.fluent.manifest.directives.map((item) => [item.name, item]));
        const supported = file.fluent.manifest.directives.map((item) => `@${item.name}`).join(", ");
        const containers = collectStatementContainers(node as ESTree.Node, text);

        for (const comment of comments) {
          TS_DIRECTIVE.lastIndex = 0;
          let tsMatch: RegExpExecArray | null;
          while ((tsMatch = TS_DIRECTIVE.exec(comment.value))) {
            context.report({
              loc: occurrenceAt(comment, text, tsMatch.index, tsMatch[0].length).loc,
              messageId: "tsIgnore",
            });
          }

          DIRECTIVE.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = DIRECTIVE.exec(comment.value))) {
            const name = match[1];
            if (!name || !name.startsWith("fluent-")) continue;
            const occurrence = occurrenceAt(comment, text, match.index, match[0].length);
            const directive = byName.get(name);

            if (known.has(name) && directive) {
              if (directive.placement === "previous-line") {
                const container = containingStatementList(containers, comment);
                const next = container?.statements.find(
                  (statement) => statement.start >= comment.end,
                );
                if (!next) {
                  context.report({ loc: occurrence.loc, messageId: "dangling", data: { name } });
                } else if (!isExactPreviousLine(text, comment, next, occurrence)) {
                  context.report({ loc: occurrence.loc, messageId: "misplaced", data: { name } });
                }
              } else if (
                directive.placement === "first-line" &&
                occurrence.loc.start.line !== firstNonEmptyLine(text)
              ) {
                context.report({ loc: occurrence.loc, messageId: "firstLine" });
              }
              continue;
            }

            const suggestion = file.fluent.manifest.typos[name] ?? FLUENT_DIRECTIVE_TYPOS[name];
            if (suggestion) {
              context.report({
                loc: occurrence.loc,
                messageId: "typo",
                data: { name, suggestion },
              });
            } else {
              context.report({
                loc: occurrence.loc,
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
