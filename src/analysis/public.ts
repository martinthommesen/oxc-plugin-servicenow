import type { Context, ESTree } from "@oxlint/plugins";
import type { ServiceNowScriptContext } from "../types.js";
import { immutableSet } from "../utils/immutable.js";
import { getName, isNode } from "../utils/ast.js";
import {
  analyzeProvenance as analyzeInternal,
  getScriptContext as getInternalContext,
} from "./file-analysis.js";
import type { Provenance, ProvenanceKind, QueryState } from "./provenance.js";
import { staticPropertyName } from "./members.js";

type PublicProvenanceKind =
  | "GlideRecord"
  | "GlideAggregate"
  | "GlideAjax"
  | "GlideDateTime"
  | "g_form"
  | "gs"
  | "current";

const PUBLIC_PROVENANCE_KINDS: ReadonlySet<ProvenanceKind> = new Set([
  "GlideRecord",
  "GlideAggregate",
  "GlideAjax",
  "GlideDateTime",
  "g_form",
  "gs",
  "current",
] satisfies readonly PublicProvenanceKind[]);

export interface AnalysisProvenance {
  readonly kind: PublicProvenanceKind;
  readonly invalid: boolean;
  readonly escaped: boolean;
  readonly queryState: QueryState;
  readonly windowed: boolean;
  readonly sysparmName: boolean;
  readonly aggregates: ReadonlySet<string>;
  readonly bindingId?: number;
  readonly objectId?: number;
}

export interface AnalysisProvenanceQuery {
  ofIdentifier(node: ESTree.Node): AnalysisProvenance | null;
  ofExpression(node: unknown): AnalysisProvenance | null;
  isPlatformGlobal(node: ESTree.Node): boolean;
  isPlatformCtor(node: unknown, names: readonly string[]): boolean;
  isPlatformMember(node: unknown, object: string, property?: string): boolean;
}

const publicProvenance = new WeakMap<Provenance, AnalysisProvenance>();

function readonlyProvenance(value: Provenance | null): AnalysisProvenance | null {
  if (!value || !PUBLIC_PROVENANCE_KINDS.has(value.kind)) return null;
  const cached = publicProvenance.get(value);
  if (cached) return cached;
  const wrapped = Object.freeze({
    ...value,
    kind: value.kind as PublicProvenanceKind,
    aggregates: immutableSet(value.aggregates),
  });
  publicProvenance.set(value, wrapped);
  return wrapped;
}

export function getScriptContext(context: Context): ServiceNowScriptContext {
  return getInternalContext(context);
}

/** Analyze the host source tree, or an explicitly supplied tree whose nodes will be queried. */
export function analyzeProvenance(context: Context, ast?: ESTree.Node): AnalysisProvenanceQuery {
  const query = analyzeInternal(context, ast);
  return Object.freeze({
    ofIdentifier: (node: ESTree.Node) => readonlyProvenance(query.ofIdentifier(node)),
    ofExpression: (node: unknown) => readonlyProvenance(query.ofExpression(node)),
    isPlatformGlobal: (node: ESTree.Node) => query.isPlatformGlobal(node),
    isPlatformCtor: (node: unknown, names: readonly string[]) => query.isPlatformCtor(node, names),
    isPlatformMember: (node: unknown, object: string, property?: string) => {
      if (PUBLIC_PROVENANCE_KINDS.has(object as ProvenanceKind)) {
        return query.isPlatformMember(node, object, property);
      }
      if (!isNode(node) || node.type !== "MemberExpression") return false;
      const member = node as ESTree.MemberExpression;
      if (getName(member.object) !== object || !query.isPlatformGlobal(member.object)) return false;
      return property === undefined || staticPropertyName(member) === property;
    },
  });
}
