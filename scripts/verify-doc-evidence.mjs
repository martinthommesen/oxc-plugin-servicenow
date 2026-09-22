import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { exactProof, indexOutcomes } from "./lib/test-report.mjs";
import { isValidIsoDate } from "./lib/iso-date.mjs";
import { readJson, writeJsonArtifact } from "./lib/json-artifact.mjs";
import { isMainModule, root } from "./lib/repo.mjs";

export { writeJsonArtifact };

const artifacts = join(root, "artifacts");

/** @typedef {import("./lib/test-report-types.js").TestReport} TestReport */
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
 * @returns {TestReport}
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
    return readJson(reportPath);
  } finally {
    rmSync(dirname(reportPath), { recursive: true, force: true });
  }
}

/**
 * @param {readonly unknown[]} catalog
 * @param {TestReport} report
 * @returns {Promise<EvidenceResult>}
 */
export async function verifyDocEvidence(catalog, report) {
  const errors = [];
  const ids = new Set();
  const tests = indexOutcomes(report);
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

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
