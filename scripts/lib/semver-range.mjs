// A minimal npm range evaluator for the compatibility support contract. The
// repository has no semver dependency and the compatibility checks run in the
// zero-dependency `workflow` CI job, so this covers exactly the range forms the
// project declares: comparator conjunctions (`>=9.0.0 <11`), caret ranges
// (`^8.57.0`), and `||` alternatives. Anything else throws rather than guessing
// (FINDINGS.md OPS-011).
const VERSION = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;
const COMPARATOR = /^(>=|<=|>|<|=|\^)?(\d+(?:\.\d+){0,2})$/;

/** Parse an exact or partial version into a [major, minor, patch] triple. */
export function parseVersion(value) {
  const match = VERSION.exec(String(value ?? "").trim());
  if (!match) throw new Error(`invalid version ${JSON.stringify(value)}`);
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function compare(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

function satisfiesComparator(version, comparator) {
  const match = COMPARATOR.exec(comparator);
  if (!match) throw new Error(`unsupported range comparator ${JSON.stringify(comparator)}`);
  const bound = parseVersion(match[2]);
  const order = compare(version, bound);
  switch (match[1] ?? "=") {
    case ">=":
      return order >= 0;
    case ">":
      return order > 0;
    case "<=":
      return order <= 0;
    case "<":
      return order < 0;
    case "=":
      return order === 0;
    default: {
      // ^0.x.y is minor-bounded in npm; ^x.y.z with x > 0 is major-bounded.
      const ceiling = bound[0] > 0 ? [bound[0] + 1, 0, 0] : [0, bound[1] + 1, 0];
      return order >= 0 && compare(version, ceiling) < 0;
    }
  }
}

/** True when `version` satisfies the npm `range`. Prerelease tags are not supported. */
export function satisfiesRange(version, range) {
  const parsed = parseVersion(version);
  const alternatives = String(range ?? "").split("||");
  if (alternatives.every((alternative) => alternative.trim() === ""))
    throw new Error(`invalid range ${JSON.stringify(range)}`);
  return alternatives.some((alternative) =>
    alternative
      .trim()
      .split(/\s+/)
      .every((comparator) => satisfiesComparator(parsed, comparator)),
  );
}

/** The lowest version a `>=`-anchored range admits, used to pin a declared support floor. */
export function rangeFloor(range) {
  const first = String(range ?? "")
    .trim()
    .split(/\s+/)[0];
  const match = /^>=(\d+(?:\.\d+){0,2})$/.exec(first ?? "");
  if (!match) throw new Error(`range ${JSON.stringify(range)} has no >= floor`);
  return parseVersion(match[1]).join(".");
}

/** The highest major a `<`-bounded range admits, used to pin a declared support ceiling. */
export function rangeTopMajor(range) {
  const upper = String(range ?? "")
    .trim()
    .split(/\s+/)
    .find((part) => /^<\d/.test(part));
  if (!upper) throw new Error(`range ${JSON.stringify(range)} has no < ceiling`);
  const [major, minor, patch] = parseVersion(upper.slice(1));
  // `<11` admits every 10.x; `<11.2.0` still admits 11.x, so the ceiling major
  // only drops when the bound sits on an exact major boundary.
  return minor === 0 && patch === 0 ? major - 1 : major;
}
