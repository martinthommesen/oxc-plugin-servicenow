import type { ESTree } from "@oxlint/plugins";
import { getStringValue } from "../utils/ast.js";
import { analyzePathBindings, mergeTri } from "./path-state.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface GlideAjaxParamFinding {
  node: ESTree.CallExpression;
  name: string;
  messageId: "missingName" | "badPrefix" | "afterTerminal";
  param?: string;
}

interface AjaxData {
  sysparmName: boolean | "unknown";
  terminal: boolean | "unknown";
}

const TERMINAL = new Set(["getXML", "getXMLAnswer", "getXMLWait"]);

/**
 * Track `addParam("sysparm_name")` before terminal GlideAjax request calls.
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
      sysparmName: mergeTri(left.sysparmName, right.sysparmName),
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
          rec.data.sysparmName = mergeTri(rec.data.sysparmName, "unknown");
        } else if (key === "sysparm_name") {
          rec.data.sysparmName = true;
        } else if (!key.startsWith("sysparm_")) {
          findings.push({ node: call, name: objectName, messageId: "badPrefix", param: key });
        }
      }
      if (TERMINAL.has(property)) {
        if (rec.data.sysparmName === false) {
          findings.push({ node: call, name: objectName, messageId: "missingName" });
        }
        rec.data.terminal = true;
      }
    },
  });
  return findings;
}
