import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = join(root, "artifacts");
const reportPath = join(artifacts, "doc-evidence-test-results.json");

function exactDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function runEvidenceTests() {
  mkdirSync(artifacts, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      join(root, "scripts/run-tests.mjs"),
      "tests/catalog-evidence.test.ts",
      "--report-json",
      reportPath,
    ],
    { cwd: root, stdio: ["ignore", "inherit", "inherit"] },
  );
  if (result.status !== 0)
    throw new Error(`catalog evidence tests failed with status ${result.status}`);
  return JSON.parse(readFileSync(reportPath, "utf8"));
}

export async function verifyDocEvidence(catalog, report) {
  const errors = [];
  const ids = new Set();
  const tests = new Map();
  for (const test of report.tests) {
    const key = `${test.file}::${test.fullName}`;
    const values = tests.get(key) ?? [];
    values.push(test);
    tests.set(key, values);
  }
  const records = [];
  for (const rule of catalog) {
    const dates = [];
    let normative = 0;
    let automated = 0;
    for (const evidence of rule.evidence) {
      dates.push(evidence.verifiedAt);
      if (ids.has(evidence.verificationId))
        errors.push(`duplicate verification ID ${evidence.verificationId}`);
      ids.add(evidence.verificationId);
      if (!exactDate(evidence.verifiedAt))
        errors.push(`${evidence.verificationId} has an invalid date`);
      if (evidence.verifiedAt > new Date().toISOString().slice(0, 10))
        errors.push(`${evidence.verificationId} has a future date`);
      if (evidence.verifiedBy === "manual") {
        let url;
        try {
          url = new URL(evidence.url);
        } catch {
          errors.push(`${evidence.verificationId} manual evidence is not a URL`);
        }
        if (url && (url.protocol !== "https:" || url.hostname !== "www.servicenow.com")) {
          errors.push(`${evidence.verificationId} has an untrusted normative source`);
        }
        normative += 1;
        records.push({
          id: evidence.verificationId,
          rule: rule.name,
          kind: "normative",
          source: evidence.url,
          verifiedAt: evidence.verifiedAt,
        });
        continue;
      }
      automated += 1;
      if (/^https?:/.test(evidence.url))
        errors.push(`${evidence.verificationId} automated evidence must use a local source`);
      const fullName = `catalog evidence > ${rule.name}: ${evidence.verificationId}`;
      const proof = tests.get(`tests/catalog-evidence.test.ts::${fullName}`) ?? [];
      if (proof.length !== 1)
        errors.push(`${evidence.verificationId} exact proof occurs ${proof.length} times`);
      else if (proof[0].status !== "passed" || proof[0].skipped || proof[0].todo)
        errors.push(`${evidence.verificationId} exact proof did not pass cleanly`);
      records.push({
        id: evidence.verificationId,
        rule: rule.name,
        kind: "automated",
        source: evidence.url,
        test: { file: "tests/catalog-evidence.test.ts", fullName, caseId: evidence.verificationId },
        verifiedAt: evidence.verifiedAt,
      });
    }
    const latest = dates.sort().at(-1) ?? "";
    if (rule.lastVerified !== latest)
      errors.push(`${rule.name} lastVerified does not match successful evidence metadata`);
    if (
      rule.preset === "recommended" &&
      rule.severity === "error" &&
      (normative === 0 || automated === 0)
    ) {
      errors.push(`${rule.name} needs separate normative and automated evidence`);
    }
  }
  return { errors, records };
}

export async function main() {
  const report = runEvidenceTests();
  const { ruleCatalog } = await import(pathToFileURL(join(root, "src/catalog.ts")).href);
  const result = await verifyDocEvidence(ruleCatalog, report);
  const artifact = {
    schemaVersion: 1,
    ok: result.errors.length === 0,
    capturedAt: new Date().toISOString(),
    node: process.version,
    npm: execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(),
    records: result.records,
    errors: result.errors,
  };
  writeFileSync(join(artifacts, "doc-evidence.json"), `${JSON.stringify(artifact, null, 2)}\n`);
  if (result.errors.length > 0) throw new Error(result.errors.join("\n"));
  console.log(
    JSON.stringify(
      {
        ok: true,
        records: result.records.length,
        automated: result.records.filter((item) => item.kind === "automated").length,
      },
      null,
      2,
    ),
  );
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
