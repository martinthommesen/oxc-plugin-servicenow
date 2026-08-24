import type { ESTree } from "@oxlint/plugins";
import { getStringValue, nodeStart } from "../utils/ast.js";
import { classifyStaticArg } from "./static-args.js";
import {
  hasAuthoritativeConstructedMethod,
  type PlatformMethodAuthorityFacts,
} from "./platform-method-authority.js";
import { analyzePathBindings, dedupePathFindings, mergeTri } from "./path-state.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface GlideAjaxParamFinding {
  node: ESTree.CallExpression;
  name: string;
  messageId: "missingName" | "emptyValue" | "invalidValue" | "badPrefix" | "afterTerminal";
  param?: string;
}

type SysparmNameState = false | true | "empty" | "unknown";

interface AjaxData {
  sysparmName: SysparmNameState;
  terminal: boolean | "unknown";
  /** Dynamic key/value evidence remains silent instead of pretending missing. */
  uncertain: boolean;
}

const TERMINAL = new Set(["getXML", "getXMLAnswer", "getXMLWait"]);

function mergeSysparm(left: SysparmNameState, right: SysparmNameState): SysparmNameState {
  if (left === right) return left;
  if (left === false || right === false) return "unknown";
  if (left === "empty" || right === "empty") return "unknown";
  return "unknown";
}

function sysparmValueState(
  call: ESTree.CallExpression,
  analysis: ProvenanceQuery,
): SysparmNameState | "invalid" {
  if (call.arguments.length < 2) return "empty";
  const value = classifyStaticArg(call.arguments[1], analysis);
  switch (value) {
    case "missing":
    case "empty":
      return "empty";
    case "present":
      return getStringValue(call.arguments[1]) !== null ? true : "invalid";
    case "unknown":
      return "unknown";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

/**
 * Track a usable `addParam("sysparm_name", method)` before each terminal
 * GlideAjax request. Empty or missing method values do not satisfy the key.
 * Dynamic keys and branch disagreement become unknown and stay silent.
 */
export function findGlideAjaxParamIssues(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  authority: PlatformMethodAuthorityFacts,
): GlideAjaxParamFinding[] {
  const findings: GlideAjaxParamFinding[] = [];
  const reported = new Set<string>();
  const report = (finding: GlideAjaxParamFinding): void => {
    const key = `${nodeStart(finding.node)}:${finding.messageId}`;
    if (reported.has(key)) return;
    reported.add(key);
    findings.push(finding);
  };
  analyzePathBindings<AjaxData>({
    program,
    analysis,
    kinds: ["GlideAjax"],
    emptyData: () => ({ sysparmName: false, terminal: false, uncertain: false }),
    cloneData: (data) => ({ ...data }),
    equalsData: (left, right) =>
      left.sysparmName === right.sysparmName &&
      left.terminal === right.terminal &&
      left.uncertain === right.uncertain,
    mergeData: (left, right) => ({
      sysparmName: mergeSysparm(left.sysparmName, right.sysparmName),
      terminal: mergeTri(left.terminal, right.terminal),
      uncertain: left.uncertain || right.uncertain,
    }),
    onCall({ call, rec, receiver, objectName, property }) {
      if (!rec || !receiver || !objectName || !property) return;
      if (property !== "addParam" && !TERMINAL.has(property)) return;
      if (!hasAuthoritativeConstructedMethod(authority, receiver, "GlideAjax", property)) {
        // An unproven addParam implementation may or may not register the
        // method name. Preserve uncertainty so a later real request stays
        // silent instead of being reported as definitely unconfigured.
        if (property === "addParam") {
          rec.data.sysparmName = mergeSysparm(rec.data.sysparmName, "unknown");
          rec.data.uncertain = true;
        }
        return;
      }
      if (property === "addParam") {
        if (rec.data.terminal === true) {
          report({ node: call, name: objectName, messageId: "afterTerminal" });
        }
        const key = getStringValue(call.arguments[0]);
        const keyEvidence = classifyStaticArg(call.arguments[0], analysis);
        if (key === null && keyEvidence === "unknown") {
          rec.data.sysparmName = mergeSysparm(rec.data.sysparmName, "unknown");
          rec.data.uncertain = true;
        } else if (key === "sysparm_name") {
          const valueState = sysparmValueState(call, analysis);
          if (valueState === "invalid") {
            report({ node: call, name: objectName, messageId: "invalidValue" });
            rec.data.sysparmName = "unknown";
            rec.data.uncertain = true;
          } else {
            rec.data.sysparmName = valueState;
          }
          if (rec.data.sysparmName === "unknown") rec.data.uncertain = true;
        } else if (key !== null && key.length > 0 && !key.startsWith("sysparm_")) {
          report({ node: call, name: objectName, messageId: "badPrefix", param: key });
        }
      }
      if (TERMINAL.has(property)) {
        if (
          rec.data.sysparmName === false ||
          (rec.data.sysparmName === "unknown" && !rec.data.uncertain)
        ) {
          report({ node: call, name: objectName, messageId: "missingName" });
        } else if (rec.data.sysparmName === "empty") {
          report({ node: call, name: objectName, messageId: "emptyValue" });
        }
        rec.data.terminal = true;
        rec.data.sysparmName = false;
        rec.data.uncertain = false;
      }
    },
    onBudgetExceeded() {
      findings.length = 0;
    },
  });
  return dedupePathFindings(findings, (finding) => finding.messageId);
}
