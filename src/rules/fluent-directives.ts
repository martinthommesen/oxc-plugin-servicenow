import { defineRule } from "@oxlint/plugins";
import { FLUENT_DIRECTIVE_TYPOS, ruleDocsUrl } from "../constants.js";
import { fallbackComments } from "../utils/ast.js";
import { DEFAULT_FLUENT_MANIFEST, knownDirectiveNames } from "../fluent/index.js";
import { isFluentContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

const DIRECTIVE = /@([A-Za-z][\w-]*)/g;
const KNOWN = knownDirectiveNames();

interface Comment {
  value: string;
  start: number;
  end: number;
  loc?: { start: { line: number }; end: { line: number } };
}

function commentsOf(context: {
  sourceCode: { getAllComments?: () => Comment[]; text: string };
}): Comment[] {
  if (typeof context.sourceCode.getAllComments === "function") {
    return context.sourceCode.getAllComments();
  }
  return fallbackComments(context.sourceCode.text);
}

function firstNonEmptyLine(text: string): number {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim().length > 0) return i + 1;
  }
  return 1;
}

export const fluentDirectives = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Validate ServiceNow Fluent directives (`@fluent-ignore`, `@fluent-disable-sync`, `@fluent-disable-sync-for-file`) and catch typos.",
      url: ruleDocsUrl("fluent-directives"),
    },
    messages: {
      unknown:
        "Unknown Fluent directive `@{{name}}`. Supported directives: {{supported}}.",
      typo: "Unknown Fluent directive `@{{name}}`. Did you mean `@{{suggestion}}`?",
      dangling:
        "`@fluent-ignore` has no following statement to suppress. Place it on the line immediately above the diagnostic.",
      tsIgnore:
        "`@ts-ignore` does not suppress Fluent diagnostics. Use `@fluent-ignore` on the previous line.",
      firstLine:
        "`@fluent-disable-sync-for-file` applies to the whole file and must be on the first non-empty line.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!isFluentContext(script)) return false;
      },
      Program() {
        const comments = commentsOf(context);
        const text = context.sourceCode.text;
        const supported = DEFAULT_FLUENT_MANIFEST.directives.map((item) => `@${item.name}`).join(", ");

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

            if (KNOWN.has(name)) {
              if (name === "fluent-ignore" && isDangling(comment, text)) {
                context.report({ loc: locOf(comment, text), messageId: "dangling" });
              }
              if (name === "fluent-disable-sync-for-file") {
                const line = locOf(comment, text).start.line;
                if (line !== firstNonEmptyLine(text)) {
                  context.report({ loc: locOf(comment, text), messageId: "firstLine" });
                }
              }
              continue;
            }

            const suggestion = FLUENT_DIRECTIVE_TYPOS[name];
            if (suggestion) {
              context.report({
                loc: locOf(comment, text),
                messageId: "typo",
                data: { name, suggestion },
              });
            } else {
              context.report({
                loc: locOf(comment, text),
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

function isDangling(comment: Comment, text: string): boolean {
  const after = text.slice(comment.end).replace(/^\s+/, "");
  return after.length === 0;
}

function locOf(comment: Comment, text: string) {
  if (comment.loc) {
    const start = comment.loc.start as { line: number; column?: number };
    return { start: { line: start.line, column: start.column ?? 0 } };
  }
  const before = text.slice(0, comment.start);
  const line = before.split("\n").length;
  const lastNl = before.lastIndexOf("\n");
  const column = comment.start - (lastNl + 1);
  return { start: { line, column } };
}
