import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { exactProof, indexOutcomes } from "./lib/test-report.mjs";
import { isValidIsoDate } from "./lib/iso-date.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = join(root, "artifacts");

/**
 * @typedef {object} EvidenceTestReport
 * @property {readonly unknown[]} [tests]
 */
/**
 * @typedef {object} EvidenceResult
 * @property {readonly string[]} errors
 * @property {readonly unknown[]} records
 */

/**
 * @param {string} [base]
 * @returns {string}
 */
export function evidenceTestReportPath(base = tmpdir()) {
  return join(mkdtempSync(join(base, "oxc-plugin-servicenow-evidence-")), "test-results.json");
}

/**
 * @param {string} [base]
 * @returns {EvidenceTestReport}
 */
export function runEvidenceTests(base = tmpdir()) {
  const reportPath = evidenceTestReportPath(base);
  const environment = { ...process.env };
  delete environment["NODE_TEST_CONTEXT"];
  try {
    const result = spawnSync(
      process.execPath,
      [
        join(root, "scripts/run-tests.mjs"),
        "tests/catalog-evidence.test.ts",
        "--report-json",
        reportPath,
      ],
      { cwd: root, env: environment, stdio: ["ignore", "inherit", "inherit"] },
    );
    if (result.status !== 0)
      throw new Error(`catalog evidence tests failed with status ${result.status}`);
    return JSON.parse(readFileSync(reportPath, "utf8"));
  } finally {
    rmSync(dirname(reportPath), { recursive: true, force: true });
  }
}

/**
 * @param {string} path
 * @param {unknown} value
 * @returns {void}
 */
export function writeJsonArtifact(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryDirectory = mkdtempSync(join(dirname(path), ".atomic-artifact-"));
  const temporaryPath = join(temporaryDirectory, "artifact.json");
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

/**
 * @param {readonly unknown[]} catalog
 * @param {EvidenceTestReport} report
 * @returns {Promise<EvidenceResult>}
 */
export async function verifyDocEvidence(catalog, report) {
  const errors = [];
  const ids = new Set();
  const testReport = /** @type {import("./lib/test-report-types.js").TestReport} */ (
    /** @type {unknown} */ (report)
  );
  const tests = indexOutcomes(testReport);
  const records = [];
  const today = new Date().toISOString().slice(0, 10);
  const rules = /** @type {Array<any>} */ (catalog);
  for (const rule of rules) {
    const dates = [];
    let normative = 0;
    let automated = 0;
    for (const evidence of rule.evidence) {
      dates.push(evidence.verifiedAt);
      if (ids.has(evidence.verificationId))
        errors.push(`duplicate verification ID ${evidence.verificationId}`);
      ids.add(evidence.verificationId);
      if (!isValidIsoDate(evidence.verifiedAt))
        errors.push(`${evidence.verificationId} has an invalid date`);
      if (evidence.verifiedAt > today) errors.push(`${evidence.verificationId} has a future date`);
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
      const proof = exactProof(tests, "tests/catalog-evidence.test.ts", fullName);
      if (proof.status === "missing" || proof.status === "ambiguous") {
        errors.push(`${evidence.verificationId} exact proof occurs ${proof.count} times`);
      } else if (proof.status === "not-clean") {
        errors.push(`${evidence.verificationId} exact proof did not pass cleanly`);
      }
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
      rule.placements.some(
        /** @param {any} placement */ (placement) => placement.profile === "recommended",
      ) &&
      rule.severity === "error" &&
      (normative === 0 || automated === 0)
    ) {
      errors.push(`${rule.name} needs separate normative and automated evidence`);
    }
  }
  return { errors, records };
}

/**
 * @returns {Promise<unknown>}
 */
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
  writeJsonArtifact(join(artifacts, "doc-evidence.json"), artifact);
  if (result.errors.length > 0) throw new Error(result.errors.join("\n"));
  console.log(
    JSON.stringify(
      {
        ok: true,
        records: result.records.length,
        automated: result.records.filter(
          (item) => /** @type {{ kind?: unknown }} */ (item).kind === "automated",
        ).length,
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
