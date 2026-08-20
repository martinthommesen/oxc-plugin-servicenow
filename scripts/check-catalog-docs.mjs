import { readFile } from "node:fs/promises";
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

if (errors.length > 0) {
  console.error(errors.map((item) => ` - ${item}`).join("\n"));
  process.exit(1);
}
console.log(`checked ${ruleCatalog.length} catalog documentation records`);
