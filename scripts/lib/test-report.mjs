/**
 * @param {import("./test-report-types.js").TestReport} report
 * @returns {Map<string, import("./test-report-types.js").TestOutcome[]>}
 */
export function indexOutcomes(report) {
  const outcomes = new Map();
  for (const test of report.tests ?? []) {
    const key = `${test.file}::${test.fullName}`;
    const entries = outcomes.get(key) ?? [];
    entries.push(test);
    outcomes.set(key, entries);
  }
  return outcomes;
}

/**
 * @param {ReadonlyMap<string, readonly import("./test-report-types.js").TestOutcome[]>} index
 * @param {string} file
 * @param {string} fullName
 * @returns {import("./test-report-types.js").ExactProof}
 */
export function exactProof(index, file, fullName) {
  const entries = index.get(`${file}::${fullName}`) ?? [];
  if (entries.length === 0) return { status: "missing", count: 0 };
  if (entries.length > 1) return { status: "ambiguous", count: entries.length };
  // Length 1 is established above; the cast names the invariant.
  const outcome = /** @type {import("./test-report-types.js").TestOutcome} */ (entries[0]);
  if (outcome.status !== "passed" || outcome.skipped || outcome.todo) {
    return { status: "not-clean", count: 1, outcome };
  }
  return { status: "ok", count: 1, outcome };
}

/**
 * @param {import("./test-report-types.js").TestReport} report
 * @returns {{ total: number, passed: number, failed: number, skipped: number, todo: number }}
 */
export function outcomeSummary(report) {
  const tests = report.tests ?? [];
  return {
    total: tests.length,
    passed: tests.filter((item) => item.status === "passed" && !item.skipped && !item.todo).length,
    failed: tests.filter((item) => item.status !== "passed").length,
    skipped: tests.filter((item) => item.skipped).length,
    todo: tests.filter((item) => item.todo).length,
  };
}
