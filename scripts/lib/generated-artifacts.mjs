export const GENERATED_ARTIFACT_PATHS = Object.freeze([
  "src/version.ts",
  "docs/rules",
  "README.md",
  "docs/compatibility.md",
  "docs/australia-engine-updates.md",
  "examples",
  "tests/integration/profiles/configs/recommended.oxlintrc.json",
  "tests/integration/profiles/configs/strict.oxlintrc.json",
  "tests/integration/profiles/mixed/.oxlintrc.json",
  "tests/integration/fixtures/.oxlintrc.json",
]);

export const MARKED_SECTION_NAMES = Object.freeze([
  "classic-rules",
  "engine-rules",
  "fluent-rules",
  "migration-1.1-to-2.0",
  "repository-links",
  "compatibility",
]);

/**
 * @param {string} source
 * @param {string} name
 * @param {string} body
 * @returns {string}
 */
export function replaceMarkedSection(source, name, body) {
  if (!MARKED_SECTION_NAMES.includes(name)) throw new Error(`Unknown generated section ${name}`);
  const start = `<!-- generated:${name}:start -->`;
  const end = `<!-- generated:${name}:end -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(source)) throw new Error(`Missing ${start} / ${end} markers`);
  return source.replace(pattern, `${start}\n${body.trim()}\n${end}`);
}
