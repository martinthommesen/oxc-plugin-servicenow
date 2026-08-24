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
  /** Passed to a helper, stored, or closed over by a nested function. */
  escaped: boolean;
  queryState: QueryState;
  /** `setLimit` / `chooseWindow` was seen on this object. */
  windowed: boolean;
  /** `addParam("sysparm_name", ...)` was seen on this GlideAjax object. */
  sysparmName: boolean;
  /** Statically registered `addAggregate(type, field?)` tuples. */
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
