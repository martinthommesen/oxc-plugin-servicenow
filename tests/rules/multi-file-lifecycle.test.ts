import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ruleCatalog } from "../../src/catalog.js";
import { walk } from "../../src/utils/ast.js";
import { parse } from "../helpers/rule-tester.js";

// The real oxlint host calls createOnce once per process and before() once
// per file, so any state a rule keeps in its createOnce closure without
// resetting it in before() leaks across files. The unit harness constructs
// a fresh closure per assertion, so it can never observe this class; this
// harness replays one rule instance over several files and asserts every
// file reports identically (FINDINGS.md COR-011, section 9 recommendation 1).
function lintFilesWithOneInstance(
  ruleName: string,
  files: ReadonlyArray<{ filename: string; code: string; settings?: object }>,
): number[] {
  const entry = ruleCatalog.find((item) => item.name === ruleName);
  assert.ok(entry);
  const rule = entry.implementation as unknown as {
    createOnce?: (context: unknown) => Record<string, unknown> | undefined;
    create?: (context: unknown) => Record<string, unknown> | undefined;
  };
  let current: {
    filename: string;
    code: string;
    settings?: object;
    ast: unknown;
    comments: ReturnType<typeof parse>["comments"];
    ancestorIndex: NonNullable<Parameters<typeof walk>[4]>;
  };
  let count = 0;
  // The host supplies a fresh SourceCode object per file; the shared
  // analysis cache keys on its identity, so the harness must too. Comments
  // and ancestors come from the parse, as in the real host: stubbing them
  // empty blinds comment-driven rules and ancestor-gated diagnostics, which
  // would make the per-file baseline assertion below vacuous.
  const freshSourceCode = () => ({
    get text() {
      return current.code;
    },
    get ast() {
      return current.ast;
    },
    get lines() {
      return current.code.split("\n");
    },
    getText: () => current.code,
    getAllComments: () => current.comments,
    getAncestors: (node?: unknown) => [...(current.ancestorIndex.get(node as object) ?? [])],
  });
  let sourceCode = freshSourceCode();
  const context = {
    id: `servicenow/${ruleName}`,
    get filename() {
      return current.filename;
    },
    get physicalFilename() {
      return current.filename;
    },
    cwd: "/",
    options: [],
    get settings() {
      return { servicenow: current.settings ?? {} };
    },
    get sourceCode() {
      return sourceCode;
    },
    getFilename: () => current.filename,
    getSourceCode: () => sourceCode,
    report: () => {
      count += 1;
    },
  };
  const factory = rule.createOnce ?? rule.create;
  assert.ok(factory);
  const visitors = factory.call(rule, context) as
    | (Record<string, unknown> & { before?: () => boolean | void; after?: () => void })
    | undefined;
  assert.ok(visitors);
  const perFile: number[] = [];
  for (const file of files) {
    const parsed = parse(file.code, file.filename);
    const ancestorIndex: NonNullable<Parameters<typeof walk>[4]> = new WeakMap();
    walk(parsed.ast as unknown as Parameters<typeof walk>[0], {}, [], new WeakSet(), ancestorIndex);
    current = { ...file, ast: parsed.ast, comments: parsed.comments, ancestorIndex };
    sourceCode = freshSourceCode();
    count = 0;
    if (visitors.before?.() === false) {
      perFile.push(0);
      continue;
    }
    walk(current.ast as Parameters<typeof walk>[0], visitors as Parameters<typeof walk>[1], []);
    visitors.after?.();
    perFile.push(count);
  }
  return perFile;
}

describe("one rule instance across several files (FINDINGS.md COR-011)", () => {
  for (const entry of ruleCatalog) {
    it(`${entry.name} reports each file independently`, () => {
      for (const example of entry.bad) {
        const file = {
          filename: example.filename ?? "test.js",
          code: example.code,
          settings: example.settings,
        };
        // Byte-identical files share every diagnostic offset, so state keyed
        // on offsets or nodes from a previous file surfaces as a count drop.
        const perFile = lintFilesWithOneInstance(entry.name, [file, file, file]);
        assert.ok(perFile[0]! > 0, `${entry.name}: first file produced no diagnostics`);
        assert.equal(perFile[1], perFile[0], `${entry.name}: second file diverged`);
        assert.equal(perFile[2], perFile[0], `${entry.name}: third file diverged`);
      }
    });
  }
});
