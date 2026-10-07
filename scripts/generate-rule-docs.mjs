import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { replaceMarkedSection } from "./lib/generated-artifacts.mjs";
import { cell } from "./lib/markdown-table.mjs";
import { root } from "./lib/repo.mjs";

/** @typedef {typeof import("../src/catalog.js").ruleCatalog[number]} CatalogRule */
/** @type {{ ruleCatalog: typeof import("../src/catalog.js").ruleCatalog }} */
const { ruleCatalog } = await import(pathToFileURL(join(root, "src/catalog.ts")).href);
/** @type {{ PACKAGE_GIT_REF: typeof import("../src/constants.js").PACKAGE_GIT_REF, REPOSITORY_URL: typeof import("../src/constants.js").REPOSITORY_URL }} */
const { PACKAGE_GIT_REF, REPOSITORY_URL } = await import(
  pathToFileURL(join(root, "src/constants.ts")).href
);
const presets110 = JSON.parse(
  await readFile(join(root, "tests/fixtures/presets-1.1.0.json"), "utf8"),
);
/** @type {{ DEFAULT_FLUENT_MANIFEST: import("../src/fluent/index.js").FluentSdkManifest, SUPPORTED_FLUENT_SDK_VERSIONS: typeof import("../src/fluent/index.js").SUPPORTED_FLUENT_SDK_VERSIONS, DEFAULT_FLUENT_SDK_VERSION: typeof import("../src/fluent/index.js").DEFAULT_FLUENT_SDK_VERSION }} */
const { DEFAULT_FLUENT_MANIFEST, SUPPORTED_FLUENT_SDK_VERSIONS, DEFAULT_FLUENT_SDK_VERSION } =
  await import(pathToFileURL(join(root, "src/fluent/index.ts")).href);
/** @type {{ businessRuleRules: typeof import("../src/configs/maps.js").businessRuleRules, classicEs5Rules: typeof import("../src/configs/maps.js").classicEs5Rules, clientRules: typeof import("../src/configs/maps.js").clientRules, es2021Rules: typeof import("../src/configs/maps.js").es2021Rules, fluentRules: typeof import("../src/configs/maps.js").fluentRules, recommendedRules: typeof import("../src/configs/maps.js").recommendedRules, strictRules: typeof import("../src/configs/maps.js").strictRules }} */
const {
  businessRuleRules,
  classicEs5Rules,
  clientRules,
  es2021Rules,
  fluentRules,
  recommendedRules,
  strictRules,
} = await import(pathToFileURL(join(root, "src/configs/maps.ts")).href);

const docsDir = join(root, "docs/rules");
await mkdir(docsDir, { recursive: true });

/**
 * @param {CatalogRule} rule
 * @returns {string}
 */
function profileLabel(rule) {
  return rule.placements[0]?.profile ?? "off";
}

/**
 * @param {CatalogRule} rule
 * @returns {string}
 */
function summary(rule) {
  return (rule.description.split(". ")[0] ?? "").replace(/\.$/, "");
}

/**
 * @param {string | undefined} filename
 * @returns {string}
 */
function fenceLang(filename) {
  return filename?.endsWith(".ts") ? "ts" : "js";
}

/**
 * @param {CatalogRule["bad"]} examples
 * @param {string} heading
 * @returns {string}
 */
function renderExamples(examples, heading) {
  return examples
    .map(
      (example) =>
        `### ${heading}: ${example.name}\n\n\`\`\`${fenceLang(example.filename)}\n${example.code}\n\`\`\`\n`,
    )
    .join("\n");
}

/**
 * @param {readonly string[]} items
 * @param {(item: string) => string} [render]
 * @returns {string}
 */
function bulletList(items, render = (item) => `- ${item}`) {
  return items.length > 0 ? items.map(render).join("\n") : "- None recorded.";
}

/**
 * @param {string} family
 * @param {boolean} includeFix
 * @returns {string}
 */
function familyTable(family, includeFix) {
  const header = includeFix
    ? "| Rule | Profile | Fix | What it catches |\n| --- | --- | --- | --- |"
    : "| Rule | Profile | What it catches |\n| --- | --- | --- |";
  const rows = ruleCatalog
    .filter((rule) => rule.family === family)
    .map((rule) => tableRow(rule, includeFix));
  return [header, ...rows].join("\n");
}

/**
 * @param {CatalogRule} rule
 * @param {boolean} includeFix
 * @returns {string}
 */
function tableRow(rule, includeFix) {
  const link = `[\`${rule.name}\`](${rule.docsUrl})`;
  const profile = profileLabel(rule);
  const fix = rule.fixable ? "fix" : rule.hasSuggestions ? "suggest" : "";
  const catchText = cell(summary(rule));
  if (includeFix) {
    return `| ${link} | ${cell(profile)} | ${cell(fix)} | ${catchText} |`;
  }
  return `| ${link} | ${cell(profile)} | ${catchText} |`;
}

/** @type {Record<string, string>} */
const profileExport = {
  recommended: "configs.recommendedRules",
  strict: "configs.strictRules",
  "classic-es5": "configs.classicEs5Rules",
  es2021: "configs.es2021Rules",
  client: "configs.clientRules",
  acl: "configs.aclRules",
  "business-rule": "configs.businessRuleRules",
  fluent: "configs.fluentRules",
  policy: "configs.policyRules",
  security: "configs.securityRules",
};

/**
 * @returns {string}
 */
function migrationTable() {
  const current = { recommended: recommendedRules, strict: strictRules };
  /** @type {string[]} */
  const rows = [];
  /** @type {Array<"recommended" | "strict">} */
  const presets = ["recommended", "strict"];
  for (const preset of presets) {
    const oldMap = presets110[preset];
    const currentMap = current[preset];
    const ruleIds = new Set([...Object.keys(oldMap), ...Object.keys(currentMap)]);
    for (const ruleId of [...ruleIds].sort()) {
      const oldSeverity = oldMap[ruleId] ?? "off";
      const newSeverity = currentMap[ruleId] ?? "off";
      if (oldSeverity === newSeverity) continue;
      const rule = ruleCatalog.find((item) => item.ruleId === ruleId);
      const replacements =
        rule?.placements
          .filter((item) => item.profile !== preset)
          .map((item) => `${profileExport[item.profile]} (${item.severity})`)
          .join("<br>") || "Enable the rule explicitly";
      let action;
      if (ruleId === "servicenow/validate-gliderecord-calls") {
        action = "Replace it with `servicenow/require-query-before-next`.";
      } else if (newSeverity === "off") {
        action = `Select ${replacements}.`;
      } else {
        action = `Review the ${oldSeverity}-to-${newSeverity} severity change.`;
      }
      rows.push(
        `| \`${ruleId}\` | ${preset} | ${oldSeverity} | ${newSeverity} | ${replacements} | ${action} |`,
      );
    }
  }
  return [
    "| Rule | 1.1 preset | 1.1 | 2.0 | Replacement profile | Required action |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

/**
 * @returns {string}
 */
function repositoryLinks() {
  const blob = `${REPOSITORY_URL}/blob/${PACKAGE_GIT_REF}`;
  const tree = `${REPOSITORY_URL}/tree/${PACKAGE_GIT_REF}`;
  return [
    `[repository-examples]: ${blob}/examples/README.md`,
    ...[
      "classic-compatibility",
      "classic-es5",
      "es2021",
      "client",
      "business-rule",
      "ui-action",
      "fluent",
      "mixed",
    ].map((name) => `[repository-example-${name}]: ${tree}/examples/${name}`),
    `[repository-contributing]: ${blob}/CONTRIBUTING.md`,
    `[repository-rule-authoring]: ${blob}/docs/rule-authoring.md`,
    `[repository-formatter-guide]: ${blob}/docs/oxfmt.md`,
    `[repository-non-goals]: ${blob}/docs/non-goals.md`,
  ].join("\n");
}

/**
 * @returns {Promise<void>}
 */
async function writeRuleDocs() {
  /** @type {Set<string>} */
  const keep = new Set();
  for (const rule of ruleCatalog) {
    keep.add(`${rule.name}.md`);
    const bad = renderExamples(rule.bad, "Incorrect");
    const good = renderExamples(rule.good, "Correct");
    const evidence =
      rule.evidence.length > 0
        ? rule.evidence
            .map(
              (item) =>
                `- **${item.claim}**\n  - Verification ID: \`${item.verificationId}\`\n  - URL: ${item.url}\n  - Verified by: ${item.verifiedBy}\n  - Verified at: ${item.verifiedAt}`,
            )
            .join("\n")
        : "- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.";
    const falsePositives = bulletList(rule.falsePositives);
    const falseNegatives = bulletList(rule.falseNegatives);
    const scopeBoundaries = bulletList(rule.scopeBoundaries);
    const overlaps = bulletList(rule.overlaps, (item) => `- \`${item}\``);
    const modes =
      rule.applicability.javascriptModes === "n/a"
        ? "n/a"
        : rule.applicability.javascriptModes.join(", ");
    const sdkRange = rule.applicability.fluentSdkRange ?? "n/a";
    const serviceNowReleaseRange =
      rule.family === "fluent"
        ? "n/a (Fluent SDK-versioned)"
        : rule.applicability.serviceNowReleases.join(", ");
    const lifecycle = rule.lifecycleAssumptions ?? "No extra lifecycle assumptions.";
    const placements = rule.placements
      .map((placement) => `${placement.profile} (${placement.severity})`)
      .join(", ");
    const options =
      rule.options.length > 0
        ? rule.options
            .map(
              (option) =>
                `| \`${cell(option.name)}\` | ${cell(option.type)} | \`${cell(option.default)}\` | ${cell(option.description)} |`,
            )
            .join("\n")
        : "| _(none)_ | | | This rule has no options. |";
    const md = `# ${rule.ruleId}

${rule.description}

- **Family:** ${rule.family}
- **Profile:** ${profileLabel(rule)}
- **Placements:** ${placements || "off"}
- **Default severity:** ${rule.severity}
- **Fix safety:** ${rule.fixKind === "none" ? "diagnostic only" : rule.fixKind}
- **Suggestions:** ${rule.hasSuggestions ? "yes" : "no"}
- **Authoring:** ${rule.applicability.authoring}
- **Surfaces:** ${rule.applicability.surfacesText}
- **JavaScript mode:** ${rule.applicability.javascriptMode}
- **Last verified:** ${rule.lastVerified}
- **Implementation:** [\`src/rules/${rule.name}.ts\`](../../src/rules/${rule.name}.ts)${
      rule.family === "fluent"
        ? `\n- **Fluent manifest:** ${DEFAULT_FLUENT_MANIFEST.version}\n- **Fluent SDK versions:** ${SUPPORTED_FLUENT_SDK_VERSIONS.join(", ")} (unspecified selects ${DEFAULT_FLUENT_SDK_VERSION})`
        : ""
    }

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | ${cell(rule.applicability.authoring)} |
| Surfaces | ${cell(rule.applicability.surfacesText)} |
| Minimum surface confidence | ${cell(rule.applicability.minimumSurfaceConfidence)} |
| JavaScript modes | ${cell(modes)} |
| Application scopes | ${cell(rule.applicability.scopes.join(", "))} |
| ServiceNow releases | ${cell(serviceNowReleaseRange)} |
| Fluent SDK range | ${cell(sdkRange)} |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
${options}

## Incorrect

${bad}
## Correct

${good}
## Limitations

${rule.limitations}

## Known false positives

${falsePositives}

## Known false negatives

${falseNegatives}

## Intentional scope boundaries

${scopeBoundaries}

## Overlaps

${overlaps}

## Fix safety

- Classification: ${rule.fixKind === "none" ? "diagnostic only" : rule.fixKind}
- Lifecycle assumptions: ${lifecycle}

## Evidence

${evidence}

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
`;
    await writeFile(join(docsDir, `${rule.name}.md`), md);
    console.log("wrote", rule.name);
  }

  for (const file of await readdir(docsDir)) {
    if (file.endsWith(".md") && !keep.has(file)) {
      await unlink(join(docsDir, file));
      console.log("removed stale", file);
    }
  }
}

/**
 * @returns {Promise<void>}
 */
async function writeReadmeTables() {
  const readmePath = join(root, "README.md");
  let readme = await readFile(readmePath, "utf8");
  readme = replaceMarkedSection(readme, "classic-rules", familyTable("classic", true));
  readme = replaceMarkedSection(readme, "engine-rules", familyTable("engine", false));
  readme = replaceMarkedSection(readme, "fluent-rules", familyTable("fluent", true));
  readme = replaceMarkedSection(readme, "migration-1.1-to-2.0", migrationTable());
  readme = replaceMarkedSection(readme, "repository-links", repositoryLinks());
  await writeFile(readmePath, readme);
  console.log("updated README rule tables");
}

/**
 * @param {string} path
 */
function rulesForGeneratedConfig(path) {
  const relative = path.replaceAll("\\", "/");
  if (relative.endsWith("examples/classic-compatibility/.oxlintrc.json")) return classicEs5Rules;
  if (relative.endsWith("examples/classic-es5/.oxlintrc.json")) return classicEs5Rules;
  if (relative.endsWith("examples/es2021/.oxlintrc.json")) return es2021Rules;
  if (relative.endsWith("examples/client/.oxlintrc.json")) return clientRules;
  if (relative.endsWith("examples/business-rule/.oxlintrc.json")) return businessRuleRules;
  if (relative.endsWith("examples/fluent/.oxlintrc.json")) return fluentRules;
  return recommendedRules;
}

/**
 * @param {string} path
 * @param {string} specifierComment
 */
async function writeOxlintrcRules(path, specifierComment, rules = rulesForGeneratedConfig(path)) {
  const current = JSON.parse(await readFile(path, "utf8"));
  if (path.replaceAll("\\", "/").includes("/examples/")) {
    current.$schema = "./node_modules/oxlint/configuration_schema.json";
    current.jsPlugins = [{ name: "servicenow", specifier: "oxc-plugin-servicenow" }];
  }
  current.rules = rules;
  await writeFile(path, `${JSON.stringify(current, null, 2)}\n`);
  console.log("updated", specifierComment, path);
}

/**
 * @param {string} dir
 * @param {string[]} found
 * @returns {Promise<string[]>}
 */
async function collectOxlintrcFiles(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "invalid") continue;
      await collectOxlintrcFiles(path, found);
    } else if (entry.name === ".oxlintrc.json") {
      found.push(path);
    }
  }
  return found;
}

await writeRuleDocs();
await writeReadmeTables();
for (const path of await collectOxlintrcFiles(join(root, "examples"))) {
  await writeOxlintrcRules(path, "example");
}
await writeOxlintrcRules(
  join(root, "tests/integration/profiles/configs/recommended.oxlintrc.json"),
  "recommended fixture",
);
await writeOxlintrcRules(
  join(root, "tests/integration/profiles/configs/strict.oxlintrc.json"),
  "strict fixture",
  strictRules,
);
await writeOxlintrcRules(join(root, "tests/integration/profiles/mixed/.oxlintrc.json"), "mixed");
await writeOxlintrcRules(join(root, "tests/integration/fixtures/.oxlintrc.json"), "fixtures");
console.log("recommended rule count", Object.keys(recommendedRules).length);
