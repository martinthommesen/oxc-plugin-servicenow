import { spawnSync } from "node:child_process";

export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;

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

export function unwrapServicenowRuleId(code) {
  if (typeof code !== "string") return undefined;
  const wrapped = /^servicenow\((.+)\)$/.exec(code);
  if (wrapped) return `servicenow/${wrapped[1]}`;
  if (code.startsWith("servicenow/")) return code;
  return undefined;
}

export const HOST_FAULT_CODES = new Set(["parser", "plugin-load"]);

export function isHostFaultCode(code) {
  return typeof code === "string" && HOST_FAULT_CODES.has(code);
}

export function isHostFaultDiagnostic(diagnostic) {
  if (isHostFaultCode(diagnostic?.code)) return true;
  return isErrorSeverity(diagnostic) && (diagnostic?.code === undefined || diagnostic.code === "");
}

export function isErrorSeverity(diagnostic) {
  if (typeof diagnostic?.severity !== "string") return false;
  const severity = diagnostic.severity.toLowerCase();
  return severity === "error" || severity === "fatal";
}

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

function hostFailureReasons(host) {
  const reasons = [];
  if (host?.error) reasons.push(`spawn: ${host.error.message}`);
  if (host?.signal) reasons.push(`signal: ${host.signal}`);
  if (host?.timedOut) reasons.push("timed out");
  return reasons;
}

export function classifyOxlintProof({ tree, status, report, parseError, host, expectations }) {
  const reasons = hostFailureReasons(host);
  if (status !== 0 && status !== 1 && status !== null) {
    reasons.push(`unexpected status ${status}`);
  }
  if (parseError) {
    const firstLine = String(host?.stdout ?? "")
      .split(/\r?\n/)
      .find((line) => line.trim());
    reasons.push(firstLine ? `${parseError}: ${firstLine}` : parseError);
  }
  if (!report) {
    return { ok: false, reasons, pluginRules: [], hostFaults: [], unexpectedErrors: [] };
  }
  if (status === 1 && report.diagnostics.length === 0) {
    reasons.push("status 1 with zero diagnostics");
  }

  const hostFaults = report.diagnostics.filter((diagnostic) => isHostFaultDiagnostic(diagnostic));
  if (hostFaults.length > 0) {
    reasons.push(
      `host fault: ${hostFaults
        .map((diagnostic) => diagnostic.code || diagnostic.message || "uncoded error")
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
        String(diagnostic.filename ?? "").includes(item.file),
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

export function classifyOxfmtProof(host) {
  const reasons = hostFailureReasons(host);
  if (host.status !== 0) reasons.push(`oxfmt status ${host.status}`);
  return { ok: reasons.length === 0, reasons };
}
