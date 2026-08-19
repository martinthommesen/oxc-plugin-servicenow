import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { ruleCatalog } = await import(pathToFileURL(join(root, "src/catalog.ts")).href);
const { DEFAULT_FLUENT_MANIFEST } = await import(
  pathToFileURL(join(root, "src/fluent/manifest.ts")).href
);
const { recommendedRules } = await import(pathToFileURL(join(root, "src/configs/maps.ts")).href);

const docsDir = join(root, "docs/rules");
await mkdir(docsDir, { recursive: true });

function presetLabel(rule) {
  if (rule.preset) return rule.preset;
  return rule.placements[0]?.profile ?? "off";
}

function summary(rule) {
  return rule.description.split(". ")[0].replace(/\.$/, "");
}

function fenceLang(filename) {
  return filename?.endsWith(".ts") ? "ts" : "js";
}

function tableRow(rule, includeFix) {
  const link = `[\`${rule.name}\`](docs/rules/${rule.name}.md)`;
  const preset = presetLabel(rule);
  const fix = rule.fixable ? "fix" : rule.hasSuggestions ? "suggest" : "";
  const catchText = summary(rule);
  if (includeFix) {
    return `| ${link} | ${preset} | ${fix} | ${catchText} |`;
  }
  return `| ${link} | ${preset} | ${catchText} |`;
}

function replaceMarkedSection(source, name, body) {
  const start = `<!-- generated:${name}:start -->`;
  const end = `<!-- generated:${name}:end -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(source)) {
    throw new Error(`Missing ${start} / ${end} markers`);
  }
  return source.replace(pattern, `${start}\n${body.trim()}\n${end}`);
}

function recommendedRulesJson() {
  const lines = Object.entries(recommendedRules).map(
    ([id, severity]) => `    ${JSON.stringify(id)}: ${JSON.stringify(severity)}`,
  );
  return `{\n${lines.join(",\n")}\n  }`;
}

async function writeRuleDocs() {
  const keep = new Set();
  for (const rule of ruleCatalog) {
    keep.add(`${rule.name}.md`);
    const bad = rule.bad
      .map(
        (ex) =>
          `### Incorrect: ${ex.name}\n\n\`\`\`${fenceLang(ex.filename)}\n${ex.code}\n\`\`\`\n`,
      )
      .join("\n");
    const good = rule.good
      .map(
        (ex) =>
          `### Correct: ${ex.name}\n\n\`\`\`${fenceLang(ex.filename)}\n${ex.code}\n\`\`\`\n`,
      )
      .join("\n");
    const evidence =
      rule.evidence.length > 0
        ? rule.evidence.map((url) => `- ${url}`).join("\n")
        : "- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.";
    const placements = rule.placements
      .map((placement) => `${placement.profile} (${placement.severity})`)
      .join(", ");
    const md = `# ${rule.ruleId}

${rule.description}

- **Family:** ${rule.family}
- **Preset:** ${presetLabel(rule)}
- **Placements:** ${placements || "off"}
- **Default severity:** ${rule.severity}
- **Fix safety:** ${rule.fixKind === "none" ? "diagnostic only" : rule.fixKind}
- **Suggestions:** ${rule.hasSuggestions ? "yes" : "no"}
- **Authoring:** ${rule.applicability.authoring}
- **Surfaces:** ${rule.applicability.surfaces}
- **JavaScript mode:** ${rule.applicability.javascriptMode}
- **Implementation:** [\`src/rules/${rule.name}.ts\`](../../src/rules/${rule.name}.ts)${
      rule.family === "fluent" ? `\n- **Fluent manifest:** ${DEFAULT_FLUENT_MANIFEST.version}` : ""
    }

## Incorrect

${bad}
## Correct

${good}
## Limitations

${rule.limitations}

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

async function writeReadmeTables() {
  const readmePath = join(root, "README.md");
  let readme = await readFile(readmePath, "utf8");
  const classic = [
    "| Rule | Preset | Fix | What it catches |",
    "| --- | --- | --- | --- |",
    ...ruleCatalog.filter((rule) => rule.family === "classic").map((rule) => tableRow(rule, true)),
  ].join("\n");
  const engine = [
    "| Rule | Preset | What it catches |",
    "| --- | --- | --- |",
    ...ruleCatalog.filter((rule) => rule.family === "engine").map((rule) => tableRow(rule, false)),
  ].join("\n");
  const fluent = [
    "| Rule | Preset | Fix | What it catches |",
    "| --- | --- | --- | --- |",
    ...ruleCatalog.filter((rule) => rule.family === "fluent").map((rule) => tableRow(rule, true)),
  ].join("\n");
  readme = replaceMarkedSection(readme, "classic-rules", classic);
  readme = replaceMarkedSection(readme, "engine-rules", engine);
  readme = replaceMarkedSection(readme, "fluent-rules", fluent);
  await writeFile(readmePath, readme);
  console.log("updated README rule tables");
}

async function writeOxlintrcRules(path, specifierComment) {
  const current = JSON.parse(await readFile(path, "utf8"));
  current.rules = recommendedRules;
  await writeFile(path, `${JSON.stringify(current, null, 2)}\n`);
  console.log("updated", specifierComment, path);
}

await writeRuleDocs();
await writeReadmeTables();
await writeOxlintrcRules(join(root, "examples/.oxlintrc.json"), "examples");
await writeOxlintrcRules(
  join(root, "tests/integration/profiles/configs/recommended.oxlintrc.json"),
  "recommended fixture",
);
await writeOxlintrcRules(join(root, "tests/integration/profiles/mixed/.oxlintrc.json"), "mixed");
await writeOxlintrcRules(join(root, "tests/integration/fixtures/.oxlintrc.json"), "fixtures");
console.log("recommended rule count", Object.keys(recommendedRules).length);
