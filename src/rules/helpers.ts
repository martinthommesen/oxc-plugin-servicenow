import type { Context, ESTree } from "@oxlint/plugins";
import { analyzeProvenance, type ProvenanceQuery } from "../analysis/index.js";
import { getScriptContext } from "../context/index.js";
import type { ServiceNowScriptContext } from "../types.js";

export interface RuleFileState {
  context: ServiceNowScriptContext;
  analysis: ProvenanceQuery;
}

interface CachedFileState {
  key: string;
  state: RuleFileState;
}

const sessions = new WeakMap<Context, CachedFileState>();

function fileKey(context: Context): string {
  return `${context.filename}\0${context.sourceCode.text}`;
}

export function beginRuleFile(context: Context): RuleFileState {
  const key = fileKey(context);
  const existing = sessions.get(context);
  if (existing && existing.key === key) return existing.state;
  const script = getScriptContext(context);
  const analysis = analyzeProvenance(context);
  const state = { context: script, analysis };
  sessions.set(context, { key, state });
  return state;
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
