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

/** Platform globals that denote ambient namespaces rather than constructors. */
export const PLATFORM_ALIAS_GLOBALS: ReadonlySet<string> = new Set(["g_form", "gs", "current"]);

export interface ProvenanceQuery {
  ofIdentifier(node: ESTree.Node): Provenance | null;
  ofExpression(node: unknown): Provenance | null;
  /** Return provenance only while the value remains a proven, unescaped identity. */
  trustedExpression(node: unknown): Provenance | null;
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
