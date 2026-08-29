import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verify as sigstoreVerify } from "sigstore";
import {
  collectPackageFileTargets,
  packageTargetPath,
  tarballIntegrity,
} from "./check-release-artifact.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
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
]);

function fail(message, kind = "published-package", details = {}) {
  const error = new Error(message);
  error.kind = kind;
  Object.assign(error, details);
  throw error;
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) fail(`${name} requires a value`, "arguments");
  return value;
}

function positiveNumber(raw, name) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) fail(`${name} must be a positive number`, "arguments");
  return value;
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientRegistryError(error) {
  if (!error || typeof error !== "object") return false;
  if (error.retryable === true) return true;
  if (TRANSIENT_CODES.has(String(error.code ?? ""))) return true;
  return TRANSIENT_STATUSES.has(Number(error.status));
}

/** Retry an explicitly retryable operation with a deadline and attempt cap. */
export async function retryBounded(operation, options = {}) {
  const timeoutMs = positiveNumber(options.timeoutMs ?? 180000, "retry timeout");
  const maxAttempts = positiveNumber(options.maxAttempts ?? 8, "retry attempts");
  const initialDelayMs = positiveNumber(
    options.initialDelayMs ?? options.intervalMs ?? 1000,
    "retry delay",
  );
  const maxDelayMs = positiveNumber(options.maxDelayMs ?? 15000, "retry maximum delay");
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const shouldRetry = options.shouldRetry ?? isTransientRegistryError;
  const started = now();
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === maxAttempts)
        throw Object.assign(error, { attempts: attempt });
      const remaining = timeoutMs - (now() - started);
      if (remaining <= 0) throw Object.assign(error, { attempts: attempt });
      const exponential = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const retryAfter = Number(error?.retryAfterMs);
      const delay = Math.min(
        Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : exponential,
        remaining,
      );
      if (delay <= 0) throw Object.assign(error, { attempts: attempt });
      await sleep(delay);
    }
  }
  throw lastError;
}

function parseJsonOutput(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function parseNpmCommandResult(result, context) {
  if (result?.error) {
    throw Object.assign(new Error(`${context} failed to start`), { code: result.error.code });
  }
  const stdout =
    typeof result?.stdout === "string" ? result.stdout : (result?.stdout?.toString("utf8") ?? "");
  const stderr =
    typeof result?.stderr === "string" ? result.stderr : (result?.stderr?.toString("utf8") ?? "");
  const parsed = parseJsonOutput(stdout) ?? parseJsonOutput(stderr);
  if (result?.status === 0) {
    if (parsed === undefined) fail(`${context} returned malformed JSON`, "registry-schema");
    return parsed;
  }
  const code = parsed?.error?.code;
  const error = new Error(`${context} failed${code ? ` with ${code}` : ""}`);
  throw Object.assign(error, {
    code,
    status: NPM_ERROR_STATUSES.get(code),
    signal: result?.signal,
  });
}

// Per-operation bound: the retry deadline only stops scheduling new
// attempts, so every child process and fetch needs its own timeout or a
// single hang blocks the release job indefinitely (FINDINGS.md REL-002).
export const OPERATION_TIMEOUT_MS = 120000;

function runNpmJson(args, options = {}, runner = spawnSync) {
  return parseNpmCommandResult(
    runner("npm", args, {
      timeout: OPERATION_TIMEOUT_MS,
      killSignal: "SIGKILL",
      ...options,
      encoding: "utf8",
    }),
    `npm ${args[0]}`,
  );
}

function npmView(name, version, runner = spawnSync) {
  const spec = `${name}@${version}`;
  const parsed = runNpmJson(["view", spec, "--json"], { cwd: root }, runner);
  const view = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!view || typeof view !== "object")
    fail(`npm view returned no metadata for ${spec}`, "registry-schema");
  return view;
}

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
      now: options.now,
      sleep: options.sleep,
      shouldRetry: isTransientRegistryError,
    },
  );
}

export function registryIntegrityMatches(view, expectedIntegrity) {
  return typeof expectedIntegrity === "string" && view?.dist?.integrity === expectedIntegrity;
}

export function verificationInstallArgs(name, version) {
  return ["install", "--json", "--ignore-scripts", "--no-audit", "--no-fund", `${name}@${version}`];
}

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
    pkg: JSON.parse(readFileSync(packageJsonPath, "utf8")),
    packageJsonPath,
    consumerRequire,
  };
}

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
if (exportedPackage.version !== version) throw new Error("package.json version mismatch");
if (plugin.default?.meta?.name !== "servicenow") throw new Error("plugin meta.name mismatch");
if (plugin.default?.meta?.version !== version) throw new Error("plugin meta.version mismatch");
if (!oxfmt || !recommended) throw new Error("public export did not load");
console.log(
  JSON.stringify({ metaName: plugin.default.meta.name, version: plugin.default.meta.version }),
);`;
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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function certificateIdentity(expected) {
  const workflowIdentity = `${expected.repository}/${expected.workflow}@${expected.ref}`;
  return {
    workflowIdentity,
    options: {
      certificateIssuer: FULCIO_ISSUER,
      certificateIdentityURI: `^${escapeRegex(workflowIdentity)}$`,
      certificateOIDs: {
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
    },
  };
}

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

function sha512Hex(integrity) {
  const match = /^sha512-([A-Za-z0-9+/=]+)$/.exec(integrity);
  if (!match) fail(`invalid inspected tarball integrity ${integrity}`, "provenance-expectation");
  return Buffer.from(match[1], "base64").toString("hex");
}

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
    (item) => item?.digest?.gitCommit === expected.commit,
  );
  if (!dependency || dependency.uri !== `git+${expected.repository}@${expected.ref}`)
    fail("provenance resolved commit mismatch", "provenance-identity");
}

export async function verifyProvenanceAttestation(
  attestationResponse,
  expected,
  verifyBundle = sigstoreVerify,
) {
  const candidates = Array.isArray(attestationResponse?.attestations)
    ? attestationResponse.attestations.filter((item) => item?.predicateType === PREDICATE_TYPE)
    : [];
  if (candidates.length !== 1)
    fail(`expected one provenance attestation, found ${candidates.length}`, "provenance-schema");
  const bundle = candidates[0].bundle;
  const { workflowIdentity, options } = certificateIdentity(expected);
  let signer;
  try {
    signer = await verifyBundle(bundle, options);
  } catch (error) {
    fail(
      `Sigstore verification failed: ${error instanceof Error ? error.message : String(error)}`,
      "provenance-signature",
    );
  }
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

function expectedAttestationPath(name, version) {
  return `/-/npm/v1/attestations/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

export function canonicalAttestationUrl(view, name, version) {
  const records = Array.isArray(view?.dist?.attestations) ? view.dist.attestations : [];
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

export function parseRetryAfterMs(value, now = Date.now) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return undefined;
  return Math.max(0, at - now());
}

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
    throw Object.assign(new Error("attestation fetch failed"), {
      code: error?.cause?.code ?? error?.code,
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
    return result;
  } catch {
    fail("attestation endpoint returned malformed JSON", "registry-schema");
  }
}

function hasCompleteRegistryMetadata(view) {
  return (
    typeof view?.version === "string" &&
    typeof view?.dist?.tarball === "string" &&
    typeof view?.dist?.integrity === "string"
  );
}

export async function verifyInstallWithRetry(name, version, options = {}) {
  return retryBounded(async (attempt) => {
    const consumer = mkdtempSync(join(tmpdir(), `sn-oxc-published-${attempt}-`));
    try {
      writeFileSync(
        join(consumer, "package.json"),
        JSON.stringify({ name: "sn-oxc-published-verify", private: true, type: "module" }),
      );
      if (options.install)
        options.install("npm", verificationInstallArgs(name, version), {
          cwd: consumer,
          encoding: "utf8",
        });
      else runNpmJson(verificationInstallArgs(name, version), { cwd: consumer });
      await (options.importPackage ?? importInstalledPackage)(consumer, name, version);
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

export async function main(argv = process.argv) {
  const localPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const name = argValue(argv, "--name") ?? localPkg.name;
  const version = argValue(argv, "--version") ?? localPkg.version;
  const timeoutMs = argValue(argv, "--timeout-ms") ?? "180000";
  const intervalMs = argValue(argv, "--interval-ms") ?? "3000";
  const tarballFlag = argValue(argv, "--tarball");
  if (!tarballFlag) fail("--tarball is required for exact registry verification", "arguments");
  const tarball = isAbsolute(tarballFlag) ? tarballFlag : join(process.cwd(), tarballFlag);
  const integrity = tarballIntegrity(readFileSync(tarball));
  const repository =
    argValue(argv, "--repository") ?? "https://github.com/martinthommesen/oxc-plugin-servicenow";
  const workflow = argValue(argv, "--workflow") ?? ".github/workflows/release.yml";
  const environment = argValue(argv, "--environment") ?? "release";
  const ref = argValue(argv, "--ref") ?? process.env.GITHUB_REF;
  const commit = argValue(argv, "--commit") ?? process.env.GITHUB_SHA;
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
