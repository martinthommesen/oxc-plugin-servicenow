import { spawnSync } from "node:child_process";

/**
 * @typedef {object} HostError
 * @property {string} [code]
 * @property {string} message
 */
/**
 * @typedef {object} HostResult
 * @property {string[]} argv
 * @property {number | null} status
 * @property {NodeJS.Signals | null} signal
 * @property {string} stdout
 * @property {string} stderr
 * @property {HostError | null} error
 * @property {boolean} timedOut
 * @property {number} durationMs
 */
/**
 * @typedef {object} OxlintDiagnostic
 * @property {string} [message]
 * @property {string} [code]
 * @property {string} [severity]
 * @property {string} [filename]
 */
/**
 * @typedef {object} OxlintReport
 * @property {OxlintDiagnostic[]} diagnostics
 * @property {number} [number_of_files]
 */
/**
 * @typedef {object} ProofExpectation
 * @property {string} rule
 * @property {string} [file]
 * @property {number} [minCount]
 */
/**
 * @typedef {object} GitState
 * @property {"clean" | "dirty" | "error"} kind
 * @property {string} detail
 */
/**
 * @typedef {object} OxlintProof
 * @property {boolean} ok
 * @property {string[]} reasons
 * @property {string[]} pluginRules
 * @property {OxlintDiagnostic[]} hostFaults
 * @property {OxlintDiagnostic[]} unexpectedErrors
 */

/** @type {number} */
const DEFAULT_TIMEOUT_MS = 60_000;
/** @type {number} */
const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;

/**
 * A result for an attempt that never reached a child process, so a caller can
 * record the same shape whether or not the host ran.
 *
 * @returns {HostResult}
 */
export function emptyHostResult() {
  return {
    argv: [],
    status: null,
    signal: null,
    stdout: "",
    stderr: "",
    error: null,
    timedOut: false,
    durationMs: 0,
  };
}

/**
 * @param {{ bin: string, args: string[], cwd: string, timeoutMs?: number, maxBuffer?: number }} options
 * @returns {HostResult}
 */
export function runHostProcess({
  bin,
  args,
  cwd,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBuffer = DEFAULT_MAX_BUFFER,
}) {
  const started = Date.now();
  const argv = [bin, ...args];
  const result = spawnSync(bin, args, {
    encoding: "utf8",
    cwd,
    timeout: timeoutMs,
    maxBuffer,
    killSignal: "SIGKILL",
  });
  const spawnError = /** @type {Error & { code?: unknown }} */ (result.error);
  const spawnCode = typeof spawnError?.code === "string" ? spawnError.code : undefined;
  const error = result.error
    ? { ...(spawnCode === undefined ? {} : { code: spawnCode }), message: result.error.message }
    : null;
  return {
    argv,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error,
    timedOut: error?.code === "ETIMEDOUT",
    durationMs: Date.now() - started,
  };
}

/**
 * @param {string} stdout
 * @returns {{ report: OxlintReport | null, parseError: string | null }}
 */
export function parseOxlintStdout(stdout) {
  try {
    const report = JSON.parse(stdout);
    if (!report || !Array.isArray(report.diagnostics)) {
      return { report: null, parseError: "oxlint JSON has no diagnostics array" };
    }
    return { report, parseError: null };
  } catch {
    return { report: null, parseError: "oxlint did not emit JSON" };
  }
}

/**
 * @param {string | undefined} code
 * @returns {string | undefined}
 */
export function unwrapServicenowRuleId(code) {
  if (typeof code !== "string") return undefined;
  const wrapped = /^servicenow\((.+)\)$/.exec(code);
  if (wrapped) return `servicenow/${wrapped[1]}`;
  if (code.startsWith("servicenow/")) return code;
  return undefined;
}

/** @type {ReadonlySet<string>} */
const HOST_FAULT_CODES = new Set(["parser", "plugin-load"]);

const PLUGIN_LOAD_STDOUT = /Failed to load JS plugin|Cannot find module/i;

/**
 * @param {string | undefined} code
 * @returns {boolean}
 */
export function isHostFaultCode(code) {
  return typeof code === "string" && HOST_FAULT_CODES.has(code);
}

/**
 * @param {OxlintDiagnostic} diagnostic
 * @returns {string | undefined}
 */
export function hostFaultCodeFor(diagnostic) {
  return isHostFaultCode(diagnostic?.code) ? diagnostic.code : undefined;
}

/**
 * @param {string | undefined} stdout
 * @returns {string | undefined}
 */
export function hostFaultCodeForStdout(stdout) {
  return PLUGIN_LOAD_STDOUT.test(String(stdout ?? "")) ? "plugin-load" : undefined;
}

/**
 * @param {OxlintDiagnostic} diagnostic
 * @returns {boolean}
 */
export function isHostFaultDiagnostic(diagnostic) {
  if (hostFaultCodeFor(diagnostic) !== undefined) return true;
  return isErrorSeverity(diagnostic) && (diagnostic?.code === undefined || diagnostic.code === "");
}

/**
 * @param {OxlintDiagnostic} diagnostic
 * @returns {boolean}
 */
export function isErrorSeverity(diagnostic) {
  if (typeof diagnostic?.severity !== "string") return false;
  const severity = diagnostic.severity.toLowerCase();
  return severity === "error" || severity === "fatal";
}

/**
 * @param {OxlintReport | null | undefined} report
 * @param {string} [filenamePart]
 * @returns {string[]}
 */
export function pluginRuleIdOccurrences(report, filenamePart) {
  const ids = (report?.diagnostics ?? [])
    .filter((diagnostic) =>
      filenamePart ? String(diagnostic.filename ?? "").includes(filenamePart) : true,
    )
    .map((diagnostic) => unwrapServicenowRuleId(diagnostic.code))
    .filter((id) => id !== undefined);
  return /** @type {string[]} */ (ids);
}

/**
 * @param {OxlintReport | null | undefined} report
 * @param {string} [filenamePart]
 * @returns {string[]}
 */
export function pluginRuleIds(report, filenamePart) {
  return [...new Set(pluginRuleIdOccurrences(report, filenamePart))].sort();
}

/**
 * @param {{ status: number | null, stdout?: string, stderr?: string, error?: HostError | null, signal?: NodeJS.Signals | null }} input
 * @returns {GitState}
 */
export function interpretGitStatus({ status, stdout, stderr, error, signal }) {
  if (error || signal || status !== 0) {
    return {
      kind: "error",
      detail: [error?.message, signal ? `signal ${signal}` : "", stderr, stdout]
        .filter(Boolean)
        .join("\n"),
    };
  }
  const dirty = String(stdout ?? "").trim();
  if (dirty) return { kind: "dirty", detail: dirty };
  return { kind: "clean", detail: "" };
}

/**
 * @param {HostResult | undefined} host
 * @returns {string[]}
 */
function hostFailureReasons(host) {
  const reasons = [];
  if (host?.error) reasons.push(`spawn: ${host.error.message}`);
  if (host?.signal) reasons.push(`signal: ${host.signal}`);
  if (host?.timedOut) reasons.push("timed out");
  return reasons;
}

/**
 * @param {HostResult | undefined} host
 * @returns {string | undefined}
 */
function firstStdoutLine(host) {
  return String(host?.stdout ?? "")
    .split(/\r?\n/)
    .find((line) => line.trim());
}

/**
 * @param {{ tree: string, status: number | null, report: OxlintReport | null, parseError: string | null, host?: HostResult, expectations?: ProofExpectation[], expectedFileCount?: number }} input
 * @returns {OxlintProof}
 */
export function classifyOxlintProof({
  tree,
  status,
  report,
  parseError,
  host,
  expectations,
  expectedFileCount,
}) {
  const reasons = hostFailureReasons(host);
  if (status !== 0 && status !== 1 && status !== null) {
    reasons.push(`unexpected status ${status}`);
  }
  const stdoutLine = firstStdoutLine(host);
  if (parseError) {
    reasons.push(stdoutLine ? `${parseError}: ${stdoutLine}` : parseError);
  }
  if (!report) {
    const hostFaults = [];
    const stdoutCode = hostFaultCodeForStdout(host?.stdout);
    if (stdoutCode) {
      hostFaults.push({
        code: stdoutCode,
        message: stdoutLine || parseError || stdoutCode,
        severity: "error",
      });
    }
    return { ok: false, reasons, pluginRules: [], hostFaults, unexpectedErrors: [] };
  }
  if (status === 1 && report.diagnostics.length === 0) {
    reasons.push("status 1 with zero diagnostics");
  }
  if (expectedFileCount !== undefined) {
    if (typeof report.number_of_files !== "number") {
      reasons.push("oxlint JSON is missing number_of_files");
    } else if (report.number_of_files !== expectedFileCount) {
      reasons.push(`number_of_files ${report.number_of_files}, expected ${expectedFileCount}`);
    }
  }

  const hostFaults = report.diagnostics.filter((diagnostic) => isHostFaultDiagnostic(diagnostic));
  if (hostFaults.length > 0) {
    reasons.push(
      `host fault: ${hostFaults
        .map(
          (diagnostic) =>
            [diagnostic.code, diagnostic.message].filter(Boolean).join(": ") || "uncoded error",
        )
        .join(", ")}`,
    );
  }

  const unexpectedErrors = report.diagnostics.filter((diagnostic) => {
    if (unwrapServicenowRuleId(diagnostic.code) || isHostFaultDiagnostic(diagnostic)) {
      return false;
    }
    if (typeof diagnostic?.severity !== "string") return true;
    return isErrorSeverity(diagnostic);
  });
  if (unexpectedErrors.length > 0) {
    reasons.push(
      `non-plugin error: ${unexpectedErrors
        .map((diagnostic) => diagnostic.code || diagnostic.message || "(unnamed)")
        .join(", ")}`,
    );
  }

  const pluginRules = pluginRuleIds(report);
  if (tree === "valid") {
    if (status !== 0) reasons.push("valid tree requires status 0");
    if (pluginRules.length > 0) {
      reasons.push(`unexpected plugin rules: ${pluginRules.join(", ")}`);
    }
  } else if (tree === "invalid") {
    const requiredExpectations = expectations ?? [];
    if (status !== 1) reasons.push("invalid tree requires status 1");
    if (requiredExpectations.length === 0) reasons.push("invalid drive has no expectations");
    const expectedRules = new Set(requiredExpectations.map((item) => item.rule));
    for (const expectation of requiredExpectations) {
      const hits = report.diagnostics.filter((diagnostic) => {
        if (unwrapServicenowRuleId(diagnostic.code) !== expectation.rule) return false;
        if (expectation.file && !String(diagnostic.filename ?? "").includes(expectation.file)) {
          return false;
        }
        return true;
      });
      const minCount = expectation.minCount ?? 1;
      if (!Number.isInteger(minCount) || minCount < 1) {
        reasons.push(`invalid minCount for ${expectation.rule}`);
        continue;
      }
      if (hits.length < minCount) {
        reasons.push(
          `expected ${expectation.rule} on ${expectation.file ?? "*"} at least ${minCount}, got ${hits.length}`,
        );
      }
    }
    const extra = pluginRules.filter((id) => !expectedRules.has(id));
    if (extra.length > 0) reasons.push(`unexpected plugin rules: ${extra.join(", ")}`);
    for (const diagnostic of report.diagnostics) {
      const id = unwrapServicenowRuleId(diagnostic.code);
      if (!id || !expectedRules.has(id)) continue;
      const fileConstraints = requiredExpectations.filter((item) => item.rule === id && item.file);
      if (fileConstraints.length === 0) continue;
      const matches = fileConstraints.some((item) =>
        String(diagnostic.filename ?? "").includes(item.file ?? ""),
      );
      if (!matches) {
        reasons.push(`unexpected ${id} on ${diagnostic.filename ?? "*"}`);
      }
    }
  } else {
    reasons.push(`unknown tree ${tree}`);
  }

  return { ok: reasons.length === 0, reasons, pluginRules, hostFaults, unexpectedErrors };
}

/**
 * @param {HostResult} host
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function classifyOxfmtProof(host) {
  const reasons = hostFailureReasons(host);
  if (host.status !== 0) reasons.push(`oxfmt status ${host.status}`);
  return { ok: reasons.length === 0, reasons };
}
