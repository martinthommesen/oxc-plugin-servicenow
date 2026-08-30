import { spawnSync } from "node:child_process";

export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;

/**
 * Executes a host process synchronously and captures its execution result.
 * @param {object} options - Process execution options.
 * @param {string} options.bin - The executable to run.
 * @param {string[]} options.args - Arguments passed to the executable.
 * @param {string} [options.cwd] - Working directory for the process.
 * @param {number} [options.timeoutMs] - Maximum execution time in milliseconds.
 * @param {number} [options.maxBuffer] - Maximum output buffer size.
 * @returns {object} The command arguments, exit status, signal, standard output and error, normalized error, timeout state, and elapsed time.
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
    killSignal: "SIGTERM",
  });
  const error = result.error ? { code: result.error.code, message: result.error.message } : null;
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
 * Parses Oxlint JSON output and verifies that it contains diagnostics.
 * @param {string} stdout - The Oxlint process output.
 * @return {{report: object|null, parseError: string|null}} The parsed report and a parse error message when parsing fails or diagnostics are missing.
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
 * Converts a wrapped ServiceNow rule identifier to slash notation.
 * @param {string} code - The rule identifier to normalize.
 * @return {string|undefined} The normalized ServiceNow rule identifier, or `undefined` for unsupported values.
 */
export function unwrapServicenowRuleId(code) {
  if (typeof code !== "string") return undefined;
  const wrapped = /^servicenow\((.+)\)$/.exec(code);
  if (wrapped) return `servicenow/${wrapped[1]}`;
  if (code.startsWith("servicenow/")) return code;
  return undefined;
}

export const HOST_FAULT_CODES = new Set(["parser", "plugin-load"]);

/**
 * Determines whether a code identifies a host fault.
 * @param {*} code - The code to check.
 * @return {boolean} `true` if the code identifies a host fault, `false` otherwise.
 */
export function isHostFaultCode(code) {
  return typeof code === "string" && HOST_FAULT_CODES.has(code);
}

/**
 * Determines whether a diagnostic represents an error-level severity.
 * @param {object} diagnostic - The diagnostic to inspect.
 * @returns {boolean} `true` if the severity is `error` or `fatal`, `false` otherwise.
 */
export function isErrorSeverity(diagnostic) {
  if (typeof diagnostic?.severity !== "string") return false;
  const severity = diagnostic.severity.toLowerCase();
  return severity === "error" || severity === "fatal";
}

/**
 * Extract unique ServiceNow rule identifiers from diagnostic entries.
 * @param {Object} report - The diagnostic report.
 * @param {string} [filenamePart] - Optional filename substring used to filter diagnostics.
 * @returns {string[]} Sorted, unique ServiceNow rule identifiers.
 */
export function pluginRuleIds(report, filenamePart) {
  return [
    ...new Set(
      (report?.diagnostics ?? [])
        .filter((diagnostic) =>
          filenamePart ? String(diagnostic.filename ?? "").includes(filenamePart) : true,
        )
        .map((diagnostic) => unwrapServicenowRuleId(diagnostic.code))
        .filter((id) => id !== undefined),
    ),
  ].sort();
}

/**
 * Classifies Git execution as an error, dirty result, or clean result.
 * @param {Object} result - Git execution result and captured output.
 * @param {number|null} result.status - Process exit status.
 * @param {*} result.stdout - Standard output from Git.
 * @param {*} result.stderr - Standard error from Git.
 * @param {Error|null} result.error - Process execution error, if any.
 * @param {string|null} result.signal - Signal that terminated the process, if any.
 * @returns {{kind: string, detail: string}} The classification and associated detail.
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
 * Classifies Oxlint verification results against the expected tree and diagnostics.
 * @param {Object} options - Verification inputs.
 * @param {"valid"|"invalid"} options.tree - Expected tree classification.
 * @param {number|null} options.status - Oxlint exit status.
 * @param {Object|null} options.report - Parsed Oxlint diagnostic report.
 * @param {string|null} options.parseError - Error produced while parsing Oxlint output.
 * @param {Object} options.host - Host process execution details.
 * @param {Array<Object>} options.expectations - Expected plugin rules for an invalid tree.
 * @returns {Object} The verification result, including success status, failure reasons, detected plugin rules, host faults, and unexpected errors.
 */
export function classifyOxlintProof({ tree, status, report, parseError, host, expectations }) {
  const reasons = [];
  if (host?.error) reasons.push(`spawn: ${host.error.message}`);
  if (host?.signal) reasons.push(`signal: ${host.signal}`);
  if (host?.timedOut) reasons.push("timed out");
  if (status !== 0 && status !== 1 && status !== null) {
    reasons.push(`unexpected status ${status}`);
  }
  if (parseError) reasons.push(parseError);
  if (!report) {
    return { ok: false, reasons, pluginRules: [], hostFaults: [], unexpectedErrors: [] };
  }
  if (status === 1 && report.diagnostics.length === 0) {
    reasons.push("status 1 with zero diagnostics");
  }

  const hostFaults = report.diagnostics.filter((diagnostic) => isHostFaultCode(diagnostic.code));
  if (hostFaults.length > 0) {
    reasons.push(`host fault: ${hostFaults.map((diagnostic) => diagnostic.code).join(", ")}`);
  }

  const unexpectedErrors = report.diagnostics.filter((diagnostic) => {
    if (unwrapServicenowRuleId(diagnostic.code) || isHostFaultCode(diagnostic.code)) {
      return false;
    }
    if (typeof diagnostic?.severity !== "string") return true;
    return isErrorSeverity(diagnostic);
  });
  if (unexpectedErrors.length > 0) {
    reasons.push(
      `non-plugin error: ${unexpectedErrors.map((diagnostic) => diagnostic.code).join(", ")}`,
    );
  }

  const pluginRules = pluginRuleIds(report);
  if (tree === "valid") {
    if (status !== 0) reasons.push("valid tree requires status 0");
    if (pluginRules.length > 0) {
      reasons.push(`unexpected plugin rules: ${pluginRules.join(", ")}`);
    }
  } else if (tree === "invalid") {
    if (status !== 1) reasons.push("invalid tree requires status 1");
    if (!expectations?.length) reasons.push("invalid drive has no expectations");
    const expectedRules = new Set((expectations ?? []).map((item) => item.rule));
    for (const expectation of expectations ?? []) {
      const hits = report.diagnostics.filter((diagnostic) => {
        if (unwrapServicenowRuleId(diagnostic.code) !== expectation.rule) return false;
        if (expectation.file && !String(diagnostic.filename ?? "").includes(expectation.file)) {
          return false;
        }
        return true;
      });
      const minCount = expectation.minCount ?? 1;
      if (hits.length < minCount) {
        reasons.push(
          `expected ${expectation.rule} on ${expectation.file ?? "*"} at least ${minCount}, got ${hits.length}`,
        );
      }
    }
    const extra = pluginRules.filter((id) => !expectedRules.has(id));
    if (extra.length > 0) reasons.push(`unexpected plugin rules: ${extra.join(", ")}`);
  } else {
    reasons.push(`unknown tree ${tree}`);
  }

  return { ok: reasons.length === 0, reasons, pluginRules, hostFaults, unexpectedErrors };
}

/**
 * Classifies an Oxfmt execution result as successful or failed.
 * @param {Object} host - The captured Oxfmt execution result.
 * @returns {{ok: boolean, reasons: string[]}} The success status and any failure reasons.
 */
export function classifyOxfmtProof(host) {
  const reasons = [];
  if (host.error) reasons.push(`spawn: ${host.error.message}`);
  if (host.signal) reasons.push(`signal: ${host.signal}`);
  if (host.timedOut) reasons.push("timed out");
  if (host.status !== 0) reasons.push(`oxfmt status ${host.status}`);
  return { ok: reasons.length === 0, reasons };
}
