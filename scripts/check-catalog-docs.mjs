import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { ruleCatalog } = await import(pathToFileURL(join(root, "src/catalog.ts")).href);
const { ruleDocMetadata } = await import(pathToFileURL(join(root, "src/catalog-metadata.ts")).href);
const { RULE_OPTION_DESCRIPTORS, optionDocsFromDescriptor } = await import(
  pathToFileURL(join(root, "src/options/index.ts")).href
);

const errors = [];

function fail(message) {
  errors.push(message);
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
      fail(`${label}:${index + 1} malformed Markdown table header (${header} columns, delimiter ${expected})`);
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
  try {
    await access(join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

const catalogNames = new Set(ruleCatalog.map((rule) => rule.name));
const metadataNames = new Set(Object.keys(ruleDocMetadata));

for (const name of catalogNames) {
  if (!metadataNames.has(name)) fail(`catalog rule ${name} is missing structured metadata`);
}
for (const name of metadataNames) {
  if (!catalogNames.has(name)) fail(`metadata ${name} does not match a catalog rule`);
}

for (const rule of ruleCatalog) {
  const latest = rule.evidence.reduce((max, item) => (item.verifiedAt > max ? item.verifiedAt : max), "");
  if (rule.lastVerified !== latest) {
    fail(`${rule.name} lastVerified ${rule.lastVerified} does not match latest evidence date ${latest}`);
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
  if (!Array.isArray(rule.falsePositives) || !Array.isArray(rule.falseNegatives) || !Array.isArray(rule.overlaps)) {
    fail(`${rule.name} is missing structured false-positive, false-negative, or overlap lists`);
  }
  for (const evidence of rule.evidence) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.verifiedAt)) {
      fail(`${rule.name} evidence has invalid verifiedAt ${evidence.verifiedAt}`);
    } else if (Number.isNaN(Date.parse(`${evidence.verifiedAt}T00:00:00Z`))) {
      fail(`${rule.name} evidence has impossible verifiedAt ${evidence.verifiedAt}`);
    } else if (evidence.verifiedAt > new Date().toISOString().slice(0, 10)) {
      fail(`${rule.name} evidence date is in the future: ${evidence.verifiedAt}`);
    }
    if (/^https?:\/\/example\.(?:com|org)|^https?:\/\/placeholder/i.test(evidence.url)) {
      fail(`${rule.name} evidence uses a placeholder URL ${evidence.url}`);
    } else if (!/^https?:\/\//.test(evidence.url)) {
      const localPath = evidence.url.split(/[?#]/, 1)[0];
      if (!(await sourceExists(localPath))) fail(`${rule.name} evidence path does not exist: ${evidence.url}`);
    }
  }
  if (rule.preset === "recommended" && rule.severity === "error") {
    const authoritative = rule.evidence.some((item) => /^https:\/\//.test(item.url));
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
  const descriptor = RULE_OPTION_DESCRIPTORS[rule.name];
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

if (errors.length > 0) {
  console.error(errors.map((item) => ` - ${item}`).join("\n"));
  process.exit(1);
}
console.log(`checked ${ruleCatalog.length} catalog documentation records`);
