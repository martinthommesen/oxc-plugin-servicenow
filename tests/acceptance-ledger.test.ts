import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  acceptanceTestReportPath,
  criteriaSha256,
  parseCriteria,
  repoFilePath,
  searchableRepoFiles,
  criteriaAuthorityDigest,
  validateMapping,
  validateSnapshot,
  worktreeIdentity,
} from "../scripts/verify-acceptance-ledger.mjs";
import { withAcceptanceLock } from "../scripts/lib/acceptance-lock.mjs";
import { repoRoot } from "./integration/helpers.js";

const mapping = JSON.parse(
  readFileSync(path.join(repoRoot, "scripts/pr51-acceptance.json"), "utf8"),
);

const lockWorkerSource = `
import { appendFile, access, writeFile } from "node:fs/promises";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const waitForFile = async (filePath) => {
  while (true) {
    try {
      await access(filePath);
      return;
    } catch {
      await delay(2);
    }
  }
};
const id = process.env.ACCEPTANCE_LOCK_WORKER_ID;
const mode = process.env.ACCEPTANCE_LOCK_WORKER_MODE;
const readyPath = process.env.ACCEPTANCE_LOCK_READY_PATH;
const preparedPath = process.env.ACCEPTANCE_LOCK_PREPARED_PATH;
const startPath = process.env.ACCEPTANCE_LOCK_START_PATH;
const gatePath = process.env.ACCEPTANCE_LOCK_GATE_PATH;
const eventsPath = process.env.ACCEPTANCE_LOCK_EVENTS_PATH;
const lockPath = process.env.ACCEPTANCE_LOCK_PATH;
const modulePath = process.env.ACCEPTANCE_LOCK_MODULE;
const operationDelay = Number(process.env.ACCEPTANCE_LOCK_OPERATION_DELAY ?? 80);

const { withAcceptanceLock } = await import(modulePath);
const hooks = {};
if (mode === "publish") {
  hooks.beforeLockPublish = async () => {
    await writeFile(preparedPath, "prepared\\n");
    await waitForFile(gatePath);
  };
}
if (mode === "reclaim") {
  hooks.beforeReclaim = async () => {
    await writeFile(preparedPath, "prepared\\n");
    await waitForFile(gatePath);
  };
}
await writeFile(readyPath, "ready\\n");
await waitForFile(startPath);
await withAcceptanceLock(
  async () => {
    await appendFile(eventsPath, "start:" + id + "\\n");
    await delay(operationDelay);
    await appendFile(eventsPath, "end:" + id + "\\n");
  },
  { lockPath, pollIntervalMs: 2, waitTimeoutMs: 5_000, hooks },
);
`;

async function waitForFile(filePath: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      await access(filePath);
      return;
    } catch {
      if (Date.now() >= deadline) throw new Error(`timed out waiting for ${filePath}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
}

async function waitForText(filePath: string, text: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      if (readFileSync(filePath, "utf8").includes(text)) return;
    } catch {
      // The worker has not written its first event yet.
    }
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${text} in ${filePath}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function spawnLockWorker(base: string, id: string, mode = "normal", operationDelay = 80) {
  const lockPath = path.join(base, "lock");
  const readyPath = path.join(base, `${id}-ready`);
  const preparedPath = path.join(base, `${id}-prepared`);
  const startPath = path.join(base, "start");
  const gatePath = path.join(base, "gate");
  const eventsPath = path.join(base, "events");
  const modulePath = new URL("../scripts/lib/acceptance-lock.mjs", import.meta.url).href;
  const child = spawn(process.execPath, ["--input-type=module", "-e", lockWorkerSource], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ACCEPTANCE_LOCK_EVENTS_PATH: eventsPath,
      ACCEPTANCE_LOCK_GATE_PATH: gatePath,
      ACCEPTANCE_LOCK_MODULE: modulePath,
      ACCEPTANCE_LOCK_PATH: lockPath,
      ACCEPTANCE_LOCK_PREPARED_PATH: preparedPath,
      ACCEPTANCE_LOCK_READY_PATH: readyPath,
      ACCEPTANCE_LOCK_START_PATH: startPath,
      ACCEPTANCE_LOCK_WORKER_ID: id,
      ACCEPTANCE_LOCK_WORKER_MODE: mode,
      ACCEPTANCE_LOCK_OPERATION_DELAY: String(operationDelay),
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  const done = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${id} worker exited with ${signal ?? `status ${code}`}: ${stderr}`));
    });
  });
  void done.catch(() => undefined);
  return { child, done, eventsPath, gatePath, lockPath, preparedPath, readyPath, startPath };
}

// @lat: [[tests#Release governance#Every acceptance criterion maps to one proof]]
describe("PR51 acceptance mapping", () => {
  it("maps every authoritative atomic requirement exactly once", () => {
    assert.equal(mapping.goal.criteria, 533);
    assert.equal(
      mapping.goal.sha256,
      "22f9e1d3d370eaa88001d8c7587f2878b7955a8d9b80922de5848696096a2dc1",
    );
    assert.equal(mapping.goal.criteriaSha256, criteriaSha256(mapping.criteria));
    assert.deepEqual(validateSnapshot(mapping), []);
    assert.equal(
      mapping.criteria.find(
        (item: { source: { heading: string }; owner: { pr: number } }) =>
          item.source.heading === "## 4.1 Central method authority",
      )?.owner.pr,
      79,
    );
  });

  it("rejects missing, duplicate, changed, and orphaned mappings", () => {
    const source = "# Goal\n\n# 1. Requirements\n\n- first\n- second\n";
    const criteria = parseCriteria(source);
    const fixture = {
      goal: { criteria: criteria.length },
      criteria: criteria.map((item) => ({ ...item, disposition: "Pending" })),
    };
    const missing = structuredClone(fixture);
    missing.criteria.pop();
    assert.ok(
      validateMapping(criteria, missing).some((error) => error.startsWith("missing mapping")),
    );

    const duplicate = structuredClone(fixture);
    duplicate.criteria.push(structuredClone(duplicate.criteria[0]!));
    assert.ok(
      validateMapping(criteria, duplicate).some((error) => error.startsWith("duplicate mapping")),
    );

    const changed = structuredClone(fixture);
    changed.criteria[0]!.source.text += " changed";
    assert.ok(
      validateMapping(criteria, changed).some((error) => error.startsWith("changed source")),
    );

    const changedSnapshot = structuredClone(mapping);
    changedSnapshot.criteria[0]!.source.text += " changed";
    changedSnapshot.criteria[0]!.source.digest =
      "26cefa8d3b3bb5c0fac67cebe1984393308d3376aa9ed573eb88a50b478947f1";
    assert.ok(validateSnapshot(changedSnapshot).includes("goal criteria digest changed"));

    const orphaned = structuredClone(fixture);
    orphaned.criteria[0]!.id = "PR51-ORPHANED";
    assert.ok(
      validateMapping(criteria, orphaned).some((error) => error.startsWith("orphaned mapping")),
    );
  });

  it("binds row identity and source text to an aggregate authority digest", () => {
    const mutated = structuredClone(mapping);
    mutated.criteria[0].id = "PR51-MUTATED";
    mutated.criteria[0].source.text = "mutated requirement";
    mutated.criteria[0].source.digest = "mutated digest";
    mutated.criteriaDigest = criteriaAuthorityDigest(mutated.criteria, mutated.goal.sha256);
    assert.equal(mutated.goal.sha256, mapping.goal.sha256);
    assert.ok(validateSnapshot(mutated).includes("criteria authority digest changed"));
  });

  it("keeps fixture reads inside the repository", () => {
    assert.equal(repoFilePath("tests/acceptance-ledger.test.ts"), import.meta.filename);
    for (const unsafe of ["../outside", "/tmp/outside", "folder\\outside", ""]) {
      assert.throws(() => repoFilePath(unsafe), /unsafe repository path/);
    }
  });

  it("allocates a unique report path for each acceptance run", () => {
    const base = mkdtempSync(path.join(tmpdir(), "acceptance-report-test-"));
    try {
      const first = acceptanceTestReportPath(base);
      const second = acceptanceTestReportPath(base);
      assert.notEqual(first, second);
      assert.equal(path.dirname(first) === path.dirname(second), false);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("serializes shared test runs and recovers after a failed owner", async () => {
    const base = mkdtempSync(path.join(tmpdir(), "acceptance-lock-test-"));
    const lockPath = path.join(base, "lock");
    const options = { lockPath, pollIntervalMs: 1, waitTimeoutMs: 1_000 };
    const events: string[] = [];
    try {
      await assert.rejects(
        withAcceptanceLock(async () => {
          events.push("failed-start");
          throw new Error("owner failed");
        }, options),
        /owner failed/,
      );
      let resolveFirstStarted!: () => void;
      const firstStarted = new Promise<void>((resolve) => {
        resolveFirstStarted = resolve;
      });
      const first = withAcceptanceLock(async () => {
        events.push("first-start");
        resolveFirstStarted();
        await new Promise((resolve) => setTimeout(resolve, 20));
        events.push("first-end");
      }, options);
      await firstStarted;
      const second = withAcceptanceLock(async () => {
        events.push("second-start");
        events.push("second-end");
      }, options);
      await Promise.all([first, second]);
      assert.deepEqual(events, [
        "failed-start",
        "first-start",
        "first-end",
        "second-start",
        "second-end",
      ]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  // @lat: [[tests#Scripts and tooling#Acceptance runs serialize across processes]]
  it("serializes lock holders in separate Node processes", async () => {
    const base = mkdtempSync(path.join(tmpdir(), "acceptance-lock-process-test-"));
    const workers = ["first", "second"].map((id) => spawnLockWorker(base, id));
    try {
      await Promise.all(workers.map(({ readyPath }) => waitForFile(readyPath)));
      writeFileSync(workers[0]!.startPath, "go\\n");
      await Promise.all(workers.map(({ done }) => done));
      const events = readFileSync(workers[0]!.eventsPath, "utf8").trim().split("\n");
      assert.equal(events.length, 4);
      assert.match(events[0] ?? "", /^start:(first|second)$/);
      const firstId = events[0]?.slice("start:".length);
      assert.equal(events[1], `end:${firstId}`);
      assert.match(events[2] ?? "", /^start:(first|second)$/);
      const secondId = events[2]?.slice("start:".length);
      assert.notEqual(firstId, secondId);
      assert.equal(events[3], `end:${secondId}`);
    } finally {
      for (const { child } of workers) {
        if (child.exitCode === null) child.kill();
      }
      await Promise.allSettled(workers.map(({ done }) => done));
      rmSync(base, { recursive: true, force: true });
    }
  });

  // @lat: [[tests#Scripts and tooling#Stale reclamation keeps one owner]]
  it("does not let stale reclaimers delete a replacement owner", async () => {
    const base = mkdtempSync(path.join(tmpdir(), "acceptance-lock-reclaim-race-test-"));
    const lockPath = path.join(base, "lock");
    writeFileSync(lockPath, `${JSON.stringify({ pid: 99_999_999, token: "stale" })}\n`);
    const first = spawnLockWorker(base, "first", "reclaim", 20);
    let second: ReturnType<typeof spawnLockWorker> | undefined;
    try {
      await waitForFile(first.readyPath);
      writeFileSync(first.startPath, "go\\n");
      await waitForFile(first.preparedPath);
      second = spawnLockWorker(base, "second", "normal", 20);
      await waitForFile(second.readyPath);
      await new Promise((resolve) => setTimeout(resolve, 60));
      assert.throws(() => readFileSync(first.eventsPath, "utf8"), /ENOENT/);
      writeFileSync(first.gatePath, "release\\n");
      await Promise.all([first.done, second.done]);
      assert.deepEqual(readFileSync(first.eventsPath, "utf8").trim().split("\n"), [
        "start:first",
        "end:first",
        "start:second",
        "end:second",
      ]);
    } finally {
      const workers = second === undefined ? [first] : [first, second];
      for (const worker of workers) {
        if (worker.child.exitCode === null) worker.child.kill();
      }
      await Promise.allSettled(workers.map(({ done }) => done));
      rmSync(base, { recursive: true, force: true });
    }
  });

  // @lat: [[tests#Scripts and tooling#Publication does not expose an ownerless lock]]
  it("does not expose an ownerless lock during publication", async () => {
    const base = mkdtempSync(path.join(tmpdir(), "acceptance-lock-publication-race-test-"));
    const first = spawnLockWorker(base, "first", "publish", 20);
    let second: ReturnType<typeof spawnLockWorker> | undefined;
    try {
      await waitForFile(first.readyPath);
      writeFileSync(first.startPath, "go\\n");
      await waitForFile(first.preparedPath);
      assert.throws(() => readFileSync(first.lockPath, "utf8"), /ENOENT/);
      second = spawnLockWorker(base, "second", "normal", 200);
      await waitForFile(second.readyPath);
      await waitForText(second.eventsPath, "start:second");
      writeFileSync(first.gatePath, "release\\n");
      await Promise.all([first.done, second.done]);
      assert.deepEqual(readFileSync(first.eventsPath, "utf8").trim().split("\n"), [
        "start:second",
        "end:second",
        "start:first",
        "end:first",
      ]);
    } finally {
      const workers = second === undefined ? [first] : [first, second];
      for (const worker of workers) {
        if (worker.child.exitCode === null) worker.child.kill();
      }
      await Promise.allSettled(workers.map(({ done }) => done));
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("times out instead of waiting forever for a live owner", async () => {
    const base = mkdtempSync(path.join(tmpdir(), "acceptance-lock-timeout-test-"));
    const lockPath = path.join(base, "lock");
    let resolveEntered!: () => void;
    let releaseOwner!: () => void;
    const entered = new Promise<void>((resolve) => {
      resolveEntered = resolve;
    });
    const owner = withAcceptanceLock(
      async () => {
        resolveEntered();
        await new Promise<void>((resolve) => {
          releaseOwner = resolve;
        });
      },
      { lockPath, pollIntervalMs: 1, waitTimeoutMs: 1_000 },
    );
    try {
      await entered;
      await assert.rejects(
        withAcceptanceLock(() => undefined, {
          lockPath,
          pollIntervalMs: 1,
          waitTimeoutMs: 10,
        }),
        /timed out waiting for acceptance lock/,
      );
    } finally {
      releaseOwner();
      await owner;
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("reclaims a lock only after the recorded process is absent", async () => {
    const base = mkdtempSync(path.join(tmpdir(), "acceptance-dead-owner-test-"));
    const lockPath = path.join(base, "lock");
    writeFileSync(lockPath, `${JSON.stringify({ pid: 99_999_999, token: "stale" })}\n`);
    try {
      const result = await withAcceptanceLock(() => "recovered", {
        lockPath,
        pollIntervalMs: 1,
        waitTimeoutMs: 1_000,
      });
      assert.equal(result, "recovered");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("does not reclaim a lock without an owner proof", async () => {
    const base = mkdtempSync(path.join(tmpdir(), "acceptance-ownerless-lock-test-"));
    const lockPath = path.join(base, "lock");
    const contents = "not-json\\n";
    writeFileSync(lockPath, contents);
    try {
      await assert.rejects(
        withAcceptanceLock(() => "unexpected", {
          lockPath,
          pollIntervalMs: 1,
          waitTimeoutMs: 20,
        }),
        /timed out waiting for acceptance lock/,
      );
      assert.equal(readFileSync(lockPath, "utf8"), contents);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  // @lat: [[tests#Scripts and tooling#Abandoned reclamation claims fail closed]]
  it("times out without deleting an abandoned reclamation claim", async () => {
    const base = mkdtempSync(path.join(tmpdir(), "acceptance-abandoned-claim-test-"));
    const lockPath = path.join(base, "lock");
    const claimPath = `${lockPath}.reclaim`;
    const lockContents = `${JSON.stringify({ pid: 99_999_999, token: "stale" })}\\n`;
    const claimContents = `${JSON.stringify({ pid: 99_999_999, token: "abandoned" })}\\n`;
    writeFileSync(lockPath, lockContents);
    writeFileSync(claimPath, claimContents);
    try {
      await assert.rejects(
        withAcceptanceLock(() => "unexpected", {
          lockPath,
          pollIntervalMs: 1,
          waitTimeoutMs: 20,
        }),
        /timed out waiting for acceptance lock/,
      );
      assert.equal(readFileSync(lockPath, "utf8"), lockContents);
      assert.equal(readFileSync(claimPath, "utf8"), claimContents);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("inventories proof files without an external search command", () => {
    const files = searchableRepoFiles();
    assert.ok(files.includes("tests/acceptance-ledger.test.ts"));
    assert.ok(files.includes("scripts/verify-acceptance-ledger.mjs"));
    assert.ok(!files.includes("scripts/pr51-acceptance.json"));
  });
});

describe("worktree identity digest", () => {
  it("is reproducible on an unchanged tree (FINDINGS.md DOC-001)", () => {
    const first = worktreeIdentity();
    const second = worktreeIdentity();
    assert.equal(first.diffDigest, second.diffDigest);
    assert.equal(first.testedIdentity, second.testedIdentity);
  });
});
