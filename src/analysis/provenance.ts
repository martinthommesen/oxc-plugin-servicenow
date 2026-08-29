import type { Context, ESTree } from "@oxlint/plugins";
import type { FileBindings } from "./bindings.js";
import type { GlideCapabilityView } from "../glide/manifest.js";

export type ProvenanceKind =
  | "GlideRecord"
  | "GlideAggregate"
  | "GlideAjax"
  | "GlideDateTime"
  | "DataView"
  | "Set"
  | "g_form"
  | "gs"
  | "current";

export type QueryState = "unopened" | "opened" | "unknown";

export interface Provenance {
  kind: ProvenanceKind;
  /** Binding is no longer a reliable alias of the constructed object. */
  invalid: boolean;
  /** Passed to unknown code, stored externally, or captured by an escaping nested function. */
  escaped: boolean;
  /**
   * @deprecated Never computed: always `"unopened"`. The lifecycle facts
   * live in the per-domain analyzers (`query-before-next.ts`,
   * `glide-windowing.ts`, `glideajax-params.ts`, `glide-setnocount.ts`).
   * Removed in 3.0 (FINDINGS.md API-002).
   */
  queryState: QueryState;
  /** @deprecated Never computed: always `false`. Removed in 3.0 (FINDINGS.md API-002). */
  windowed: boolean;
  /** @deprecated Never computed: always `false`. Removed in 3.0 (FINDINGS.md API-002). */
  sysparmName: boolean;
  /** @deprecated Never computed: always empty. Removed in 3.0 (FINDINGS.md API-002). */
  aggregates: ReadonlySet<string>;
  bindingId?: number;
  objectId?: number;
}

const CTOR_TO_KIND: Record<string, ProvenanceKind> = {
  GlideRecord: "GlideRecord",
  GlideRecordSecure: "GlideRecord",
  GlideAggregate: "GlideAggregate",
  GlideAjax: "GlideAjax",
  GlideDateTime: "GlideDateTime",
  DataView: "DataView",
  Set: "Set",
};

export function ctorProvenanceKind(name: string | null): ProvenanceKind | null {
  if (!name) return null;
  return Object.prototype.hasOwnProperty.call(CTOR_TO_KIND, name) ? CTOR_TO_KIND[name]! : null;
}

export interface ProvenanceQuery {
  ofIdentifier(node: ESTree.Node): Provenance | null;
  ofExpression(node: unknown): Provenance | null;
  isPlatformGlobal(node: ESTree.Node): boolean;
  isPlatformCtor(node: unknown, names: readonly string[]): boolean;
  isPlatformMember(node: unknown, object: string, property?: string): boolean;
  bindings: FileBindings;
  glide: GlideCapabilityView;
}

export function getAncestors(context: Context, node: ESTree.Node): ESTree.Node[] {
  const sourceCode = context.sourceCode as unknown as {
    getAncestors?: (node: ESTree.Node) => ESTree.Node[];
  };
  if (typeof sourceCode.getAncestors === "function") {
    try {
      return sourceCode.getAncestors(node);
    } catch {
      return [];
    }
  }
  return [];
}
