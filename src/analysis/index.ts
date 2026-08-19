export { buildScopeTree, createFileBindings, collectPatternNames } from "./bindings.js";
export type { FileBindings, LexicalBinding, ScopeTree } from "./bindings.js";
export { analyzeProvenance, ctorProvenanceKind, getAncestors } from "./provenance.js";
export type { Provenance, ProvenanceKind, ProvenanceQuery, QueryState } from "./provenance.js";
export { staticPropertyName, staticCalleeProperty, isComputedUnknown } from "./members.js";
export { findMissingQueryBeforeNext } from "./query-before-next.js";
export type { MissingQueryFinding } from "./query-before-next.js";
