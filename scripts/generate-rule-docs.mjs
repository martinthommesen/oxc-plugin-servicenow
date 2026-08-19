import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { ruleCatalog } = await import(
  pathToFileURL(join(root, "src/catalog.ts")).href
);

await mkdir(join(root, "docs/rules"), { recursive: true });

for (const rule of ruleCatalog) {
  const bad = rule.bad
    .map(
      (ex) =>
        `### ❌ ${ex.name}\n\n\`\`\`${ex.filename?.endsWith(".ts") ? "ts" : "js"}\n${ex.code}\n\`\`\`\n`,
    )
    .join("\n");
  const good = rule.good
    .map(
      (ex) =>
        `### ✅ ${ex.name}\n\n\`\`\`${ex.filename?.endsWith(".ts") ? "ts" : "js"}\n${ex.code}\n\`\`\`\n`,
    )
    .join("\n");

  const md = `# ${rule.ruleId}

${rule.description}

- **Family:** ${rule.family}
- **Preset:** ${rule.preset || "off"}
- **Default severity:** ${rule.severity}
- **Fixable:** ${rule.fixable ? "yes" : "no"}
- **Suggestions:** ${rule.hasSuggestions ? "yes" : "no"}

## Incorrect

${bad}
## Correct

${good}
## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
`;

  await writeFile(join(root, "docs/rules", `${rule.name}.md`), md);
  console.log("wrote", rule.name);
}
