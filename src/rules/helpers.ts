import type { Context } from "@oxlint/plugins";
import { getFileAnalysis, type FileAnalysis, type ProvenanceQuery } from "../analysis/internal.js";
import type { ServiceNowScriptContext } from "../types.js";

export interface RuleFileState {
  context: ServiceNowScriptContext;
  analysis: ProvenanceQuery;
  file: FileAnalysis;
}

/**
 * Resolve the per-file state for one hook. Every `before()` and visitor calls
 * this separately because oxlint forbids touching `context.sourceCode` in the
 * `createOnce` body, so state cannot be resolved once up front. Repeat calls
 * are cache hits on the same file.
 */
export function beginRuleFile(context: Context): RuleFileState {
  const file = getFileAnalysis(context);
  return { context: file.script, analysis: file.provenance, file };
}
