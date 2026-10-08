import type { ESTree } from "@oxlint/plugins";
import type { ConstantValue } from "./constant-value.js";
import type { ImmediateFunction } from "./bindings.js";
import type { ProvenanceKind, ProvenanceQuery } from "./provenance.js";

export type BindingId = number;
export type ObjectId = number;
export type Completion = "normal" | "return" | "throw" | "break" | "continue";
export type InternalCompletion = Completion | "unreachable" | "suspend";

export interface SharedRecord<T> {
  id: ObjectId;
  escaped: boolean;
  invalid: boolean;
  data: T;
}

export interface PathCallInput<T> {
  call: ESTree.CallExpression;
  rec: SharedRecord<T> | undefined;
  /** Unwrapped member receiver captured before computed keys and arguments run. */
  receiver: ESTree.Node | null;
  objectName: string | null;
  property: string | null;
}

export interface PathRefInput<T> {
  node: ESTree.Node;
  rec: SharedRecord<T> | undefined;
  name: string | null;
  bindingId: BindingId | null;
}

export type AbruptCompletion = Exclude<InternalCompletion, "normal">;
export interface ClassValue {
  readonly type: "ClassValue";
  readonly node: ESTree.Class;
  readonly bases: CallableValues;
}

export type CallableValues = readonly (ImmediateFunction | ClassValue | undefined)[];

export interface EvaluatedValue {
  readonly objectId: ObjectId | undefined;
  readonly functions: CallableValues;
  readonly constant: ConstantValue | null;
  readonly literalShape?: LiteralArgumentShape;
}

export type LiteralArgumentValue =
  | { readonly kind: "unknown" }
  | { readonly kind: "null" }
  | { readonly kind: "undefined" }
  | { readonly kind: "defined"; readonly literalShape?: LiteralArgumentShape };

export type LiteralArgumentShape =
  | {
      readonly kind: "object";
      readonly properties: ReadonlyMap<string, LiteralArgumentValue>;
      readonly rest: "unknown" | "undefined";
    }
  | {
      readonly kind: "array";
      readonly elements: readonly LiteralArgumentValue[];
      readonly rest: "unknown" | "undefined";
    };

export interface EnvState<T> {
  env: Map<BindingId, ObjectId | undefined>;
  functions: Map<BindingId, CallableValues>;
  /** Null marks a capture whose future writes cannot restore scalar certainty. */
  constants: Map<BindingId, ConstantValue | null>;
  /** Captured callable bindings whose later replacements are externally visible. */
  exposedCallables: Set<BindingId>;
  /** Selected logical-assignment values retained until their statement completes. */
  assignmentResults: Map<ESTree.Node, EvaluatedValue>;
  /** Callable values selected by expressions in the current statement. */
  callableResults: Map<ESTree.Node, CallableValues>;
  objects: Map<ObjectId, SharedRecord<T>>;
  /** Normal alternatives with different callable or selected assignment values. */
  callablePaths: EnvState<T>[];
  completion: InternalCompletion;
  /** Label on break/continue completions, if any. */
  completionLabel?: string | null | undefined;
  /** Alternative abrupt paths retained until their owning construct consumes them. */
  abrupt: Map<AbruptCompletion, EnvState<T>[]>;
}

export type PathAnalysisOutcome = { outcome: "complete" } | { outcome: "exhausted" };

export interface PathAnalysisOptions<T> {
  program: ESTree.Node;
  analysis: ProvenanceQuery;
  kinds: readonly ProvenanceKind[];
  emptyData: () => T;
  cloneData: (data: T) => T;
  mergeData: (left: T, right: T) => T;
  /** Merge different runtime identities only when the domain proves both are values of the same abstract kind. */
  mergeDistinctData?: (left: T, right: T) => T | undefined;
  equalsData: (left: T, right: T) => boolean;
  /** Input-dependent domain payload work charged before cloning, joining, comparing, and visiting hooks. */
  dataWork?: (data: T) => number;
  onCall?: (input: PathCallInput<T>) => void;
  onRef?: (input: PathRefInput<T>) => void;
  /** Allocate an abstract value; a later evaluation refreshes an invalid or escaped site. */
  onValue?: (node: ESTree.Node) => T | undefined;
  /**
   * Analyze function bodies that have no direct call in this file. Disable
   * this for execution diagnostics that must not inspect deferred or dead
   * helper bodies. Defaults to true for existing syntax and lifecycle passes.
   */
  analyzeUncalledFunctions?: boolean;
  /** Stop the current execution path at its first await while direct callers continue. */
  stopAtAwait?: boolean;
  /**
   * Retain records that no surviving binding references after a control-flow
   * join. Risk domains need these records for exit findings; program-point
   * alias domains can disable retention to keep loop fixpoints finite.
   */
  retainUnboundRecords?: boolean;
  /** Inspect every reachable program completion after the shared traversal. */
  onExit?: (states: readonly PathExitState<T>[]) => void;
  /** Internal deterministic work cap. Exceeding it returns an exhausted outcome. */
  maxWork?: number;
}

export interface PathExitState<T> {
  completion: Completion | "unreachable";
  records: readonly SharedRecord<T>[];
}

export interface PathFindingOptions<T, F extends { node: ESTree.Node }> extends Omit<
  PathAnalysisOptions<T>,
  "cloneData" | "onCall"
> {
  /** Defaults to a shallow copy, which suits every flat domain payload. */
  cloneData?: (data: T) => T;
  onCall: (input: PathCallInput<T>, report: (finding: F) => void) => void;
}
