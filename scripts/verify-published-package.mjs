import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ASN1Obj } from "@sigstore/core";
import { verify as sigstoreVerify } from "sigstore";
import {
  collectPackageFileTargets,
  packageTargetPath,
  tarballIntegrity,
} from "./check-release-artifact.mjs";
import { argValue as readArgValue } from "./lib/argv.mjs";
import { readJson } from "./lib/json-artifact.mjs";
import { isMainModule, root } from "./lib/repo.mjs";

const TRANSIENT_CODES = new Set(["EAI_AGAIN", "ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"]);
const TRANSIENT_STATUSES = new Set([404, 429, 502, 503, 504]);
const STATEMENT_TYPE = "https://in-toto.io/Statement/v1";
const PREDICATE_TYPE = "https://slsa.dev/provenance/v1";
const BUILD_TYPE = "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1";
const FULCIO_ISSUER = "https://token.actions.githubusercontent.com";
const NPM_ERROR_STATUSES = new Map([
  ["E401", 401],
  ["E403", 403],
  ["E404", 404],
  ["E429", 429],
  ["E502", 502],
  ["E503", 503],
  ["E504", 504],
]);

/**
 * @typedef {object} ProvenanceExpectation
 * @property {string} name
 * @property {string} version
 * @property {string} integrity
 * @property {string} repository
 * @property {string} workflow
 * @property {string} environment
 * @property {string} ref
 * @property {string} commit
 * @property {string} oidcSubject
 */
/**
 * @typedef {object} RetryOptions
 * @property {number | string} [timeoutMs]
 * @property {number | string} [intervalMs]
 * @property {number | string} [initialDelayMs]
 * @property {number | string} [maxDelayMs]
 * @property {number} [maxAttempts]
 * @property {() => number} [now]
 * @property {(ms: number) => Promise<void>} [sleep]
 * @property {(error: unknown) => boolean} [shouldRetry]
 */

/**
 * @param {string} message
 * @param {string} [kind]
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
function fail(message, kind = "published-package", details = {}) {
  const error = /** @type {Error & { kind?: string }} */ (new Error(message));
  error.kind = kind;
  Object.assign(error, details);
  throw error;
}

/**
 * @param {string[]} argv
 * @param {string} name
 * @returns {string | undefined}
 */
function argValue(argv, name) {
  return readArgValue(argv, name, (message) => fail(message, "arguments"));
}

/**
 * @param {unknown} raw
 * @param {string} name
 * @returns {number}
 */
function positiveNumber(raw, name) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) fail(`${name} must be a positive number`, "arguments");
  return value;
}

/**
 * @param {unknown} raw
 * @param {string} name
 * @returns {number}
 */
function positiveInteger(raw, name) {
  const value = positiveNumber(raw, name);
  if (!Number.isSafeInteger(value)) fail(`${name} must be a whole number`, "arguments");
  return value;
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isTransientRegistryError(error) {
  if (!error || typeof error !== "object") return false;
  const record = /** @type {Record<string, unknown>} */ (error);
  if (record["retryable"] === true) return true;
  if (TRANSIENT_CODES.has(String(record["code"] ?? ""))) return true;
  return TRANSIENT_STATUSES.has(Number(record["status"]));
}

/**
 * Retry an explicitly retryable operation with a deadline and attempt cap.
 * @template T
 * @param {(attempt: number) => (T | Promise<T>)} operation
 * @param {RetryOptions} [options]
 * @returns {Promise<T>}
 */
export async function retryBounded(operation, options = {}) {
  const timeoutMs = positiveNumber(options.timeoutMs ?? 180000, "retry timeout");
  const maxAttempts = positiveInteger(options.maxAttempts ?? 8, "retry attempts");
  const initialDelayMs = positiveNumber(
    options.initialDelayMs ?? options.intervalMs ?? 1000,
    "retry delay",
  );
  const maxDelayMs = positiveNumber(options.maxDelayMs ?? 15000, "retry maximum delay");
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const shouldRetry = options.shouldRetry ?? isTransientRegistryError;
  const started = now();
  /** @type {unknown} */
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const failure = /** @type {Record<string, unknown>} */ (error);
      if (!shouldRetry(error) || attempt === maxAttempts)
        throw Object.assign(failure, { attempts: attempt });
      const remaining = timeoutMs - (now() - started);
      if (remaining <= 0) throw Object.assign(failure, { attempts: attempt });
      const exponential = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const retryAfter = Number(failure?.["retryAfterMs"]);
      const delay = Math.min(
        Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : exponential,
        remaining,
      );
      if (delay <= 0) throw Object.assign(failure, { attempts: attempt });
      await sleep(delay);
    }
  }
  // Unreachable: maxAttempts is a positive integer, so the loop either
  // returns or records an error.
  throw lastError ?? new Error("retry finished without an attempt");
}

/**
 * @param {unknown} value
 * @returns {any}
 */
function parseJsonOutput(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * @param {unknown} result
 * @param {string} context
 * @returns {unknown}
 */
export function parseNpmCommandResult(result, context) {
  const record =
    /** @type {{ error?: any, stdout?: any, stderr?: any, status?: unknown, signal?: unknown }} */ (
      result
    );
  if (record?.error) {
    throw Object.assign(new Error(`${context} failed to start`), { code: record.error.code });
  }
  const stdout =
    typeof record?.stdout === "string" ? record.stdout : (record?.stdout?.toString("utf8") ?? "");
  const stderr =
    typeof record?.stderr === "string" ? record.stderr : (record?.stderr?.toString("utf8") ?? "");
  const parsed = parseJsonOutput(stdout) ?? parseJsonOutput(stderr);
  if (record?.status === 0) {
    if (parsed === undefined) fail(`${context} returned malformed JSON`, "registry-schema");
    return parsed;
  }
  const code = parsed?.error?.code;
  const error = new Error(`${context} failed${code ? ` with ${code}` : ""}`);
  throw Object.assign(error, {
    code,
    status: NPM_ERROR_STATUSES.get(code),
    signal: record?.signal,
  });
}

// Per-operation bound: the retry deadline only stops scheduling new
// attempts, so every child process and fetch needs its own timeout or a
// single hang blocks the release job indefinitely (FINDINGS.md REL-002).
/** @type {number} */
export const OPERATION_TIMEOUT_MS = 120000;

/**
 * @param {string[]} args
 * @param {any} [options]
 * @returns {any}
 */
function runNpmJson(args, options = {}) {
  return parseNpmCommandResult(
    spawnSync("npm", args, {
      timeout: OPERATION_TIMEOUT_MS,
      killSignal: "SIGKILL",
      ...options,
      encoding: "utf8",
    }),
    `npm ${args[0]}`,
  );
}

/**
 * @param {string} name
 * @param {string} version
 * @returns {any}
 */
function npmView(name, version) {
  const spec = `${name}@${version}`;
  const parsed = runNpmJson(["view", spec, "--json"], { cwd: root });
  const view = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!view || typeof view !== "object")
    fail(`npm view returned no metadata for ${spec}`, "registry-schema");
  return view;
}

/**
 * @template {object} T
 * @param {string} name
 * @param {string} version
 * @param {number | string} timeoutMs
 * @param {number | string} intervalMs
 * @param {(view: T) => boolean} [accept]
 * @param {RetryOptions & { view?: (name: string, version: string) => T }} [options]
 * @returns {Promise<T>}
 */
export async function waitForView(
  name,
  version,
  timeoutMs,
  intervalMs,
  accept = () => true,
  options = {},
) {
  return retryBounded(
    async () => {
      const view = (options.view ?? npmView)(name, version);
      if (!accept(view))
        fail(`registry metadata for ${name}@${version} is not complete yet`, "registry-lag", {
          retryable: true,
        });
      return view;
    },
    {
      timeoutMs,
      initialDelayMs: intervalMs,
      maxDelayMs: options.maxDelayMs ?? intervalMs,
      maxAttempts: options.maxAttempts ?? 60,
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
      shouldRetry: isTransientRegistryError,
    },
  );
}

/**
 * @param {unknown} view
 * @param {string} expectedIntegrity
 * @returns {boolean}
 */
export function registryIntegrityMatches(view, expectedIntegrity) {
  const record = /** @type {{ dist?: { integrity?: unknown } }} */ (view);
  return typeof expectedIntegrity === "string" && record?.dist?.integrity === expectedIntegrity;
}

/**
 * @param {string} name
 * @param {string} version
 * @returns {string[]}
 */
export function verificationInstallArgs(name, version) {
  return ["install", "--json", "--ignore-scripts", "--no-audit", "--no-fund", `${name}@${version}`];
}

/**
 * @param {string} consumer
 * @param {string} name
 */
function packageMetadataFromConsumer(consumer, name) {
  const consumerRequire = createRequire(join(consumer, "package.json"));
  let packageJsonPath;
  try {
    packageJsonPath = consumerRequire.resolve(`${name}/package.json`);
  } catch (error) {
    fail(
      `registry package does not export ${name}/package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return {
    pkg: readJson(packageJsonPath),
    packageJsonPath,
    consumerRequire,
  };
}

/**
 * @param {string} consumer
 * @param {string} name
 * @param {string} expectedVersion
 * @returns {{ pkg: Record<string, unknown>, packageRoot: string }}
 */
export function inspectInstalledPackageExports(consumer, name, expectedVersion) {
  const { pkg, packageJsonPath, consumerRequire } = packageMetadataFromConsumer(consumer, name);
  if (pkg.version !== expectedVersion)
    fail(`installed version ${pkg.version} does not match ${expectedVersion}`);
  const packageRoot = dirname(packageJsonPath);
  const errors = [];
  for (const { path, target } of collectPackageFileTargets(pkg)) {
    const tarPath = packageTargetPath(target);
    if (!tarPath) errors.push(`${path} has an unsafe or non-relative target ${String(target)}`);
    else if (!existsSync(join(packageRoot, tarPath.slice("package/".length))))
      errors.push(`${path} target ${target} is missing`);
  }
  for (const subpath of Object.keys(pkg.exports ?? {})) {
    if (subpath.includes("*")) {
      errors.push(`wildcard export ${subpath} cannot be verified without a concrete declaration`);
      continue;
    }
    const specifier = subpath === "." ? name : `${name}/${subpath.slice(2)}`;
    try {
      consumerRequire.resolve(specifier);
    } catch (error) {
      errors.push(
        `${specifier} export does not resolve: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (errors.length > 0) fail(`installed package export inspection failed:\n${errors.join("\n")}`);
  return { pkg, packageRoot };
}

/**
 * @param {string} consumer
 * @param {string} name
 * @param {string} version
 * @returns {Promise<{ pkg: Record<string, unknown>, result: { metaName: string, version: string } }>}
 */
export async function importInstalledPackage(consumer, name, version) {
  const { pkg } = inspectInstalledPackageExports(consumer, name, version);
  const importScript = `
import { createRequire } from "node:module";
const name = process.env.RELEASE_PACKAGE_NAME;
const version = process.env.RELEASE_PACKAGE_VERSION;
const plugin = await import(name);
const oxfmt = await import(name + "/oxfmt");
const require = createRequire(import.meta.url);
const recommended = require(name + "/oxfmt.recommended.json");
const exportedPackage = require(name + "/package.json");
if (plugin.default?.meta?.version !== version) throw new Error("plugin meta.version mismatch");
if (exportedPackage.version !== version) throw new Error("package.json version mismatch");
if (plugin.default?.meta?.name !== "servicenow") throw new Error("plugin meta.name mismatch");
if (!oxfmt || !recommended) throw new Error("public export did not load");
console.log(JSON.stringify({ metaName: plugin.default.meta.name, version: plugin.default.meta.version }));`;
  let output;
  try {
    output = execFileSync(process.execPath, ["--input-type=module", "-e", importScript], {
      cwd: consumer,
      timeout: OPERATION_TIMEOUT_MS,
      killSignal: "SIGKILL",
      encoding: "utf8",
      env: { ...process.env, RELEASE_PACKAGE_NAME: name, RELEASE_PACKAGE_VERSION: version },
    });
  } catch (error) {
    fail(
      `registry public export import failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let result;
  try {
    result = JSON.parse(output);
  } catch {
    fail(`registry public export import did not emit JSON: ${output.slice(0, 400)}`);
  }
  if (result.metaName !== "servicenow" || result.version !== version)
    fail("registry public export result was invalid");
  return { pkg, result };
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The trusted-publisher subject is ID-enriched
 * (`repo:<owner>@<id>/<name>@<id>:environment:<env>`), and Fulcio embeds the
 * same string in OID 1.3.6.1.4.1.57264.1.24, so the equality check alone
 * would accept a subject naming another repository whenever the certificate
 * agreed with it. Bind the declared subject to the repository and
 * environment the rest of the certificate policy verifies
 * (FINDINGS.md MNT-004).
 *
 * @param {{ oidcSubject: string, repository: string, environment: string }} expected
 * @returns {void}
 */
function assertSubjectMatchesIdentity(expected) {
  const match = /^repo:([^@/]+)@\d+\/([^@:]+)@\d+:environment:(.+)$/.exec(expected.oidcSubject);
  const slug = expected.repository.replace(/^https:\/\/github\.com\//, "");
  if (!match || `${match[1]}/${match[2]}` !== slug || match[3] !== expected.environment) {
    fail(
      `trusted-publisher subject ${expected.oidcSubject} does not name the verified identity ${slug} environment ${expected.environment}`,
      "provenance-expectation",
    );
  }
}

/**
 * @param {{ repository: string, workflow: string, ref: string, commit: string, environment: string, oidcSubject: string }} expected
 */
function certificateIdentity(expected) {
  assertSubjectMatchesIdentity(expected);
  const workflowIdentity = `${expected.repository}/${expected.workflow}@${expected.ref}`;
  return {
    workflowIdentity,
    options: {
      certificateIssuer: FULCIO_ISSUER,
      certificateIdentityURI: `^${escapeRegex(workflowIdentity)}$`,
    },
    oids: {
      "1.3.6.1.4.1.57264.1.9": workflowIdentity,
      "1.3.6.1.4.1.57264.1.11": "github-hosted",
      "1.3.6.1.4.1.57264.1.12": expected.repository,
      "1.3.6.1.4.1.57264.1.13": expected.commit,
      "1.3.6.1.4.1.57264.1.14": expected.ref,
      "1.3.6.1.4.1.57264.1.18": workflowIdentity,
      "1.3.6.1.4.1.57264.1.20": "push",
      "1.3.6.1.4.1.57264.1.23": expected.environment,
      "1.3.6.1.4.1.57264.1.24": expected.oidcSubject,
    },
  };
}

/**
 * @param {any} signer
 * @param {Record<string, string>} expectedOIDs
 * @returns {void}
 */
function verifyCertificateOIDs(signer, expectedOIDs) {
  const signerOIDs = Array.isArray(signer?.identity?.oids) ? signer.identity.oids : [];
  for (const [oid, expected] of Object.entries(expectedOIDs)) {
    const matches = signerOIDs.filter(
      /** @param {any} item */ (item) => item?.oid?.id?.join(".") === oid,
    );
    if (matches.length !== 1)
      fail(`Sigstore certificate must contain exactly one OID ${oid}`, "provenance-identity");
    try {
      const raw = Buffer.from(matches[0].value);
      const parsed = ASN1Obj.parseBuffer(raw);
      if (
        parsed.tag.class !== 0 ||
        parsed.tag.number !== 0x0c ||
        parsed.tag.constructed ||
        parsed.subs.length !== 0 ||
        !Buffer.from(parsed.toDER()).equals(raw) ||
        !Buffer.from(parsed.value.toString("utf8"), "utf8").equals(parsed.value)
      ) {
        throw new Error("not one canonical DER UTF8String");
      }
      const actual = parsed.value.toString("utf8");
      if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`);
    } catch (error) {
      fail(
        `Sigstore certificate OID ${oid} mismatch: ${error instanceof Error ? error.message : String(error)}`,
        "provenance-identity",
      );
    }
  }
}

/**
 * @param {any} bundle
 * @returns {any}
 */
function decodeStatement(bundle) {
  const payload = bundle?.dsseEnvelope?.payload;
  if (
    typeof payload !== "string" ||
    bundle.dsseEnvelope.payloadType !== "application/vnd.in-toto+json"
  ) {
    fail("provenance bundle has no in-toto DSSE payload", "provenance-schema");
  }
  try {
    const statement = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (!statement || typeof statement !== "object" || Array.isArray(statement)) throw new Error();
    return statement;
  } catch {
    fail("provenance DSSE payload is malformed", "provenance-schema");
  }
}

/**
 * @param {string} integrity
 * @returns {string}
 */
function sha512Hex(integrity) {
  const match = /^sha512-([A-Za-z0-9+/=]+)$/.exec(integrity);
  if (!match) fail(`invalid inspected tarball integrity ${integrity}`, "provenance-expectation");
  return Buffer.from(/** @type {string} */ (match[1]), "base64").toString("hex");
}

/**
 * @param {any} statement
 * @param {{ name: string, version: string, integrity: string, repository: string, workflow: string, ref: string, commit: string }} expected
 * @returns {void}
 */
function exactWorkflowStatement(statement, expected) {
  if (statement._type !== STATEMENT_TYPE)
    fail(`unexpected statement type ${statement._type}`, "provenance-identity");
  if (statement.predicateType !== PREDICATE_TYPE)
    fail(`unexpected predicate type ${statement.predicateType}`, "provenance-identity");
  if (!Array.isArray(statement.subject) || statement.subject.length !== 1)
    fail("provenance must contain exactly one subject", "provenance-identity");
  const subject = statement.subject[0];
  if (subject?.name !== `pkg:npm/${expected.name}@${expected.version}`)
    fail("provenance subject name mismatch", "provenance-identity");
  if (subject?.digest?.sha512 !== sha512Hex(expected.integrity))
    fail("provenance subject digest mismatch", "provenance-identity");
  const definition = statement.predicate?.buildDefinition;
  if (definition?.buildType !== BUILD_TYPE)
    fail("provenance build type mismatch", "provenance-identity");
  const workflow = definition?.externalParameters?.workflow;
  if (
    workflow?.repository !== expected.repository ||
    workflow?.path !== expected.workflow ||
    workflow?.ref !== expected.ref
  ) {
    fail("provenance workflow identity mismatch", "provenance-identity");
  }
  const dependency = (definition?.resolvedDependencies ?? []).find(
    /** @param {any} item */ (item) => item?.digest?.gitCommit === expected.commit,
  );
  if (!dependency || dependency.uri !== `git+${expected.repository}@${expected.ref}`)
    fail("provenance resolved commit mismatch", "provenance-identity");
}

/**
 * @param {unknown} attestationResponse
 * @param {ProvenanceExpectation} expected
 * @param {(bundle: any, options: any) => Promise<any>} [verifyBundle]
 * @returns {Promise<Record<string, string>>}
 */
export async function verifyProvenanceAttestation(
  attestationResponse,
  expected,
  verifyBundle = sigstoreVerify,
) {
  const response = /** @type {{ attestations?: Array<any> }} */ (attestationResponse);
  const candidates = Array.isArray(response?.attestations)
    ? response.attestations.filter((item) => item?.predicateType === PREDICATE_TYPE)
    : [];
  if (candidates.length !== 1)
    fail(`expected one provenance attestation, found ${candidates.length}`, "provenance-schema");
  const bundle = candidates[0].bundle;
  const { workflowIdentity, options, oids } = certificateIdentity(expected);
  let signer;
  try {
    signer = await verifyBundle(bundle, options);
  } catch (error) {
    fail(
      `Sigstore verification failed: ${error instanceof Error ? error.message : String(error)}`,
      "provenance-signature",
    );
  }
  verifyCertificateOIDs(signer, oids);
  const statement = decodeStatement(bundle);
  exactWorkflowStatement(statement, expected);
  return {
    predicateType: PREDICATE_TYPE,
    subject: statement.subject[0].name,
    subjectSha512: statement.subject[0].digest.sha512,
    repository: expected.repository,
    workflow: expected.workflow,
    environment: expected.environment,
    ref: expected.ref,
    commit: expected.commit,
    certificateIdentity: signer?.identity?.subjectAlternativeName ?? workflowIdentity,
    certificateIssuer: FULCIO_ISSUER,
    bundleSha256: createHash("sha256").update(JSON.stringify(bundle)).digest("hex"),
  };
}

/**
 * @param {string} name
 * @param {string} version
 * @returns {string}
 */
function expectedAttestationPath(name, version) {
  return `/-/npm/v1/attestations/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

/**
 * @param {unknown} view
 * @param {string} name
 * @param {string} version
 * @returns {string}
 */
export function canonicalAttestationUrl(view, name, version) {
  const record = /** @type {{ dist?: { attestations?: unknown } }} */ (view);
  const raw = record?.dist?.attestations;
  const records = /** @type {Array<any>} */ (
    Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : []
  );
  const candidates = records.filter(
    (item) => item?.provenance?.predicateType === PREDICATE_TYPE && typeof item.url === "string",
  );
  if (candidates.length !== 1)
    fail("registry metadata must expose one canonical provenance endpoint", "registry-schema");
  let url;
  try {
    url = new URL(candidates[0].url);
  } catch {
    fail("registry provenance endpoint is not a URL", "registry-schema");
  }
  if (
    url.origin !== "https://registry.npmjs.org" ||
    url.pathname !== expectedAttestationPath(name, version) ||
    url.search ||
    url.hash
  ) {
    fail(`registry provenance endpoint is not canonical for ${name}@${version}`, "registry-schema");
  }
  return url.href;
}

/**
 * @param {unknown} value
 * @param {() => number} [now]
 * @returns {number | undefined}
 */
export function parseRetryAfterMs(value, now = Date.now) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return undefined;
  return Math.max(0, at - now());
}

/**
 * @param {unknown} view
 * @param {string} name
 * @param {string} version
 * @param {typeof fetch} [fetchFn]
 * @param {() => number} [now]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchAttestations(view, name, version, fetchFn = fetch, now = Date.now) {
  const url = canonicalAttestationUrl(view, name, version);
  let response;
  try {
    response = await fetchFn(url, {
      redirect: "manual",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(OPERATION_TIMEOUT_MS),
    });
  } catch (error) {
    const failure = /** @type {{ cause?: { code?: unknown }, code?: unknown }} */ (error);
    throw Object.assign(new Error("attestation fetch failed"), {
      code: failure?.cause?.code ?? failure?.code,
    });
  }
  if (response.status >= 300 && response.status < 400)
    fail("attestation endpoint redirected", "registry-schema");
  if (!response.ok) {
    throw Object.assign(new Error(`attestation endpoint returned HTTP ${response.status}`), {
      status: response.status,
      retryAfterMs: parseRetryAfterMs(response.headers?.get?.("retry-after"), now),
    });
  }
  if (response.url && response.url !== url)
    fail("attestation response URL changed", "registry-schema");
  try {
    const result = await response.json();
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
    return /** @type {Record<string, unknown>} */ (result);
  } catch {
    fail("attestation endpoint returned malformed JSON", "registry-schema");
  }
}

/**
 * @param {any} view
 * @returns {boolean}
 */
function hasCompleteRegistryMetadata(view) {
  return (
    typeof view?.version === "string" &&
    typeof view?.dist?.tarball === "string" &&
    typeof view?.dist?.integrity === "string"
  );
}

/**
 * @param {string} name
 * @param {string} version
 * @param {RetryOptions & Record<string, unknown>} [options]
 * @returns {Promise<{ attempts: number }>}
 */
export async function verifyInstallWithRetry(name, version, options = {}) {
  return retryBounded(async (attempt) => {
    const consumer = mkdtempSync(join(tmpdir(), `sn-oxc-published-${attempt}-`));
    try {
      writeFileSync(
        join(consumer, "package.json"),
        JSON.stringify({ name: "sn-oxc-published-verify", private: true, type: "module" }),
      );
      const install = /** @type {(bin: string, args: string[], options: unknown) => unknown} */ (
        options["install"]
      );
      if (install)
        install("npm", verificationInstallArgs(name, version), {
          cwd: consumer,
          encoding: "utf8",
        });
      else runNpmJson(verificationInstallArgs(name, version), { cwd: consumer });
      const importPackage =
        /** @type {(consumer: string, name: string, version: string) => unknown} */ (
          options["importPackage"]
        ) ?? importInstalledPackage;
      await importPackage(consumer, name, version);
      return { attempts: attempt };
    } catch (error) {
      if (isTransientRegistryError(error)) throw error;
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
        attempts: attempt,
      });
    } finally {
      rmSync(consumer, { recursive: true, force: true });
    }
  }, options);
}

/**
 * @param {string[]} [argv]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function main(argv = process.argv) {
  const localPkg = readJson(join(root, "package.json"));
  const name = argValue(argv, "--name") ?? localPkg.name;
  const version = argValue(argv, "--version") ?? localPkg.version;
  const timeoutMs = argValue(argv, "--timeout-ms") ?? "180000";
  const intervalMs = argValue(argv, "--interval-ms") ?? "3000";
  const tarballFlag = argValue(argv, "--tarball");
  if (!tarballFlag) fail("--tarball is required for exact registry verification", "arguments");
  const tarball = resolve(tarballFlag);
  const integrity = tarballIntegrity(readFileSync(tarball));
  const repository =
    argValue(argv, "--repository") ?? "https://github.com/martinthommesen/oxc-plugin-servicenow";
  const workflow = argValue(argv, "--workflow") ?? ".github/workflows/release.yml";
  const environment = argValue(argv, "--environment") ?? "release";
  const ref = argValue(argv, "--ref") ?? process.env["GITHUB_REF"];
  const commit = argValue(argv, "--commit") ?? process.env["GITHUB_SHA"];
  const oidcSubject = argValue(argv, "--oidc-subject");
  if (!ref || !ref.startsWith("refs/tags/v"))
    fail("--ref or GITHUB_REF must be an exact release tag ref", "arguments");
  if (!commit || !/^[a-f0-9]{40}$/i.test(commit))
    fail("--commit or GITHUB_SHA must be a full commit", "arguments");
  if (!oidcSubject)
    fail("--oidc-subject is required for environment-bound provenance", "arguments");
  const expected = {
    name,
    version,
    integrity,
    repository,
    workflow,
    environment,
    ref,
    commit: commit.toLowerCase(),
    oidcSubject,
  };

  const view = await waitForView(name, version, timeoutMs, intervalMs, hasCompleteRegistryMetadata);
  if (view.version !== version) fail(`npm view version is ${view.version}`, "registry-identity");
  if (!registryIntegrityMatches(view, integrity))
    fail(
      `registry integrity ${view.dist?.integrity} does not match inspected tarball ${integrity}`,
      "integrity",
    );
  const attestations = await retryBounded(() => fetchAttestations(view, name, version), {
    timeoutMs,
    initialDelayMs: intervalMs,
    maxAttempts: 12,
    shouldRetry: isTransientRegistryError,
  });
  const provenance = await verifyProvenanceAttestation(attestations, expected);
  const install = argv.includes("--skip-install")
    ? { attempts: 0 }
    : await verifyInstallWithRetry(name, version, {
        timeoutMs,
        initialDelayMs: intervalMs,
        maxAttempts: 8,
      });
  const result = {
    ok: true,
    name,
    version,
    tarball: view.dist.tarball,
    integrity,
    provenance,
    installed: !argv.includes("--skip-install"),
    installAttempts: install.attempts,
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
