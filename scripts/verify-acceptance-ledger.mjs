import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const goalPath = join(root, "PR51-REMEDIATION-GOAL.md");
const mappingPath = join(root, "scripts/pr51-acceptance.json");
const artifactsDir = join(root, "artifacts");
const testReportPath = join(artifactsDir, "pr51-test-results.json");
const ACCEPTANCE_GOAL_SHA256 = "22f9e1d3d370eaa88001d8c7587f2878b7955a8d9b80922de5848696096a2dc1";
const ACCEPTANCE_AUTHORITY_DIGEST =
  "6f9473920d9ffde625bcf68418da08cde196282c91661c2d40608c9bfff68d02";

export function repoFilePath(path) {
  if (typeof path !== "string" || path === "" || path.includes("\0") || path.includes("\\")) {
    throw new Error(`unsafe repository path ${JSON.stringify(path)}`);
  }
  const resolved = resolve(root, path);
  const fromRoot = relative(root, resolved);
  if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith("../") || isAbsolute(fromRoot)) {
    throw new Error(`unsafe repository path ${JSON.stringify(path)}`);
  }
  return resolved;
}
const allowedDispositions = new Set([
  "Pending",
  "Reproduced",
  "Implemented",
  "Verified at exact head",
  "Superseded",
  "Not applicable",
  "Live-pending",
]);
const dispositionLabels = new Set([
  "Pending",
  "Reproduced",
  "Implemented",
  "Verified at exact head",
  "Superseded, with evidence",
  "Not applicable, with evidence",
  "Live-pending",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function criteriaAuthorityDigest(criteria, goalSha256) {
  return sha256(
    `${goalSha256}\n` +
      criteria
        .map((item) =>
          JSON.stringify({
            id: item.id,
            heading: item.source.heading,
            text: item.source.text,
            digest: item.source.digest,
          }),
        )
        .join("\n"),
  );
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function ownerForHeading(heading) {
  const section = Number(/^#{1,3} (\d+)\./.exec(heading)?.[1]);
  const owners = {
    4: [
      "plans/009-rebuild-stateful-rule-lifecycles.md",
      79,
      "pr51-remediation/009-stateful-rule-lifecycles",
    ],
    5: [
      "plans/010-authoritative-fluent-sdk-registry.md",
      80,
      "pr51-remediation/010-fluent-sdk-registry",
    ],
    6: [
      "plans/011-fix-now-id-and-fluent-directives.md",
      81,
      "pr51-remediation/011-now-id-directives",
    ],
    7: [
      "plans/012-fix-context-profiles-and-rule-contracts.md",
      82,
      "pr51-remediation/012-context-profiles-contracts",
    ],
    8: [
      "plans/013-narrow-public-api-and-fix-user-assets.md",
      83,
      "pr51-remediation/013-public-api-assets",
    ],
    9: [
      "plans/014-make-tests-evidence-and-compatibility-honest.md",
      84,
      "pr51-remediation/014-tests-evidence-compat",
    ],
    10: [
      "plans/015-prove-release-governance-and-provenance.md",
      85,
      "pr51-remediation/015-release-governance",
    ],
    12: [
      "plans/014-make-tests-evidence-and-compatibility-honest.md",
      84,
      "pr51-remediation/014-tests-evidence-compat",
    ],
  };
  if (section === 3) {
    if (heading.includes("3.3"))
      return {
        plan: "plans/008-fix-bindings-scopes-and-closures.md",
        pr: 78,
        branch: "pr51-remediation/008-bindings-scopes",
      };
    if (heading.includes("3.5"))
      return {
        plan: "plans/011-fix-now-id-and-fluent-directives.md",
        pr: 81,
        branch: "pr51-remediation/011-now-id-directives",
      };
    return {
      plan: "plans/007-rebuild-path-state-semantics.md",
      pr: 77,
      branch: "pr51-remediation/007-path-state",
    };
  }
  const owner = owners[section];
  return owner
    ? { plan: owner[0], pr: owner[1], branch: owner[2] }
    : { plan: null, pr: 51, branch: "tracking-only" };
}

/** Parse every normative bullet or numbered requirement after the introductory section. */
export function parseCriteria(source) {
  const lines = source.split(/\r?\n/);
  const criteria = [];
  const occurrences = new Map();
  let heading = "";
  let started = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^# \d+\./.test(line)) started = true;
    if (/^#{1,3} /.test(line)) {
      heading = line;
      continue;
    }
    if (!started || (!line.startsWith("- ") && !/^\d+\. /.test(line))) continue;
    const parts = [line.replace(/^(?:- |\d+\. )/, "")];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const next = lines[cursor];
      if (!next.trim()) break;
      if (/^#{1,3} |^- |^\d+\. /.test(next)) break;
      parts.push(next.trim());
      cursor += 1;
    }
    const text = normalize(parts.join(" "));
    if (heading.startsWith("# 2.") && dispositionLabels.has(text)) continue;
    const digest = sha256(text);
    const occurrenceKey = `${heading}\0${text}`;
    const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
    occurrences.set(occurrenceKey, occurrence);
    const identity = sha256(`${occurrenceKey}\0${occurrence}`);
    criteria.push({
      id: `PR51-${identity.slice(0, 12).toUpperCase()}`,
      source: { heading, line: index + 1, text, digest },
      owner: ownerForHeading(heading),
    });
  }
  return criteria;
}

function readMapping() {
  return JSON.parse(readFileSync(mappingPath, "utf8"));
}

export function validateMapping(parsed, mapping) {
  const errors = [];
  const sourceById = new Map(parsed.map((item) => [item.id, item]));
  const mappedById = new Map();
  for (const item of mapping.criteria ?? []) {
    if (mappedById.has(item.id)) errors.push(`duplicate mapping ${item.id}`);
    mappedById.set(item.id, item);
    const source = sourceById.get(item.id);
    if (!source) errors.push(`orphaned mapping ${item.id}`);
    else if (
      item.source.digest !== source.source.digest ||
      item.source.heading !== source.source.heading ||
      item.source.text !== source.source.text
    ) {
      errors.push(`changed source mapping ${item.id}`);
    }
    if (!allowedDispositions.has(item.disposition))
      errors.push(`${item.id} has invalid disposition ${item.disposition}`);
  }
  for (const item of parsed)
    if (!mappedById.has(item.id)) errors.push(`missing mapping ${item.id}`);
  return errors;
}

export function validateSnapshot(mapping) {
  const errors = [];
  const seen = new Set();
  const occurrences = new Map();
  for (const item of mapping.criteria ?? []) {
    if (seen.has(item.id)) errors.push(`duplicate mapping ${item.id}`);
    seen.add(item.id);
    if (item.source.digest !== sha256(item.source.text))
      errors.push(`changed source mapping ${item.id}`);
    const occurrenceKey = `${item.source.heading}\0${item.source.text}`;
    const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
    occurrences.set(occurrenceKey, occurrence);
    const expectedId = `PR51-${sha256(`${occurrenceKey}\0${occurrence}`).slice(0, 12).toUpperCase()}`;
    if (item.id !== expectedId) errors.push(`changed finding ID ${item.id}`);
    if (!allowedDispositions.has(item.disposition))
      errors.push(`${item.id} has invalid disposition ${item.disposition}`);
  }
  if (mapping.goal?.sha256 !== ACCEPTANCE_GOAL_SHA256) errors.push("goal authority changed");
  if (
    mapping.criteriaDigest !== ACCEPTANCE_AUTHORITY_DIGEST ||
    mapping.criteriaDigest !== criteriaAuthorityDigest(mapping.criteria ?? [], mapping.goal?.sha256)
  )
    errors.push("criteria authority digest changed");
  if (mapping.criteria?.length !== mapping.goal?.criteria)
    errors.push("goal criterion count changed");
  if (mapping.goal?.criteriaSha256 !== criteriaSha256(mapping.criteria ?? []))
    errors.push("goal criteria digest changed");
  return errors;
}

export function criteriaSha256(criteria) {
  return sha256(
    JSON.stringify(
      criteria.map(({ id, source }) => ({
        id,
        heading: source.heading,
        line: source.line,
        text: source.text,
        digest: source.digest,
      })),
    ),
  );
}

function updateMapping(source, parsed) {
  let previous = { criteria: [] };
  try {
    previous = readMapping();
  } catch {}
  const byId = new Map(previous.criteria.map((item) => [item.id, item]));
  const criteria = parsed.map((item) => {
    const old = byId.get(item.id);
    return {
      ...item,
      severity: old?.severity ?? "unspecified",
      subsystem: old?.subsystem ?? item.source.heading.replace(/^#+\s*/, ""),
      disposition: old?.disposition ?? "Pending",
      reproduction: old?.reproduction ?? null,
      implementationFiles: old?.implementationFiles ?? [],
      proofs: old?.proofs ?? [],
      caseIds: old?.caseIds ?? [],
      fixtures: old?.fixtures ?? [],
      command: old?.command ?? null,
      remaining: old?.remaining ?? null,
      evidence: old?.evidence ?? null,
    };
  });
  const result = {
    schemaVersion: 1,
    goal: {
      path: "PR51-REMEDIATION-GOAL.md",
      sha256: sha256(source),
      criteria: criteria.length,
      criteriaSha256: criteriaSha256(criteria),
    },
    criteriaDigest: criteriaAuthorityDigest(criteria, sha256(source)),
    criteria,
  };
  writeFileSync(mappingPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function git(args) {
  return execFileSync("git", ["-c", "core.fsmonitor=false", ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  }).trim();
}

function worktreeIdentity() {
  const head = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  const diff = execFileSync(
    "git",
    ["-c", "core.fsmonitor=false", "diff", "--binary", "HEAD", "--", "."],
    {
      cwd: root,
      maxBuffer: 50 * 1024 * 1024,
    },
  );
  const untracked = status
    .split("\n")
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3))
    .sort();
  const hash = createHash("sha256").update(status).update(diff);
  for (const path of untracked) hash.update(path).update(readFileSync(repoFilePath(path)));
  const clean = status === "";
  return {
    head,
    clean,
    diffDigest: clean ? null : hash.digest("hex"),
    testedIdentity: clean ? head : "uncommitted",
  };
}

function runTests() {
  mkdirSync(artifactsDir, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/run-tests.mjs"), "--report-json", testReportPath],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  if (result.status !== 0)
    throw new Error(`node:test inventory failed with status ${result.status}`);
  return JSON.parse(readFileSync(testReportPath, "utf8"));
}

export function searchableRepoFiles() {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(relative(root, path));
    }
  };
  for (const directory of ["src", "scripts", "tests"]) visit(join(root, directory));
  return files.filter((path) => path !== "scripts/pr51-acceptance.json");
}

function verifyProofs(mapping, report) {
  const errors = [];
  const byKey = new Map();
  for (const test of report.tests) {
    const key = `${test.file}::${test.fullName}`;
    const entries = byKey.get(key) ?? [];
    entries.push(test);
    byKey.set(key, entries);
  }
  const searchableFiles = searchableRepoFiles();
  for (const item of mapping.criteria) {
    if (item.disposition === "Verified at exact head") {
      if (!item.command || item.proofs.length === 0)
        errors.push(`${item.id} is verified without an exact command and proof`);
      for (const proof of item.proofs) {
        const matches = byKey.get(`${proof.file}::${proof.fullName}`) ?? [];
        if (matches.length !== 1)
          errors.push(
            `${item.id} proof ${proof.file}::${proof.fullName} occurs ${matches.length} times`,
          );
        else if (matches[0].status !== "passed" || matches[0].skipped || matches[0].todo)
          errors.push(`${item.id} proof did not pass cleanly: ${proof.fullName}`);
      }
    }
    if (
      (item.disposition === "Superseded" || item.disposition === "Not applicable") &&
      !item.evidence
    ) {
      errors.push(`${item.id} ${item.disposition} requires evidence`);
    }
    for (const caseId of item.caseIds) {
      const occurrences = searchableFiles.reduce(
        (count, path) => count + (readFileSync(join(root, path), "utf8").includes(caseId) ? 1 : 0),
        0,
      );
      if (occurrences === 0) errors.push(`${item.id} references absent case ID ${caseId}`);
    }
    for (const fixture of item.fixtures) {
      const actual = sha256(readFileSync(repoFilePath(fixture.path)));
      if (actual !== fixture.sha256)
        errors.push(`${item.id} fixture digest changed: ${fixture.path}`);
    }
  }
  return errors;
}

function markdownCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", "<br>");
}

function proofLabel(item) {
  return item.proofs.map((proof) => `\`${proof.file}\` — ${proof.fullName}`).join("<br>") || "—";
}

function generateDocs(mapping, artifact) {
  const rows = mapping.criteria.map(
    (item) =>
      `| ${item.id} | #${item.owner.pr} | ${markdownCell(item.source.heading)} | ${markdownCell(item.source.text)} | ${item.disposition} | ${proofLabel(item)} |`,
  );
  const ledger = `# PR #51 acceptance ledger\n\nThis file is generated from the authoritative goal and \`scripts/pr51-acceptance.json\`. The committed ledger maps requirements. It cannot prove the commit that contains itself. Current execution evidence is written to \`artifacts/pr51-acceptance.json\` and records either an exact clean commit or \`uncommitted\` with a diff digest.\n\n- Goal SHA-256: \`${mapping.goal.sha256}\`\n- Atomic requirements: ${mapping.criteria.length}\n- Verified at exact head: ${artifact.summary.verified}\n- Pending: ${artifact.summary.pending}\n- Live-pending: ${artifact.summary.livePending}\n\n| Finding ID | Owner | Source | Exact requirement | Disposition | Exact proof |\n| --- | ---: | --- | --- | --- | --- |\n${rows.join("\n")}\n`;
  writeFileSync(join(root, "docs/pr-51-acceptance-ledger.md"), ledger);
  const report = `# PR #51 remediation validation report\n\nThis generated report describes the latest local acceptance capture. It does not convert historical runs into current proof.\n\n## Evidence identity\n\n- Tested identity: \`${artifact.identity.testedIdentity}\`\n- HEAD: \`${artifact.identity.head}\`\n- Worktree: ${artifact.identity.clean ? "clean" : "uncommitted"}\n- Diff digest: ${artifact.identity.diffDigest ? `\`${artifact.identity.diffDigest}\`` : "not applicable"}\n- Node: \`${artifact.runtime.node}\`\n- npm: \`${artifact.runtime.npm}\`\n- Host: \`${artifact.runtime.platform} ${artifact.runtime.arch} ${artifact.runtime.release}\`\n- Captured: \`${artifact.capturedAt}\`\n\n## Result\n\n- Tests inventoried: ${artifact.testResults.total}\n- Passed: ${artifact.testResults.passed}\n- Failed: ${artifact.testResults.failed}\n- Verified criteria: ${artifact.summary.verified}\n- Pending criteria: ${artifact.summary.pending}\n- Live-pending criteria: ${artifact.summary.livePending}\n- Acceptance complete: ${artifact.complete ? "yes" : "no"}\n\nSee [the atomic ledger](pr-51-acceptance-ledger.md) for exact mappings.\n`;
  writeFileSync(join(root, "docs/pr-51-validation-report.md"), report);
  writeFileSync(join(artifactsDir, "pr51-acceptance.md"), report);
}

export async function main(argv = process.argv.slice(2)) {
  const update = argv.includes("--update");
  if (update && !existsSync(goalPath))
    throw new Error("--update requires PR51-REMEDIATION-GOAL.md from the tracking branch");
  const source = update ? readFileSync(goalPath, "utf8") : null;
  const parsed = source === null ? null : parseCriteria(source);
  const mapping = update ? updateMapping(source, parsed) : readMapping();
  const errors = update ? validateMapping(parsed, mapping) : validateSnapshot(mapping);
  if (
    source !== null &&
    (mapping.goal.sha256 !== sha256(source) || mapping.goal.criteria !== parsed.length)
  )
    errors.push("goal identity or criterion count changed");
  const report = argv.includes("--update") ? { tests: [] } : runTests();
  if (!argv.includes("--update")) errors.push(...verifyProofs(mapping, report));
  const identity = worktreeIdentity();
  if (process.env.CI && (!identity.clean || process.env.GITHUB_SHA !== identity.head))
    errors.push("CI acceptance evidence requires a clean exact GITHUB_SHA");
  const summary = {
    verified: mapping.criteria.filter((item) => item.disposition === "Verified at exact head")
      .length,
    pending: mapping.criteria.filter((item) =>
      ["Pending", "Reproduced", "Implemented"].includes(item.disposition),
    ).length,
    livePending: mapping.criteria.filter((item) => item.disposition === "Live-pending").length,
  };
  const testResults = {
    total: report.tests.length,
    passed: report.tests.filter((item) => item.status === "passed" && !item.skipped && !item.todo)
      .length,
    failed: report.tests.filter((item) => item.status !== "passed").length,
    skipped: report.tests.filter((item) => item.skipped).length,
    todo: report.tests.filter((item) => item.todo).length,
  };
  const artifact = {
    schemaVersion: 1,
    ok: errors.length === 0,
    complete: errors.length === 0 && summary.pending === 0 && summary.livePending === 0,
    capturedAt: new Date().toISOString(),
    goal: mapping.goal,
    identity,
    runtime: {
      node: process.version,
      npm: execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(),
      platform: platform(),
      arch: arch(),
      release: release(),
    },
    commands: [
      "node scripts/run-tests.mjs --report-json artifacts/pr51-test-results.json",
      "tsx scripts/verify-acceptance-ledger.mjs",
    ],
    testResults,
    summary,
    errors,
  };
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(
    join(artifactsDir, "pr51-acceptance.json"),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  generateDocs(mapping, artifact);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  console.log(
    JSON.stringify(
      {
        ok: true,
        complete: artifact.complete,
        criteria: mapping.criteria.length,
        ...summary,
        tests: testResults,
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
