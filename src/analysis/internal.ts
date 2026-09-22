export { buildScopeTree, createFileBindings, isFunctionLike } from "./bindings.js";
export type { FileBindings, ImmediateFunction } from "./bindings.js";
export {
  analyzeProvenance,
  getFileAnalysis,
  getScriptContext,
  getAnalysisPassCount,
  resetAnalysisPassCount,
} from "./file-analysis.js";
export { ctorProvenanceKind, getAncestors } from "./provenance.js";
export type { ProvenanceKind, ProvenanceQuery } from "./provenance.js";
export type { FileAnalysis } from "./file-analysis.js";
export type { BindingWriteQuery } from "./binding-writes.js";
export { isAvailabilityGuarded, isInvocationAvailabilityGuarded } from "./availability.js";
export type { AvailabilityGuardOptions } from "./availability.js";
export {
  directPlatformGlobalName,
  platformGlobalNamespaceAccess,
  resolvePlatformGlobalName,
} from "./globals.js";
export { findAclQueries } from "./acl-query.js";
export { importedBindingFor, resolveFluentCandidate } from "./fluent-imports.js";
export { findUnhoistedBlockFunctionUses } from "./block-function-hoisting.js";
export { findObjectMethodConstructions } from "./object-method-construction.js";
export { createEmptyArrayBindingQuery } from "./empty-array-bindings.js";
export {
  GLIDE_RECORD_CONSTRUCTORS,
  hasAuthoritativeConstructedMethod,
  hasAuthoritativeGlobalObjectMethod,
  hasAuthoritativeGlideRecordMethod,
  provenReceiver,
  provenReceiverMethod,
} from "./platform-method-authority.js";
export type { PlatformMethodAuthorityFacts } from "./platform-method-authority.js";
export {
  isDefinitelyNonCallable,
  isDefinitelyNullishValue,
  staticPropertyName,
  isComputedUnknown,
  resolveConstValue,
  resolveDominatingConstValue,
  resolveDestructuredConstMember,
} from "./members.js";
export { findMissingQueryBeforeNext } from "./query-before-next.js";
export { findWindowedDeleteMultiple } from "./glide-windowing.js";
export { findGlideAjaxParamIssues } from "./glideajax-params.js";
export { findGlideAggregateIssues } from "./glideaggregate.js";
export {
  findNowIdMisuses,
  findDuplicateFluentIds,
  isCanonicalNowInclude,
  isProvenNowIdValue,
} from "./now-id.js";
export type { FluentImportBinding } from "./fluent-imports.js";
export { findQueryModifiersAfterQuery } from "./glide-query-lifecycle.js";
export { findUnfilteredBulkOperations } from "./glide-bulk-filter.js";
export { findQueriesInCursorLoops } from "./glide-query-in-loop.js";
export { findChooseWindowWithoutNoCount } from "./glide-setnocount.js";
export {
  findStablePlatformConstructorCalls,
  findStablePlatformStaticMethodCalls,
  isNewExpressionFinding,
} from "./platform-constructor-calls.js";
export type {
  PlatformConstructorCallFinding,
  PlatformStaticMethodCallFinding,
} from "./platform-constructor-calls.js";
export { resolveStableCallable } from "./stable-invocations.js";
export { builtInCallMayWritePlatformProperty } from "./builtin-property-writes.js";
export { findRetainedElements } from "./glideelement-retention.js";
export {
  isDefinitelyEmptyMapperSource,
  isDefinitelyPrimitiveThisArgument,
  isDefinitelySloppyMapper,
  mapperUsesOwnThis,
} from "./array-from-thisarg.js";
