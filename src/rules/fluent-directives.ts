import { defineRule } from "@oxlint/plugins";
import { FLUENT_DIRECTIVE_TYPOS, KNOWN_FLUENT_DIRECTIVES, ruleDocsUrl } from "../constants.js";
import { isFluentFile } from "../utils/filenames.js";

const DIRECTIVE = /@([A-Za-z][\w-]*)/g;
const KNOWN = new Set<string>(KNOWN_FLUENT_DIRECTIVES);

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

function fallbackComments(text: string): Comment[] {
  const out: Comment[] = [];
  const re = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const raw = match[0];
    const value = raw.startsWith("//") ? raw.slice(2) : raw.slice(2, -2);
    out.push({ value, start: match.index, end: match.index + raw.length });
  }
  return out;
}

export const fluentDirectives = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Validate ServiceNow Fluent directives (`@fluent-ignore`, `@fluent-disable-sync`) and catch typos.",
      recommended: "recommended",
      url: ruleDocsUrl("fluent-directives"),
    },
    hasSuggestions: true,
    messages: {
      unknown:
        "Unknown Fluent directive `@{{name}}`. Supported directives: `@fluent-ignore`, `@fluent-disable-sync`.",
      typo: "Unknown Fluent directive `@{{name}}`. Did you mean `@{{suggestion}}`?",
      dangling:
        "`@fluent-ignore` has no following statement to suppress. Place it on the line immediately above the diagnostic.",
      tsIgnore:
        "`@ts-ignore` does not suppress Fluent diagnostics. Use `@fluent-ignore` on the previous line.",
    },
  },
  createOnce(context) {
    return {
      before() {
        if (!isFluentFile(context.filename)) return false;

        const comments = commentsOf(context);
        const text = context.sourceCode.text;

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
                data: { name },
              });
            }
          }
        }

        return false;
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
    return { start: { line: comment.loc.start.line, column: 0 } };
  }
  const before = text.slice(0, comment.start);
  const line = before.split("\n").length;
  const lastNl = before.lastIndexOf("\n");
  const column = comment.start - (lastNl + 1);
  return { start: { line, column } };
}
