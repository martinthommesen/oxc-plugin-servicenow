import type { Context, ESTree } from "@oxlint/plugins";
import type { ServiceNowScriptContext } from "../types.js";
import { immutableSet } from "../utils/immutable.js";
import {
  analyzeProvenance as analyzeInternal,
  getScriptContext as getInternalContext,
} from "./file-analysis.js";
import type { Provenance, ProvenanceKind, QueryState } from "./provenance.js";

export interface AnalysisProvenance {
  readonly kind: ProvenanceKind;
  readonly invalid: boolean;
  readonly escaped: boolean;
  /**
   * @deprecated Never computed: always `"unopened"`. Cursor lifecycle facts
   * live in the per-domain analyzers behind the rules, not in this record.
   * Removed in 3.0 (FINDINGS.md API-002, `docs/decisions.md`).
   */
  readonly queryState: QueryState;
  /**
   * @deprecated Never computed: always `false`. Removed in 3.0
   * (FINDINGS.md API-002, `docs/decisions.md`).
   */
  readonly windowed: boolean;
  /**
   * @deprecated Never computed: always `false`. Removed in 3.0
   * (FINDINGS.md API-002, `docs/decisions.md`).
   */
  readonly sysparmName: boolean;
  /**
   * @deprecated Never computed: always empty. Removed in 3.0
   * (FINDINGS.md API-002, `docs/decisions.md`).
   */
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
  if (!value) return null;
  const cached = publicProvenance.get(value);
  if (cached) return cached;
  const wrapped = Object.freeze({ ...value, aggregates: immutableSet(value.aggregates) });
  publicProvenance.set(value, wrapped);
  return wrapped;
}

export function getScriptContext(context: Context): ServiceNowScriptContext {
  return getInternalContext(context);
}

export function analyzeProvenance(context: Context, ast?: ESTree.Node): AnalysisProvenanceQuery {
  const query = analyzeInternal(context, ast);
  return Object.freeze({
    ofIdentifier: (node: ESTree.Node) => readonlyProvenance(query.ofIdentifier(node)),
    ofExpression: (node: unknown) => readonlyProvenance(query.ofExpression(node)),
    isPlatformGlobal: (node: ESTree.Node) => query.isPlatformGlobal(node),
    isPlatformCtor: (node: unknown, names: readonly string[]) => query.isPlatformCtor(node, names),
    isPlatformMember: (node: unknown, object: string, property?: string) =>
      query.isPlatformMember(node, object, property),
  });
}
