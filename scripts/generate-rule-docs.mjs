import { readdir, readFile, writeFile } from "node:fs/promises";
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

const rulesPath = join(root, "docs/rules.md");

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
        `#### ${heading}: ${example.name}\n\n\`\`\`${fenceLang(example.filename)}\n${example.code}\n\`\`\`\n`,
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
    `[repository-compatibility]: ${blob}/docs/compatibility.md`,
    `[repository-australia-engine-updates]: ${blob}/docs/australia-engine-updates.md`,
    `[repository-non-goals]: ${blob}/docs/non-goals.md`,
  ].join("\n");
}

/**
 * @returns {Promise<void>}
 */
async function writeRuleDocs() {
  const pages = [
    "# Rule reference\n\nGenerated from the rule catalog. Rules report diagnostics only; none rewrites code. Each section records applicability, examples, boundaries and evidence.\n\nSee [rule authoring](rule-authoring.md) and [non-goals](non-goals.md).\n",
  ];
  for (const rule of ruleCatalog) {
    const modes =
      rule.applicability.javascriptModes === "n/a"
        ? "n/a"
        : rule.applicability.javascriptModes.join(", ");
    const placements = rule.placements
      .map((item) => `${item.profile} (${item.severity})`)
      .join(", ");
    const releases =
      rule.family === "fluent" ? "SDK-versioned" : rule.applicability.serviceNowReleases.join(", ");
    const options = rule.options.length
      ? `### Options\n\n| Name | Type | Default | Description |\n| --- | --- | --- | --- |\n${rule.options.map((item) => `| \`${cell(item.name)}\` | ${cell(item.type)} | \`${cell(item.default)}\` | ${cell(item.description)} |`).join("\n")}\n`
      : "";
    const boundaries = [
      ...rule.falsePositives.map((item) => `False positive: ${item}`),
      ...rule.falseNegatives.map((item) => `False negative: ${item}`),
      ...rule.scopeBoundaries.map((item) => `Scope: ${item}`),
    ];
    const evidence = rule.evidence
      .map((item) => {
        const url = /^https?:/u.test(item.url) ? item.url : `../${item.url}`;
        return `- [${item.claim}](${url}) — ${item.verifiedBy}, ${item.verifiedAt}; \`${item.verificationId}\`.`;
      })
      .join("\n");
    pages.push(`## ${rule.name}

${rule.description}

**Placements:** ${placements || "off"}. **Last verified:** ${rule.lastVerified}

### Applicability

${rule.applicability.authoring}; surfaces: ${rule.applicability.surfacesText}; confidence: ${rule.applicability.minimumSurfaceConfidence}; modes: ${modes}; scopes: ${rule.applicability.scopes.join(", ")}; releases: ${releases}; SDK: ${rule.applicability.fluentSdkRange ?? "n/a"}.

${options}
${renderExamples(rule.bad, "Incorrect")}
${renderExamples(rule.good, "Correct")}
### Boundaries

${rule.limitations}

${bulletList(boundaries)}
${rule.lifecycleAssumptions ? `\nLifecycle: ${rule.lifecycleAssumptions}\n` : ""}
${rule.overlaps.length ? `\nOverlaps: ${rule.overlaps.map((item) => `\`${item}\``).join(", ")}.\n` : ""}
### Evidence

${evidence}

[Catalog source](../src/catalog/${rule.name}.ts).
`);
  }
  await writeFile(rulesPath, pages.join("\n"));
  console.log("wrote docs/rules.md");
}

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
