import type { Context } from "@oxlint/plugins";
import { resolvePlatformGlobalName } from "../analysis/globals.js";
import {
  getFileAnalysis,
  resolveConstValue,
  staticPropertyName,
  type FileAnalysis,
  type ProvenanceQuery,
} from "../analysis/internal.js";
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

/**
 * Whether `node` resolves to the `property` member of the platform global
 * `owner` (for example `Reflect.apply`), through const aliases.
 */
export function isPlatformStaticMember(
  node: unknown,
  owner: string,
  property: string,
  analysis: ProvenanceQuery,
): boolean {
  const value = resolveConstValue(node, analysis.bindings);
  return Boolean(
    value?.type === "MemberExpression" &&
    staticPropertyName(value) === property &&
    resolvePlatformGlobalName(value.object, analysis.bindings) === owner,
  );
}
