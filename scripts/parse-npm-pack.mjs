/**
 * Parse the JSON emitted by `npm pack --json` across supported npm versions.
 *
 * npm <= 11 emits an array of package records. npm 12 emits an object keyed by
 * package id. Both shapes must contain exactly one tarball record for a
 * single-package release; accepting an arbitrary first record could publish a
 * different artifact when npm changes its output.
 */
export function parseNpmPackJson(value) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch (error) {
    throw new Error(
      `invalid npm pack JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const records = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? Object.values(parsed)
      : [];
  const matches = records.filter(
    (record) =>
      record &&
      typeof record === "object" &&
      typeof record.filename === "string" &&
      record.filename.length > 0,
  );
  if (matches.length !== 1) {
    throw new Error(`expected exactly one npm pack record with filename, found ${matches.length}`);
  }
  return matches[0];
}
