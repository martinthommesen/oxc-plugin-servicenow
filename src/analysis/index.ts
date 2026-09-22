export { analyzeProvenance, getScriptContext } from "./public.js";
export type {
  AnalysisProvenance,
  AnalysisProvenanceQuery,
  PublicProvenanceKind,
} from "./public.js";
// Every type reachable through a public signature is exported here so a
// consumer can annotate the returned values (FINDINGS.md API-003).
export type { Provenance } from "./provenance.js";
export type {
  ApplicationScope,
  BusinessRuleSourceFormat,
  BusinessRuleWhen,
  ContextConfidence,
  ContextSourceMap,
  JavaScriptMode,
  ScriptAuthoring,
  ScriptSurface,
  ServiceNowScriptContext,
  SettingsDeprecation,
  ValidatedServiceNowSettings,
} from "../types.js";
