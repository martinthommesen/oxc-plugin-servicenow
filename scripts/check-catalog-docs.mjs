import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { ruleCatalog } = await import(pathToFileURL(join(root, "src/catalog.ts")).href);
const { optionDocsFromDescriptor } = await import(
  pathToFileURL(join(root, "src/options/index.ts")).href
);

const errors = [];

function fail(message) {
  errors.push(message);
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function unescapedPipeCount(line) {
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "|") continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) slashes += 1;
    if (slashes % 2 === 0) count += 1;
  }
  return count;
}

function tableColumnCount(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return 0;
  return unescapedPipeCount(trimmed) - 1;
}

function isDelimiter(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

/** Validate every generated Markdown table's column count and escaping. */
function checkMarkdownTables(source, label) {
  const lines = source.split(/\r?\n/);
  let fenced = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced || !isDelimiter(line) || index === 0) continue;
    const expected = tableColumnCount(line);
    const header = tableColumnCount(lines[index - 1]);
    if (expected < 2 || header !== expected) {
      fail(
        `${label}:${index + 1} malformed Markdown table header (${header} columns, delimiter ${expected})`,
      );
      continue;
    }
    for (let row = index + 1; row < lines.length; row += 1) {
      const candidate = lines[row].trim();
      if (candidate === "") break;
      if (/^\s*```/.test(candidate)) break;
      if (!candidate.startsWith("|")) break;
      const columns = tableColumnCount(candidate);
      if (columns !== expected) {
        fail(`${label}:${row + 1} Markdown table row has ${columns} columns; expected ${expected}`);
      }
    }
  }
}

async function sourceExists(relativePath) {
  if (
    !relativePath ||
    relativePath.includes("\0") ||
    relativePath.includes("\\") ||
    isAbsolute(relativePath)
  ) {
    return false;
  }
  const resolved = resolve(root, relativePath);
  const fromRoot = relative(root, resolved);
  if (fromRoot === ".." || fromRoot.startsWith("../") || isAbsolute(fromRoot)) return false;
  try {
    await access(resolved);
    return true;
  } catch {
    return false;
  }
}

for (const rule of ruleCatalog) {
  const latest = rule.evidence.reduce(
    (max, item) => (item.verifiedAt > max ? item.verifiedAt : max),
    "",
  );
  if (rule.lastVerified !== latest) {
    fail(
      `${rule.name} lastVerified ${rule.lastVerified} does not match latest evidence date ${latest}`,
    );
  }
  for (const field of [
    "authoring",
    "surfaces",
    "minimumSurfaceConfidence",
    "javascriptModes",
    "scopes",
    "serviceNowReleases",
  ]) {
    if (rule.applicability[field] == null || rule.applicability[field] === "") {
      fail(`${rule.name} applicability.${field} is missing`);
    }
  }
  if (rule.family === "fluent" && !rule.applicability.fluentSdkRange) {
    fail(`${rule.name} is Fluent and is missing fluentSdkRange`);
  }
  if (
    !Array.isArray(rule.falsePositives) ||
    !Array.isArray(rule.falseNegatives) ||
    !Array.isArray(rule.scopeBoundaries) ||
    !Array.isArray(rule.overlaps)
  ) {
    fail(`${rule.name} is missing structured limitation or overlap lists`);
  }
  for (const evidence of rule.evidence) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.verifiedAt)) {
      fail(`${rule.name} evidence has invalid verifiedAt ${evidence.verifiedAt}`);
    } else if (!isValidIsoDate(evidence.verifiedAt)) {
      fail(`${rule.name} evidence has impossible verifiedAt ${evidence.verifiedAt}`);
    } else if (evidence.verifiedAt > new Date().toISOString().slice(0, 10)) {
      fail(`${rule.name} evidence date is in the future: ${evidence.verifiedAt}`);
    }
    if (/^https?:\/\/example\.(?:com|org)|^https?:\/\/placeholder/i.test(evidence.url)) {
      fail(`${rule.name} evidence uses a placeholder URL ${evidence.url}`);
    } else if (!/^https?:\/\//.test(evidence.url)) {
      const localPath = evidence.url.split(/[?#]/, 1)[0];
      if (!(await sourceExists(localPath)))
        fail(`${rule.name} evidence path does not exist: ${evidence.url}`);
    }
  }
  if (rule.preset === "recommended" && rule.severity === "error") {
    const authoritative = rule.evidence.some((item) => item.url.startsWith("https://"));
    const verified = rule.evidence.some(
      (item) => item.verifiedBy === "fixture" || item.verifiedBy === "integration-test",
    );
    if (!authoritative) {
      fail(`${rule.name} is a recommended error without an authoritative https evidence URL`);
    }
    if (!verified) {
      fail(`${rule.name} is a recommended error without fixture or integration-test evidence`);
    }
  }
  const descriptor = rule.optionDescriptor;
  if (descriptor) {
    const expected = optionDocsFromDescriptor(descriptor);
    if (JSON.stringify(rule.options) !== JSON.stringify(expected)) {
      fail(`${rule.name} option docs drifted from the authoritative descriptor`);
    }
  } else if (rule.options.length > 0) {
    fail(`${rule.name} documents options without a descriptor`);
  }
  const expectedFix = rule.fixable ? "safe-fix" : rule.hasSuggestions ? "suggestion" : "none";
  if (rule.fixKind !== expectedFix) {
    fail(`${rule.name} fixKind ${rule.fixKind} does not match ${expectedFix}`);
  }
  const page = await readFile(join(root, "docs/rules", `${rule.name}.md`), "utf8");
  checkMarkdownTables(page, `docs/rules/${rule.name}.md`);
  for (const heading of [
    "## Applicability",
    "## Known false positives",
    "## Known false negatives",
    "## Intentional scope boundaries",
    "## Overlaps",
    "## Fix safety",
    "## Evidence",
  ]) {
    if (!page.includes(heading)) {
      fail(`${rule.name}.md is missing ${heading}`);
    }
  }
  if (!page.includes(`**Last verified:** ${rule.lastVerified}`)) {
    fail(`${rule.name}.md lastVerified is stale`);
  }
}

const readme = await readFile(join(root, "README.md"), "utf8");
checkMarkdownTables(readme, "README.md");

const generatedState = execFileSync(
  "git",
  [
    "-c",
    "core.fsmonitor=false",
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    "docs/rules",
    "README.md",
    "docs/compatibility.md",
    "examples",
    "tests/integration/profiles/configs",
    "tests/integration/fixtures/.oxlintrc.json",
  ],
  { cwd: root, encoding: "utf8" },
).trim();
if (generatedState) fail(`generated files differ from the checked-in set:\n${generatedState}`);

if (errors.length > 0) {
  console.error(errors.map((item) => ` - ${item}`).join("\n"));
  process.exit(1);
}
console.log(`checked ${ruleCatalog.length} catalog documentation records`);
