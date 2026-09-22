import { createHash, randomUUID } from "node:crypto";
import { link, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_WAIT_TIMEOUT_MS = 15 * 60_000;
const RECLAIM_SUFFIX = ".reclaim";

/**
 * @typedef {object} LockFingerprint
 * @property {number} ctimeMs
 * @property {number} dev
 * @property {number} ino
 * @property {number} mode
 * @property {number} mtimeMs
 * @property {number} size
 */
/**
 * @typedef {object} LockOwner
 * @property {number} pid
 * @property {string} token
 */
/**
 * @typedef {object} LockSnapshot
 * @property {LockFingerprint} fingerprint
 * @property {LockOwner | null} owner
 * @property {string | null} ownerToken
 */
/**
 * @typedef {object} ReclaimClaim
 * @property {string} path
 * @property {string} token
 */

/**
 * @param {unknown} value
 * @param {string} name
 * @param {number} minimum
 * @returns {number}
 */
function optionNumber(value, name, minimum) {
  if (!Number.isSafeInteger(value) || /** @type {number} */ (value) < minimum) {
    throw new RangeError(`${name} must be a safe integer of at least ${minimum}`);
  }
  return /** @type {number} */ (value);
}

/**
 * @param {unknown} error
 * @returns {unknown}
 */
function errorCode(error) {
  return error && typeof error === "object" && "code" in error ? error.code : undefined;
}

/**
 * @param {unknown} pid
 * @returns {boolean}
 */
function recordedProcessIsDead(pid) {
  if (!Number.isSafeInteger(pid)) return false;
  const target = /** @type {number} */ (pid);
  if (target < 1) return false;
  try {
    process.kill(target, 0);
    return false;
  } catch (error) {
    return errorCode(error) === "ESRCH";
  }
}

/**
 * @param {string} lockPath
 * @returns {string}
 */
function reclaimPath(lockPath) {
  return `${lockPath}${RECLAIM_SUFFIX}`;
}

/**
 * @param {import("node:fs").Stats} details
 * @returns {LockFingerprint}
 */
function fingerprint(details) {
  return {
    ctimeMs: details.ctimeMs,
    dev: details.dev,
    ino: details.ino,
    mode: details.mode,
    mtimeMs: details.mtimeMs,
    size: details.size,
  };
}

/**
 * @param {LockFingerprint} left
 * @param {LockFingerprint} right
 * @returns {boolean}
 */
function sameFingerprint(left, right) {
  return (
    left.ctimeMs === right.ctimeMs &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.mtimeMs === right.mtimeMs &&
    left.size === right.size
  );
}

/**
 * @param {LockSnapshot} left
 * @param {LockSnapshot | null} right
 * @returns {boolean}
 */
function sameSnapshot(left, right) {
  return (
    right !== null &&
    left.ownerToken === right.ownerToken &&
    sameFingerprint(left.fingerprint, right.fingerprint)
  );
}

/**
 * @param {string} value
 * @returns {LockOwner | null}
 */
function parseOwner(value) {
  try {
    const parsed = JSON.parse(value);
    if (
      !parsed ||
      !Number.isSafeInteger(parsed.pid) ||
      parsed.pid < 1 ||
      typeof parsed.token !== "string" ||
      parsed.token.length === 0
    ) {
      return null;
    }
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

/**
 * @param {string} lockPath
 * @returns {Promise<LockSnapshot | null>}
 */
async function readLockSnapshot(lockPath) {
  let before;
  try {
    before = await stat(lockPath);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }

  let owner = null;
  try {
    owner = parseOwner(await readFile(lockPath, "utf8"));
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") return null;
    if (code !== "EISDIR") throw error;
  }

  let after;
  try {
    after = await stat(lockPath);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
  if (!sameFingerprint(fingerprint(before), fingerprint(after))) return null;

  return {
    fingerprint: fingerprint(after),
    owner,
    ownerToken: owner?.token ?? null,
  };
}

/**
 * @param {LockSnapshot} snapshot
 * @returns {boolean}
 */
function isStaleLock(snapshot) {
  return snapshot.owner !== null && recordedProcessIsDead(snapshot.owner.pid);
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw error;
  }
}

/**
 * @param {string} path
 * @param {string} contents
 * @param {(() => (void | Promise<void>)) | undefined} [beforePublish]
 * @returns {Promise<boolean>}
 */
async function publishFile(path, contents, beforePublish) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
  try {
    await beforePublish?.();
    try {
      await link(temporaryPath, path);
      return true;
    } catch (error) {
      if (errorCode(error) === "EEXIST") return false;
      throw error;
    }
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

/**
 * @param {string} lockPath
 * @param {LockSnapshot} snapshot
 * @returns {Promise<ReclaimClaim | null>}
 */
async function claimReclamation(lockPath, snapshot) {
  const token = randomUUID();
  const claim = {
    expectedOwnerToken: snapshot.ownerToken,
    expectedFingerprint: snapshot.fingerprint,
    pid: process.pid,
    token,
  };
  const claimed = await publishFile(reclaimPath(lockPath), `${JSON.stringify(claim)}\n`);
  return claimed ? { path: reclaimPath(lockPath), token } : null;
}

/**
 * @param {ReclaimClaim} claim
 * @returns {Promise<void>}
 */
async function releaseReclamationClaim(claim) {
  let owner;
  try {
    owner = parseOwner(await readFile(claim.path, "utf8"));
  } catch (error) {
    if (errorCode(error) === "ENOENT" || errorCode(error) === "EISDIR") return;
    throw error;
  }
  if (owner?.pid !== process.pid || owner.token !== claim.token) return;
  await rm(claim.path, { force: true });
}

/**
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
async function delay(milliseconds) {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

/**
 * @param {string} lockPath
 * @param {{ hooks: AcceptanceLockHooks | undefined, pollIntervalMs: number, waitTimeoutMs: number }} options
 * @returns {Promise<string>}
 */
async function acquire(lockPath, options) {
  const startedAt = Date.now();
  const token = randomUUID();
  const owner = `${JSON.stringify({
    pid: process.pid,
    token,
    createdAt: new Date().toISOString(),
  })}\n`;

  while (true) {
    if (
      !(await pathExists(reclaimPath(lockPath))) &&
      (await publishFile(lockPath, owner, options.hooks?.beforeLockPublish))
    ) {
      return token;
    }

    const observed = await readLockSnapshot(lockPath);
    if (observed && isStaleLock(observed)) {
      const claim = await claimReclamation(lockPath, observed);
      if (claim) {
        try {
          const current = await readLockSnapshot(lockPath);
          if (current && sameSnapshot(observed, current) && isStaleLock(current)) {
            await options.hooks?.beforeReclaim?.();
            const confirmed = await readLockSnapshot(lockPath);
            if (confirmed && sameSnapshot(observed, confirmed) && isStaleLock(confirmed)) {
              await rm(lockPath, { force: true, recursive: true });
              if (await publishFile(lockPath, owner)) return token;
            }
          }
        } finally {
          await releaseReclamationClaim(claim);
        }
      }
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed >= options.waitTimeoutMs) {
      throw new Error(`timed out waiting for acceptance lock: ${lockPath}`);
    }
    await delay(Math.min(options.pollIntervalMs, options.waitTimeoutMs - elapsed));
  }
}

/**
 * @param {string} lockPath
 * @param {string} token
 * @returns {Promise<void>}
 */
async function release(lockPath, token) {
  let snapshot;
  try {
    snapshot = await readLockSnapshot(lockPath);
  } catch (error) {
    // Cleanup never throws: a lock that is already gone, or replaced by a
    // directory, is nothing to release. Anything else is reported so it is
    // not lost behind the work this run already finished.
    const code = errorCode(error);
    if (code !== "ENOENT" && code !== "EISDIR") console.error(error);
    return;
  }
  if (snapshot?.owner?.token !== token) return;
  await rm(lockPath, { force: true, recursive: true });
}

/**
 * @typedef {object} AcceptanceLockHooks
 * @property {() => (void | Promise<void>)} [beforeLockPublish]
 * @property {() => (void | Promise<void>)} [beforeReclaim]
 */
/**
 * @typedef {object} AcceptanceLockOptions
 * @property {AcceptanceLockHooks} [hooks]
 * @property {string} [lockPath]
 * @property {number} [pollIntervalMs]
 * @property {number} [waitTimeoutMs]
 */

/**
 * Return the lock path for acceptance runs against one repository root.
 * @param {string} [root]
 * @returns {string}
 */
export function acceptanceLockPath(root = process.cwd()) {
  const absoluteRoot = isAbsolute(root) ? root : resolve(root);
  const identity = createHash("sha256").update(absoluteRoot).digest("hex").slice(0, 16);
  return join(tmpdir(), `oxc-plugin-servicenow-acceptance-${identity}.lock`);
}

/**
 * Run one acceptance operation while protecting its shared build artifacts.
 * @template T
 * @param {() => (T | Promise<T>)} operation
 * @param {AcceptanceLockOptions} [options]
 * @returns {Promise<T>}
 */
export async function withAcceptanceLock(operation, options = {}) {
  if (typeof operation !== "function")
    throw new TypeError("acceptance lock operation must be a function");
  const lockPath = options.lockPath ?? acceptanceLockPath();
  const lockOptions = {
    hooks: options.hooks,
    pollIntervalMs: optionNumber(
      options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      "pollIntervalMs",
      1,
    ),
    waitTimeoutMs: optionNumber(
      options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS,
      "waitTimeoutMs",
      1,
    ),
  };
  const token = await acquire(lockPath, lockOptions);
  try {
    return await operation();
  } finally {
    await release(lockPath, token);
  }
}
