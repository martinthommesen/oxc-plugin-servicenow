export { buildScopeTree, createFileBindings, collectPatternNames } from "./bindings.js";
export type { FileBindings, LexicalBinding, ScopeTree } from "./bindings.js";
export { analyzeProvenance, getFileAnalysis, getScriptContext, getAnalysisPassCount, resetAnalysisPassCount } from "./file-analysis.js";
export { ctorProvenanceKind, getAncestors } from "./provenance.js";
export type { Provenance, ProvenanceKind, ProvenanceQuery, QueryState } from "./provenance.js";
export type { FileAnalysis } from "./file-analysis.js";
export type { BindingId, ObjectId, Completion } from "./path-state.js";
export { staticPropertyName, staticCalleeProperty, isComputedUnknown } from "./members.js";
export { findMissingQueryBeforeNext } from "./query-before-next.js";
export type { MissingQueryFinding } from "./query-before-next.js";
export { findWindowedDeleteMultiple } from "./glide-windowing.js";
export type { WindowedDeleteFinding } from "./glide-windowing.js";
export { findGlideAjaxParamIssues } from "./glideajax-params.js";
export type { GlideAjaxParamFinding } from "./glideajax-params.js";
export { findGlideAggregateIssues } from "./glideaggregate.js";
export type { AggregateFinding } from "./glideaggregate.js";
export {
  findNowIdMisuses,
  findDuplicateFluentIds,
  isCanonicalNow,
  isCanonicalNowId,
  isCanonicalNowInclude,
  isProvenNowIdValue,
} from "./now-id.js";
export type { NowIdMisuse, DuplicateFluentId, NowIdFact } from "./now-id.js";
export { collectFluentImports, resolveFluentFactory } from "./fluent-imports.js";
export type { FluentImportBinding } from "./fluent-imports.js";
export type { FluentFileFacts } from "./file-analysis.js";
export { findGlideElementCollections } from "./glide-element-collection.js";
export type { GlideElementCollectionFinding } from "./glide-element-collection.js";
export { findQueryModifiersAfterQuery } from "./glide-query-lifecycle.js";
export type { QueryModifierFinding } from "./glide-query-lifecycle.js";
export { findUnfilteredBulkOperations } from "./glide-bulk-filter.js";
export type { UnfilteredBulkFinding } from "./glide-bulk-filter.js";
export { findQueriesInCursorLoops } from "./glide-query-in-loop.js";
export type { QueryInLoopFinding } from "./glide-query-in-loop.js";
export { findChooseWindowWithoutNoCount } from "./glide-setnocount.js";
export type { ChooseWindowCountFinding } from "./glide-setnocount.js";
