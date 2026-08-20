import type { ESTree } from "@oxlint/plugins";
import { getStringValue } from "../utils/ast.js";
import { classifyStaticArg } from "./static-args.js";
import { analyzePathBindings, mergeTri } from "./path-state.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface GlideAjaxParamFinding {
  node: ESTree.CallExpression;
  name: string;
  messageId: "missingName" | "emptyValue" | "badPrefix" | "afterTerminal";
  param?: string;
}

type SysparmNameState = false | true | "empty" | "unknown";

interface AjaxData {
  sysparmName: SysparmNameState;
  terminal: boolean | "unknown";
}

const TERMINAL = new Set(["getXML", "getXMLAnswer", "getXMLWait"]);

function mergeSysparm(left: SysparmNameState, right: SysparmNameState): SysparmNameState {
  if (left === right) return left;
  if (left === false || right === false) return "unknown";
  if (left === "empty" || right === "empty") return "unknown";
  return "unknown";
}

function sysparmValueState(call: ESTree.CallExpression): SysparmNameState {
  if (call.arguments.length < 2) return "empty";
  const value = classifyStaticArg(call.arguments[1]);
  switch (value) {
    case "missing":
    case "empty":
      return "empty";
    case "present":
      return true;
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
): GlideAjaxParamFinding[] {
  const findings: GlideAjaxParamFinding[] = [];
  analyzePathBindings<AjaxData>({
    program,
    analysis,
    kinds: ["GlideAjax"],
    emptyData: () => ({ sysparmName: false, terminal: false }),
    cloneData: (data) => ({ ...data }),
    mergeData: (left, right) => ({
      sysparmName: mergeSysparm(left.sysparmName, right.sysparmName),
      terminal: mergeTri(left.terminal, right.terminal),
    }),
    onCall({ call, rec, objectName, property }) {
      if (!rec || !objectName || !property) return;
      if (property === "addParam") {
        if (rec.data.terminal === true) {
          findings.push({ node: call, name: objectName, messageId: "afterTerminal" });
        }
        const key = getStringValue(call.arguments[0]);
        if (key === null) {
          rec.data.sysparmName = mergeSysparm(rec.data.sysparmName, "unknown");
        } else if (key === "sysparm_name") {
          rec.data.sysparmName = sysparmValueState(call);
        } else if (!key.startsWith("sysparm_")) {
          findings.push({ node: call, name: objectName, messageId: "badPrefix", param: key });
        }
      }
      if (TERMINAL.has(property)) {
        if (rec.data.sysparmName === false) {
          findings.push({ node: call, name: objectName, messageId: "missingName" });
        } else if (rec.data.sysparmName === "empty") {
          findings.push({ node: call, name: objectName, messageId: "emptyValue" });
        }
        rec.data.terminal = true;
        rec.data.sysparmName = false;
      }
    },
  });
  return findings;
}
