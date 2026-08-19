import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "../tests/helpers/rule-tester.ts";
import { applyRules } from "../src/runtime/apply-rules.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function glideRecordFixture(count) {
  const block = (index) => `var rec${index} = new GlideRecord("incident");
rec${index}.addQuery("active", true);
rec${index}.query();
while (rec${index}.next()) {
  gs.info(rec${index}.getValue("number"));
}
`;
  return Array.from({ length: count }, (_, index) => block(index)).join("\n");
}

const sizes = [20, 80, 200];
const rows = [];
for (const size of sizes) {
  const code = glideRecordFixture(size);
  const parsed = parse(code, "load.br.js");
  const started = Date.now();
  applyRules(code, parsed, { filename: "load.br.js" });
  const elapsed = Date.now() - started;
  rows.push({ size, elapsed });
  console.log(`GlideRecord blocks=${size} applyRules=${elapsed}ms`);
}

const small = rows[0].elapsed || 1;
const large = rows[rows.length - 1].elapsed;
const scale = large / small;
console.log(`scale ${rows[0].size} -> ${rows[rows.length - 1].size}: ${scale.toFixed(2)}x`);
if (large >= 2000) {
  throw new Error(`large fixture exceeded 2000ms (${large}ms)`);
}

if (process.argv.includes("--write")) {
  writeFileSync(
    join(root, "docs/performance-baseline.json"),
    `${JSON.stringify(
      {
        date: new Date().toISOString().slice(0, 10),
        node: process.version,
        oxlintPeer: ">=1.79.0 <2",
        command: "npm run bench",
        rows,
        thresholdMs: 2000,
      },
      null,
      2,
    )}\n`,
  );
}
