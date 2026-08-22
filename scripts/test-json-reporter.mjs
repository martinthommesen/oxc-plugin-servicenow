import { relative } from "node:path";

const root = process.cwd();

/** Emit one deterministic JSON inventory of exact node:test outcomes. */
export default async function* jsonReporter(source) {
  const stacks = new Map();
  const names = new Map();
  const tests = [];

  for await (const event of source) {
    const data = event.data;
    if (!data || typeof data !== "object") continue;
    const file = typeof data.file === "string" ? relative(root, data.file) : "";
    const stack = stacks.get(file) ?? [];
    if (event.type === "test:start") {
      stack.length = data.nesting;
      stack[data.nesting] = data.name;
      stacks.set(file, stack);
      names.set(`${file}:${data.testId}`, stack.slice(0, data.nesting + 1).join(" > "));
      continue;
    }
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    if (data.details?.type !== "test" || !file.endsWith(".test.ts")) continue;
    tests.push({
      file,
      fullName: names.get(`${file}:${data.testId}`) ?? data.name,
      status: event.type === "test:pass" ? "passed" : "failed",
      skipped: Boolean(data.skip),
      todo: Boolean(data.todo),
      durationMs: data.details.duration_ms,
    });
  }

  tests.sort(
    (left, right) =>
      left.file.localeCompare(right.file) || left.fullName.localeCompare(right.fullName),
  );
  yield `${JSON.stringify({ schemaVersion: 1, tests }, null, 2)}\n`;
}
