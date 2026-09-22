import type { Context, ESTree } from "@oxlint/plugins";
import { getName, isNode } from "../utils/ast.js";
import { analyzeProvenance as analyzeInternal } from "./file-analysis.js";
import type { Provenance } from "./provenance.js";
import { staticPropertyName } from "./members.js";

export type PublicProvenanceKind =
  | "GlideRecord"
  | "GlideAggregate"
  | "GlideAjax"
  | "GlideDateTime"
  | "g_form"
  | "gs"
  | "current";

const PUBLIC_PROVENANCE_KINDS: ReadonlySet<string> = new Set<PublicProvenanceKind>([
  "GlideRecord",
  "GlideAggregate",
  "GlideAjax",
  "GlideDateTime",
  "g_form",
  "gs",
  "current",
]);

function isPublicProvenanceKind(value: string): value is PublicProvenanceKind {
  return PUBLIC_PROVENANCE_KINDS.has(value);
}

export type AnalysisProvenance = Readonly<
  Omit<Provenance, "kind"> & { kind: PublicProvenanceKind }
>;

export interface AnalysisProvenanceQuery {
  ofIdentifier(node: ESTree.Node): AnalysisProvenance | null;
  ofExpression(node: unknown): AnalysisProvenance | null;
  isPlatformGlobal(node: ESTree.Node): boolean;
  isPlatformCtor(node: unknown, names: readonly string[]): boolean;
  isPlatformMember(node: unknown, object: string, property?: string): boolean;
}

const publicProvenance = new WeakMap<Provenance, AnalysisProvenance>();

function readonlyProvenance(value: Provenance | null): AnalysisProvenance | null {
  if (!value || !isPublicProvenanceKind(value.kind)) return null;
  const cached = publicProvenance.get(value);
  if (cached) return cached;
  const wrapped = Object.freeze({ ...value, kind: value.kind });
  publicProvenance.set(value, wrapped);
  return wrapped;
}

export { getScriptContext } from "./file-analysis.js";

/** Analyze the host source tree, or an explicitly supplied tree whose nodes will be queried. */
export function analyzeProvenance(context: Context, ast?: ESTree.Node): AnalysisProvenanceQuery {
  const query = analyzeInternal(context, ast);
  return Object.freeze({
    ofIdentifier: (node: ESTree.Node) => readonlyProvenance(query.ofIdentifier(node)),
    ofExpression: (node: unknown) => readonlyProvenance(query.ofExpression(node)),
    isPlatformGlobal: (node: ESTree.Node) => query.isPlatformGlobal(node),
    isPlatformCtor: (node: unknown, names: readonly string[]) => query.isPlatformCtor(node, names),
    isPlatformMember: (node: unknown, object: string, property?: string) => {
      if (isPublicProvenanceKind(object)) {
        return query.isPlatformMember(node, object, property);
      }
      if (!isNode(node) || node.type !== "MemberExpression") return false;
      const member = node as ESTree.MemberExpression;
      if (getName(member.object) !== object || !query.isPlatformGlobal(member.object)) return false;
      return property === undefined || staticPropertyName(member) === property;
    },
  });
}
