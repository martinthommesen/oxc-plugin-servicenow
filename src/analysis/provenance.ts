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

export interface Provenance {
  kind: ProvenanceKind;
  /** Binding is no longer a reliable alias of the constructed object. */
  invalid: boolean;
  /** Passed to unknown code, stored externally, or captured by an escaping nested function. */
  escaped: boolean;
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

/** Every provenance kind a modeled constructor can produce, in declaration order. */
export const CONSTRUCTED_PROVENANCE_KINDS: readonly ProvenanceKind[] = [
  ...new Set(Object.values(CTOR_TO_KIND)),
];

/** Platform globals that denote ambient namespaces rather than constructors. */
export type PlatformAliasGlobal = Extract<ProvenanceKind, "g_form" | "gs" | "current">;

const PLATFORM_ALIAS_GLOBALS: ReadonlySet<string> = new Set<PlatformAliasGlobal>([
  "g_form",
  "gs",
  "current",
]);

export function isPlatformAliasGlobal(name: string): name is PlatformAliasGlobal {
  return PLATFORM_ALIAS_GLOBALS.has(name);
}

/**
 * The per-file provenance answers plus the two inputs every finder needs to
 * compute them. `bindings` and `glide` are carried here, rather than threaded
 * through each finder signature, because the per-domain finders in this
 * directory take one `ProvenanceQuery` argument and read both.
 */
export interface ProvenanceQuery {
  ofIdentifier(node: ESTree.Node): Provenance | null;
  ofExpression(node: unknown): Provenance | null;
  /** Return provenance only while the value remains a proven, unescaped identity. */
  trustedExpression(node: unknown): Provenance | null;
  isPlatformGlobal(node: ESTree.Node): boolean;
  isPlatformCtor(node: unknown, names: readonly string[]): boolean;
  isPlatformMember(node: unknown, object: string, property?: string): boolean;
  /** Lexical bindings for the same file; an input to the query, not a provenance fact. */
  bindings: FileBindings;
  /** Glide capabilities for the configured scope and release; also an input. */
  glide: GlideCapabilityView;
}

/** Host ancestor chain, or empty when the host omits ancestors or the query fails. */
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
