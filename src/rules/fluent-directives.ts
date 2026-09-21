import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { knownDirectiveNames } from "../fluent/index.js";
import { isFluentContext } from "../context/index.js";
import { hostComments, isNode, nodeEnd, nodeStart, walk, type HostComment } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

const DIRECTIVE = /@([A-Za-z][\w-]*)/g;
const TS_DIRECTIVE = /@ts-(?:ignore|expect-error)\b/g;

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

function firstNonEmptyLine(text: string): number {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = body.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]!.trim().length > 0) return index + 1;
  }
  return 1;
}

/** Offsets where each line starts, plus the end of the file. */
interface LineIndex {
  readonly starts: readonly number[];
  readonly end: number;
}

function lineIndex(text: string): LineIndex {
  const starts = [0];
  for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) {
    starts.push(index + 1);
  }
  return { starts, end: text.length };
}

/** 1-based line and 0-based column, by binary search over the line starts. */
function pointAt(lines: LineIndex, offset: number): { line: number; column: number } {
  const target = Math.min(Math.max(0, offset), lines.end);
  let low = 0;
  let high = lines.starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (lines.starts[mid]! <= target) low = mid;
    else high = mid - 1;
  }
  return { line: low + 1, column: target - lines.starts[low]! };
}

function occurrenceAt(
  comment: HostComment,
  lines: LineIndex,
  index: number,
  length: number,
): Occurrence {
  const start = comment.start + 2 + index;
  return { loc: { start: pointAt(lines, start), end: pointAt(lines, start + length) } };
}

function nodeRange(node: ESTree.Node, lines: LineIndex): StatementRef | null {
  const start = nodeStart(node);
  const end = nodeEnd(node);
  if (start === -1 || end === -1) return null;
  const line = (node as { loc?: { start?: { line?: number } } }).loc?.start?.line;
  return { start, end, line: typeof line === "number" ? line : pointAt(lines, start).line };
}

function statementRefs(nodes: readonly ESTree.Node[], lines: LineIndex): StatementRef[] {
  return nodes.flatMap((node) => {
    const range = nodeRange(node, lines);
    return range ? [range] : [];
  });
}

function collectStatementContainers(program: ESTree.Node, lines: LineIndex): StatementContainer[] {
  const containers: StatementContainer[] = [];
  const add = (owner: ESTree.Node, statements: readonly ESTree.Node[]): void => {
    const range = nodeRange(owner, lines);
    if (range) containers.push({ ...range, statements: statementRefs(statements, lines) });
  };
  const addBody = (owner: ESTree.Node, body: unknown): void => {
    if (isNode(body) && body.type !== "BlockStatement") add(owner, [body]);
  };

  walk(program, {
    Program(node) {
      containers.push({
        start: 0,
        end: lines.end,
        statements: statementRefs((node as ESTree.Program).body, lines),
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
  comment: HostComment,
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
  comment: HostComment,
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
        "Validate documented ServiceNow Fluent SDK directive names and placement. SDK directives are not Oxlint or ESLint disable comments.",
      url: ruleDocsUrl("fluent-directives"),
    },
    schema: [],
    messages: {
      unknown: "Unknown Fluent directive `@{{name}}`. Supported directives: {{supported}}.",
      typo: "Unknown Fluent directive `@{{name}}`. Did you mean `@{{suggestion}}`?",
      dangling:
        "`@{{name}}` has no following statement for the Fluent SDK to act on. Place it immediately above its target statement.",
      misplaced:
        "`@{{name}}` is not attached to its target statement. Place it on the line immediately before that statement.",
      tsIgnore:
        "`@{{name}}` is a TypeScript compiler directive, not a ServiceNow Fluent SDK directive or an Oxlint/ESLint disable comment.",
      firstLine:
        "`@fluent-disable-sync-for-file` applies to the whole file and must be on the first non-empty line after an optional BOM.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
        return undefined;
      },
      Program(node) {
        const file = beginRuleFile(context);
        const text = context.sourceCode.text;
        const comments = hostComments(context, text);
        const known = knownDirectiveNames(file.fluent.manifest);
        const byName = new Map(file.fluent.manifest.directives.map((item) => [item.name, item]));
        const supported = file.fluent.manifest.directives.map((item) => `@${item.name}`).join(", ");
        const lines = lineIndex(text);
        const containers = collectStatementContainers(node as ESTree.Node, lines);
        let firstLine: number | undefined;

        for (const comment of comments) {
          TS_DIRECTIVE.lastIndex = 0;
          let tsMatch: RegExpExecArray | null;
          while ((tsMatch = TS_DIRECTIVE.exec(comment.value))) {
            context.report({
              loc: occurrenceAt(comment, lines, tsMatch.index, tsMatch[0].length).loc,
              messageId: "tsIgnore",
              data: { name: tsMatch[0].slice(1) },
            });
          }

          DIRECTIVE.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = DIRECTIVE.exec(comment.value))) {
            const name = match[1];
            if (!name || !name.startsWith("fluent-")) continue;
            const occurrence = occurrenceAt(comment, lines, match.index, match[0].length);
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
              } else if (directive.placement === "first-line") {
                firstLine ??= firstNonEmptyLine(text);
                if (occurrence.loc.start.line !== firstLine) {
                  context.report({ loc: occurrence.loc, messageId: "firstLine" });
                }
              }
              continue;
            }

            const suggestion = file.fluent.manifest.typos[name];
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
