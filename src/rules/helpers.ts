import type { Context, ESTree } from "@oxlint/plugins";
import { getFileAnalysis, type ProvenanceQuery } from "../analysis/index.js";
import type { ServiceNowScriptContext } from "../types.js";

export interface RuleFileState {
  context: ServiceNowScriptContext;
  analysis: ProvenanceQuery;
}

export function beginRuleFile(context: Context): RuleFileState {
  const file = getFileAnalysis(context);
  return { context: file.script, analysis: file.provenance };
}

export function isPlatformGlobalName(
  analysis: ProvenanceQuery,
  node: ESTree.Node,
  name: string,
): boolean {
  const rec = node as { type?: string; name?: string };
  if (rec.type !== "Identifier" || rec.name !== name) return false;
  return analysis.isPlatformGlobal(node);
}
