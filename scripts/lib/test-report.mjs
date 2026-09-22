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
  const summary = { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0 };
  for (const item of report.tests ?? []) {
    summary.total += 1;
    if (item.status === "passed" && !item.skipped && !item.todo) summary.passed += 1;
    if (item.status !== "passed") summary.failed += 1;
    if (item.skipped) summary.skipped += 1;
    if (item.todo) summary.todo += 1;
  }
  return summary;
}
