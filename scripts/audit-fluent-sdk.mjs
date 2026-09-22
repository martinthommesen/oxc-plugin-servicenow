import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { FLUENT_SDK_ARTIFACTS } from "../src/fluent/registry.js";
import {
  DEFAULT_FLUENT_SDK_VERSION,
  SUPPORTED_FLUENT_SDK_VERSIONS,
} from "../src/fluent/sdk-versions.js";
import { FLUENT_DECLARATION_SNAPSHOTS } from "../src/fluent/declaration-snapshots.js";
import { compareFluentVersions } from "../src/fluent/evidence.js";
import { DEFAULT_FLUENT_MANIFEST } from "../src/fluent/manifest.js";
import { isMainModule, root } from "./lib/repo.mjs";

const fixturePath = path.join(root, "tests/fixtures/fluent-sdk-declarations.json");
const generatedPath = path.join(root, "src/fluent/declaration-snapshots.ts");
const registryBase = "https://registry.npmjs.org";
const packageNames = ["@servicenow/sdk", "@servicenow/sdk-core"];
const FETCH_TIMEOUT_MS = 30_000;
const MAX_METADATA_BYTES = 16 * 1024 * 1024;
const MAX_TARBALL_DOWNLOAD_BYTES = 64 * 1024 * 1024;
// The reviewed @servicenow/sdk@4.11.0 package unpacks to 56,676,619 bytes.
const MAX_TAR_BYTES = 64 * 1024 * 1024;
const phantomCandidates = ["DatabaseIndex", "Module", "ScriptedRestApi", "UiFormatter"];
const reviewedNames = [
  ...new Set([...DEFAULT_FLUENT_MANIFEST.apis.map((api) => api.name), ...phantomCandidates]),
].sort();
/**
 * @typedef {object} AuditModuleOwner
 * @property {string} name
 * @property {Map<string, Buffer>} files
 * @property {{ exports?: Readonly<Record<string, unknown>> }} [manifest]
 */
/**
 * @typedef {object} AuditDeclarationEvidence
 * @property {string} module
 * @property {string} exportName
 * @property {string} declarationPath
 * @property {string} declarationSha256
 * @property {string} sourceSha256
 * @property {string} kind
 * @property {string} idPolicy
 */
/**
 * @typedef {object} AuditRuntimeVersionEntry
 * @property {unknown} [capabilities]
 * @property {unknown} [discoveredCapabilities]
 * @property {unknown} [absent]
 * @property {unknown} [lifecycle]
 */

/**
 * @param {string} value
 * @returns {string}
 */
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * First reviewed SDK version whose audit discovered `name`, or null when no
 * reviewed version exports it.
 *
 * @param {Record<string, { discoveredCapabilities?: unknown } | undefined>} allVersions
 * @param {string} name
 * @returns {string | null}
 */
function firstVersionExporting(allVersions, name) {
  return (
    SUPPORTED_FLUENT_SDK_VERSIONS.find(
      (candidate) =>
        /** @type {Record<string, unknown> | undefined} */ (
          allVersions[candidate]?.discoveredCapabilities
        )?.[name] !== undefined,
    ) ?? null
  );
}

/**
 * Lifecycle evidence for one version, derived from the audited versions.
 *
 * `allVersions` supplies the first reviewed version that exported a name, which
 * is why this runs after every version has been audited rather than inside
 * `auditVersion`. Reading that scan from the audited objects keeps the
 * generator independent of the module it emits.
 *
 * @param {string} version
 * @param {any} capabilities
 * @param {any} discoveredCapabilities
 * @param {any} allVersions
 */
function lifecycleSnapshot(version, capabilities, discoveredCapabilities, allVersions) {
  /** @param {string} left @param {string} right */
  const atOrAfter = (left, right) => compareFluentVersions(left, right) >= 0;
  return Object.fromEntries(
    [...new Set([...Object.keys(capabilities), ...Object.keys(discoveredCapabilities)])]
      .sort()
      .map((name) => {
        const api = DEFAULT_FLUENT_MANIFEST.apis.find((item) => item.name === name);
        if (api?.introduced && !atOrAfter(version, api.introduced)) return null;
        const introduced =
          api?.introduced ?? (api ? null : firstVersionExporting(allVersions, name));
        return [
          name,
          {
            introduced,
            deprecated:
              api?.deprecated && atOrAfter(version, api.deprecated) ? api.deprecated : null,
          },
        ];
      })
      .filter((entry) => entry !== null),
  );
}

/**
 * @param {Buffer} bytes
 * @param {string} integrity
 * @param {string} label
 * @returns {void}
 */
export function verifyIntegrity(bytes, integrity, label) {
  const [algorithm, expected] = integrity.split("-", 2);
  assert.equal(algorithm, "sha512", `${label}: unsupported integrity algorithm`);
  const actual = createHash("sha512").update(bytes).digest("base64");
  assert.equal(actual, expected, `${label}: tarball integrity mismatch`);
}

/**
 * Accept only the npm-owned artifact URL for the exact package and version.
 * @param {string} value
 * @param {string} name
 * @param {string} version
 * @returns {string}
 */
export function canonicalRegistryTarballUrl(value, name, version) {
  assert.ok(packageNames.includes(name), `${name}@${version}: unsupported package name`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name}@${version}: tarball URL is malformed`);
  }
  const basename = name.slice("@servicenow/".length);
  const expectedPath = `/@servicenow/${basename}/-/${basename}-${version}.tgz`;
  assert.ok(
    url.origin === registryBase &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      url.pathname === expectedPath,
    `${name}@${version}: tarball URL is not the canonical npm artifact`,
  );
  return url.href;
}

/**
 * Buffer a registry response only after enforcing declared and observed byte caps.
 * @param {Response} response
 * @param {string} label
 * @param {number} maxBytes
 * @returns {Promise<Buffer>}
 */
export async function readResponseBytes(response, label, maxBytes) {
  assert.ok(
    Number.isSafeInteger(maxBytes) && maxBytes > 0,
    `${label}: response byte cap must be a positive safe integer`,
  );
  const rawLength = response.headers.get("content-length");
  if (rawLength !== null) {
    assert.match(rawLength, /^(?:0|[1-9]\d*)$/u, `${label}: invalid Content-Length`);
    const declaredLength = Number(rawLength);
    assert.ok(
      Number.isSafeInteger(declaredLength) && declaredLength <= maxBytes,
      `${label}: declared response exceeds ${maxBytes} bytes`,
    );
  }
  assert.ok(response.body, `${label}: response body is missing`);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        // Best-effort cancel; the size error below is the real failure.
        await reader.cancel().catch(() => undefined);
        throw new Error(`${label}: response exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

/**
 * @param {Buffer} bytes
 * @param {number} start
 * @param {number} length
 * @returns {string}
 */
function tarString(bytes, start, length) {
  const end = bytes.indexOf(0, start);
  return bytes
    .subarray(start, end === -1 || end > start + length ? start + length : end)
    .toString("utf8");
}

/**
 * @param {Buffer} tgz
 * @param {string} label
 * @param {number} [maxOutputLength]
 * @returns {Map<string, Buffer>}
 */
export function tarFiles(tgz, label, maxOutputLength = MAX_TAR_BYTES) {
  const tar = gunzipSync(tgz, { maxOutputLength });
  const files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = tarString(header, 0, 100);
    const prefix = tarString(header, 345, 155);
    const filename = prefix ? `${prefix}/${name}` : name;
    const sizeText = tarString(header, 124, 12).trim().replace(/\0.*$/u, "");
    const size = Number.parseInt(sizeText || "0", 8);
    assert.ok(
      Number.isSafeInteger(size) && size >= 0,
      `${label}: invalid tar size for ${filename}`,
    );
    const type = String.fromCharCode(header[156] ?? 0);
    const normalized = path.posix.normalize(filename);
    assert.ok(
      filename === normalized && filename.startsWith("package/") && !filename.includes("/../"),
      `${label}: unsafe tar path ${filename}`,
    );
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    assert.ok(contentEnd <= tar.length, `${label}: truncated tar entry ${filename}`);
    if (type === "0" || type === "\0") {
      assert.ok(!files.has(filename), `${label}: duplicate tar path ${filename}`);
      files.set(filename, tar.subarray(contentStart, contentEnd));
    } else if (type !== "5") {
      throw new Error(
        `${label}: unsupported tar entry type ${JSON.stringify(type)} for ${filename}`,
      );
    }
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  return files;
}

/**
 * @param {string} name
 * @returns {Promise<any>}
 */
async function metadata(name) {
  const encoded = encodeURIComponent(name);
  const url = `${registryBase}/${encoded}`;
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  assert.equal(response.status, 200, `${name}: registry metadata status ${response.status}`);
  if (response.url) assert.equal(response.url, url, `${name}: registry metadata URL changed`);
  const bytes = await readResponseBytes(response, `${name}: registry metadata`, MAX_METADATA_BYTES);
  const parsed = JSON.parse(bytes.toString("utf8"));
  assert.ok(
    parsed && typeof parsed === "object" && !Array.isArray(parsed),
    `${name}: metadata malformed`,
  );
  return parsed;
}

/**
 * @param {any} meta
 * @param {string} name
 * @param {string} version
 */
async function artifact(meta, name, version) {
  const record = meta.versions?.[version];
  assert.ok(record, `${name}@${version}: metadata missing`);
  assert.equal(record.name, name, `${name}@${version}: package name mismatch`);
  assert.equal(record.version, version, `${name}@${version}: package version mismatch`);
  const tarballUrl = canonicalRegistryTarballUrl(record.dist?.tarball ?? "", name, version);
  assert.match(
    record.dist?.integrity ?? "",
    /^sha512-/u,
    `${name}@${version}: sha512 integrity required`,
  );
  const response = await fetch(tarballUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  assert.equal(response.status, 200, `${name}@${version}: tarball status ${response.status}`);
  if (response.url)
    assert.equal(response.url, tarballUrl, `${name}@${version}: tarball response URL changed`);
  const bytes = await readResponseBytes(
    response,
    `${name}@${version}: tarball`,
    MAX_TARBALL_DOWNLOAD_BYTES,
  );
  verifyIntegrity(bytes, record.dist.integrity, `${name}@${version}`);
  const files = tarFiles(bytes, `${name}@${version}`);
  const packageFile = files.get("package/package.json");
  assert.ok(packageFile, `${name}@${version}: package.json missing`);
  const manifest = JSON.parse(packageFile.toString("utf8"));
  assert.equal(manifest.name, name, `${name}@${version}: tarball name mismatch`);
  assert.equal(manifest.version, version, `${name}@${version}: tarball version mismatch`);
  return {
    name,
    version,
    publishedAt: meta.time?.[version] ?? null,
    tarball: tarballUrl,
    integrity: record.dist.integrity,
    files,
    manifest,
  };
}

/**
 * @param {any} declaration
 * @returns {string[]}
 */
function declarationNames(declaration) {
  if (!declaration || typeof declaration !== "object") return [];
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.flatMap(
      /** @param {any} item */ (item) => (item.id?.type === "Identifier" ? [item.id.name] : []),
    );
  }
  return typeof declaration.id?.name === "string" ? [declaration.id.name] : [];
}

/**
 * @param {any} node
 * @returns {string | null}
 */
function literalValue(node) {
  return node?.type === "Literal" && typeof node.value === "string" ? node.value : null;
}

/**
 * @param {any} node
 * @returns {string | null}
 */
function identifierName(node) {
  return node?.type === "Identifier" && typeof node.name === "string" ? node.name : null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function exportTarget(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  for (const key of ["types", "import", "default"]) {
    const target = exportTarget(/** @type {Record<string, unknown>} */ (value)[key]);
    if (target) return target;
  }
  return null;
}

/**
 * @param {string} filename
 * @param {string} source
 * @returns {any}
 */
export function parseModule(filename, source) {
  assert.ok(source.length <= 2_000_000, `${filename}: declaration module exceeds 2 MB`);
  const result = parseSync(filename, source, { lang: "ts", sourceType: "module" });
  assert.equal(
    result.errors.length,
    0,
    `${filename}: declaration parse failed: ${result.errors[0]?.message ?? "unknown"}`,
  );
  return result.program;
}

/**
 * @param {AuditModuleOwner} sdk
 * @param {AuditModuleOwner & { manifest: { exports?: Readonly<Record<string, unknown>> } }} core
 * @returns {{ inspect: (owner: AuditModuleOwner, filename: string) => Map<string, AuditDeclarationEvidence>, unresolvedBareExports: Set<string> }}
 */
export function moduleResolver(sdk, core) {
  const cache = new Map();
  const active = new Set();
  const unresolvedBareExports = new Set();
  let visited = 0;

  /**
   * @param {AuditModuleOwner} owner
   * @param {string} current
   * @param {string} specifier
   * @returns {string}
   */
  const resolveRelative = (owner, current, specifier) => {
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(current), specifier));
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.d.ts`,
      `${base}/index.ts`,
      `${base}/index.d.ts`,
    ]
      .filter((candidate, index, all) => all.indexOf(candidate) === index)
      .filter((candidate) => owner.files.has(candidate));
    assert.equal(candidates.length, 1, `${current}: ambiguous or missing export ${specifier}`);
    return /** @type {string} */ (candidates[0]);
  };

  /**
   * @param {string} specifier
   * @returns {string}
   */
  const resolveCoreSubpath = (specifier) => {
    const subpath = `./${specifier.slice("@servicenow/sdk-core/".length)}`;
    const exports = core.manifest.exports ?? {};
    let target = exportTarget(exports[subpath]);
    const wildcard = exportTarget(exports["./*"]);
    if (!target && wildcard) {
      target = wildcard.replaceAll("*", subpath.slice(2));
    }
    assert.ok(typeof target === "string", `${specifier}: core package export missing`);
    const filename = `package/${target.replace(/^\.\//u, "")}`;
    assert.ok(core.files.has(filename), `${specifier}: exported core entry missing`);
    return filename;
  };

  /**
   * @param {AuditModuleOwner} owner
   * @param {string} current
   * @param {string} specifier
   */
  const resolveSource = (owner, current, specifier) => {
    if (specifier.startsWith("."))
      return { owner, filename: resolveRelative(owner, current, specifier) };
    if (owner === sdk && specifier.startsWith("@servicenow/sdk-core/")) {
      return { owner: core, filename: resolveCoreSubpath(specifier) };
    }
    unresolvedBareExports.add(specifier);
    return null;
  };

  /**
   * @param {AuditModuleOwner} owner
   * @param {string} filename
   */
  const inspect = (owner, filename) => {
    const key = `${owner.name}:${filename}`;
    if (cache.has(key)) return cache.get(key);
    assert.ok(!active.has(key), `${filename}: cyclic declaration export graph`);
    assert.ok(++visited <= 4_000, "declaration export graph exceeds 4,000 modules");
    active.add(key);
    const bytes = owner.files.get(filename);
    assert.ok(bytes, `${filename}: declaration module missing`);
    const source = bytes.toString("utf8");
    const program = parseModule(filename, source);
    const local = new Map();
    const result = new Map();
    const conflicts = new Set();
    const policyByName = new Map();

    for (const statement of program.body) {
      const declaration =
        statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
      if (!declaration) continue;
      const snippet = source.slice(declaration.start ?? 0, declaration.end ?? 0);
      for (const name of declarationNames(declaration)) {
        if (/Now\.Internal\.(?:WithID|WithIdAndMetadata)\b/u.test(snippet)) {
          policyByName.set(name, "required");
        } else if (
          snippet.includes("@deprecated") &&
          snippet.indexOf("$id?", snippet.indexOf("@deprecated")) >= 0
        ) {
          policyByName.set(name, "deprecated");
        }
      }
    }

    /**
     * @param {string} name
     * @param {any} declaration
     */
    const evidence = (name, declaration) => {
      const start = declaration?.start ?? 0;
      const end = declaration?.end ?? source.length;
      const snippet = source.slice(start, end);
      const functionLike = declaration?.type === "FunctionDeclaration";
      return {
        module: "@servicenow/sdk/core",
        exportName: name,
        declarationPath: filename.replace(/^package\//u, ""),
        declarationSha256: sha256(snippet.replace(/\s+/gu, " ").trim()),
        sourceSha256: sha256(source),
        kind: functionLike ? "function" : (declaration?.type ?? "re-export"),
        idPolicy: policyByName.get(name) ?? "unknown",
      };
    };

    for (const statement of program.body) {
      if (statement.type === "ExportNamedDeclaration" && statement.declaration) {
        for (const name of declarationNames(statement.declaration)) {
          const item = evidence(name, statement.declaration);
          local.set(name, item);
          result.set(name, item);
        }
      } else if (!statement.type.startsWith("Export")) {
        for (const name of declarationNames(statement)) local.set(name, evidence(name, statement));
      }
    }

    /**
     * @param {string} name
     * @param {any} item
     */
    const merge = (name, item) => {
      if (!item || conflicts.has(name)) return;
      const prior = result.get(name);
      if (
        prior &&
        (prior.declarationPath !== item.declarationPath ||
          prior.declarationSha256 !== item.declarationSha256)
      ) {
        result.delete(name);
        conflicts.add(name);
      } else {
        result.set(name, item);
      }
    };

    for (const statement of program.body) {
      if (statement.type === "ExportAllDeclaration") {
        const specifier = literalValue(statement.source);
        assert.ok(specifier, `${filename}: export-all source missing`);
        if (statement.exported) {
          const name = identifierName(statement.exported);
          if (name) merge(name, evidence(name, statement));
          continue;
        }
        const target = resolveSource(owner, filename, specifier);
        if (!target) continue;
        for (const [name, item] of inspect(target.owner, target.filename)) merge(name, item);
      }
      if (statement.type === "ExportNamedDeclaration" && statement.specifiers.length > 0) {
        let target = local;
        const specifier = literalValue(statement.source);
        if (specifier) {
          const resolved = resolveSource(owner, filename, specifier);
          if (!resolved) continue;
          target = inspect(resolved.owner, resolved.filename);
        }
        for (const specifierNode of statement.specifiers) {
          const localName = identifierName(specifierNode.local);
          const exportedName = identifierName(specifierNode.exported);
          if (localName && exportedName) merge(exportedName, target.get(localName));
        }
      }
    }
    active.delete(key);
    cache.set(key, result);
    return result;
  };

  return { inspect, unresolvedBareExports };
}

/**
 * @param {string} version
 * @param {any} metadataByName
 */
async function auditVersion(version, metadataByName) {
  const [sdk, core] = await Promise.all([
    artifact(metadataByName["@servicenow/sdk"], "@servicenow/sdk", version),
    artifact(metadataByName["@servicenow/sdk-core"], "@servicenow/sdk-core", version),
  ]);
  assert.equal(
    sdk.manifest.dependencies?.["@servicenow/sdk-core"],
    version,
    `${version}: SDK/core pin mismatch`,
  );
  const expected = /** @type {Record<string, any>} */ (FLUENT_SDK_ARTIFACTS)[version];
  assert.ok(expected, `${version}: reviewed artifact record missing`);
  assert.equal(sdk.integrity, expected.sdkIntegrity, `${version}: SDK integrity drift`);
  assert.equal(core.integrity, expected.coreIntegrity, `${version}: core integrity drift`);
  const entry = exportTarget(sdk.manifest.exports?.["./core"]);
  assert.ok(typeof entry === "string", `${version}: SDK ./core export missing`);
  const entryPath = `package/${entry.replace(/^\.\//u, "")}`;
  assert.ok(sdk.files.has(entryPath), `${version}: SDK ./core entry missing`);
  const resolver = moduleResolver(sdk, core);
  const exports = resolver.inspect(sdk, entryPath);
  /** @type {Record<string, any>} */
  const capabilities = {};
  const absent = [];
  for (const name of reviewedNames) {
    const item = exports.get(name);
    if (item) capabilities[name] = item;
    else absent.push(name);
  }
  const unreviewedRequiredFactories = [...exports.values()]
    .filter(
      (item) =>
        item.kind === "function" &&
        item.idPolicy === "required" &&
        !reviewedNames.includes(item.exportName),
    )
    .map((item) => item.exportName)
    .sort();
  const discoveredCapabilities = Object.fromEntries(
    [...exports.entries()]
      .filter(([, item]) => item.kind === "function" && item.idPolicy === "required")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return {
    version,
    sdk: {
      name: sdk.name,
      version,
      publishedAt: sdk.publishedAt,
      tarball: sdk.tarball,
      integrity: sdk.integrity,
      coreDependency: sdk.manifest.dependencies["@servicenow/sdk-core"],
      coreEntry: entry.replace(/^\.\//u, ""),
    },
    core: {
      name: core.name,
      version,
      publishedAt: core.publishedAt,
      tarball: core.tarball,
      integrity: core.integrity,
    },
    exportInventorySha256: sha256(
      JSON.stringify([...exports.entries()].sort(([a], [b]) => a.localeCompare(b))),
    ),
    capabilities,
    discoveredCapabilities,
    absent,
    unresolvedBareExports: [...resolver.unresolvedBareExports].sort(),
    unreviewedRequiredFactories,
  };
}

/**
 * Attach lifecycle evidence once every version has been audited.
 *
 * Introduction is a cross-version fact: a name's introduction is the first
 * reviewed version that exported it. Deriving it after the loop is what lets
 * the generator read only the objects it just built.
 *
 * @param {string} version
 * @param {Record<string, unknown>} item
 * @param {Record<string, unknown>} allVersions
 * @returns {Record<string, unknown>}
 */
export function withLifecycle(version, item, allVersions) {
  const { unresolvedBareExports, unreviewedRequiredFactories, ...evidence } = item;
  return {
    ...evidence,
    lifecycle: lifecycleSnapshot(
      version,
      item["capabilities"],
      item["discoveredCapabilities"],
      allVersions,
    ),
    unresolvedBareExports,
    unreviewedRequiredFactories,
  };
}

/**
 * Reduce the audited object to the fields shipped code reads.
 *
 * `registry.ts` needs a declaration's id policy and the set of declared names
 * with the version each name first appeared in. Everything else the audit
 * produces -- declaration paths and hashes, `absent`, `typos`, `lifecycle` --
 * is review evidence: it stays in the fixture so the drift check can compare
 * against it, but it is not package input.
 *
 * @param {{ versions: Record<string, AuditRuntimeVersionEntry> }} snapshot
 * @returns {Record<string, unknown>}
 */
export function runtimeSnapshot(snapshot) {
  return Object.fromEntries(
    Object.entries(snapshot.versions).map(([version, item]) => {
      const capabilities = /** @type {Record<string, any>} */ (item.capabilities);
      const idPolicy = Object.fromEntries(
        Object.entries(capabilities).map(([name, capability]) => [name, capability.idPolicy]),
      );
      const discoveredCapabilities = /** @type {Record<string, any>} */ (
        item.discoveredCapabilities
      );
      const discovered = Object.fromEntries(
        Object.entries(discoveredCapabilities).map(([name, capability]) => [
          name,
          {
            module: capability.module,
            introduced: firstVersionExporting(snapshot.versions, name),
          },
        ]),
      );
      return [version, { idPolicy, discovered }];
    }),
  );
}

/**
 * @param {any} value
 * @param {number} [indent]
 * @returns {string}
 */
function typescriptLiteral(value, indent = 0) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const childIndent = " ".repeat(indent + 2);
    return `[\n${value
      .map(
        /** @param {any} item */ (item) => `${childIndent}${typescriptLiteral(item, indent + 2)},`,
      )
      .join("\n")}\n${" ".repeat(indent)}]`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  const childIndent = " ".repeat(indent + 2);
  const properties = entries.map(([key, item]) => {
    const renderedKey = /^[A-Za-z_$][0-9A-Za-z_$]*$/u.test(key) ? key : JSON.stringify(key);
    return `${childIndent}${renderedKey}: ${typescriptLiteral(item, indent + 2)},`;
  });
  return `{\n${properties.join("\n")}\n${" ".repeat(indent)}}`;
}

/**
 * @param {unknown} snapshot
 * @returns {string}
 */
export function generatedSource(snapshot) {
  const runtime = runtimeSnapshot(
    /** @type {{ versions: Record<string, AuditRuntimeVersionEntry> }} */ (snapshot),
  );
  return (
    `/* Generated by scripts/audit-fluent-sdk.mjs. Do not edit. */\n` +
    `import type { DeclarationSnapshot } from "./snapshot-types.js";\n\n` +
    `export const FLUENT_DECLARATION_SNAPSHOTS: Readonly<Record<string, DeclarationSnapshot>> = ${typescriptLiteral(runtime)};\n`
  );
}

/**
 * @returns {Promise<void>}
 */
export async function main() {
  const mode = process.argv.includes("--update") ? "update" : "registry";
  const metadataByName = Object.fromEntries(
    await Promise.all(packageNames.map(async (name) => [name, await metadata(name)])),
  );
  const published = Object.keys(metadataByName["@servicenow/sdk"].versions).filter((version) =>
    /^\d+\.\d+\.\d+$/u.test(version),
  );
  assert.ok(
    !published.some((version) => compareFluentVersions(version, DEFAULT_FLUENT_SDK_VERSION) > 0),
    `new stable @servicenow/sdk version published above ${DEFAULT_FLUENT_SDK_VERSION}`,
  );

  /** @type {Record<string, any>} */
  const versions = {};
  for (const version of SUPPORTED_FLUENT_SDK_VERSIONS) {
    versions[version] = await auditVersion(version, metadataByName);
    process.stdout.write(`Audited @servicenow/sdk@${version}\n`);
  }
  for (const version of SUPPORTED_FLUENT_SDK_VERSIONS) {
    versions[version] = withLifecycle(version, versions[version], versions);
  }
  const snapshot = {
    schemaVersion: 1,
    defaultVersion: DEFAULT_FLUENT_SDK_VERSION,
    reviewedVersions: [...SUPPORTED_FLUENT_SDK_VERSIONS],
    versions,
  };
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  const source = generatedSource(snapshot);

  if (mode === "update") {
    await writeFile(fixturePath, json);
    await writeFile(generatedPath, source);
    process.stdout.write(
      `Updated ${path.relative(root, fixturePath)} and ${path.relative(root, generatedPath)}\n`,
    );
  } else {
    assert.equal(await readFile(fixturePath, "utf8"), json, "Fluent declaration fixture drift");
    assert.deepEqual(
      FLUENT_DECLARATION_SNAPSHOTS,
      runtimeSnapshot(snapshot),
      "Fluent declaration runtime snapshot drift",
    );
    process.stdout.write("Fluent SDK declaration snapshot matches the npm registry\n");
  }
}

if (isMainModule(import.meta.url)) await main();
