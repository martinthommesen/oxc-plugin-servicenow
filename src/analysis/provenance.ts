import type { Context, ESTree } from "@oxlint/plugins";
import { getName, getStringValue, isNode, walk } from "../utils/ast.js";
import { createFileBindings, type FileBindings } from "./bindings.js";
import { staticPropertyName } from "./members.js";

export type ProvenanceKind =
  | "GlideRecord"
  | "GlideAggregate"
  | "GlideAjax"
  | "GlideDateTime"
  | "g_form"
  | "gs"
  | "current";

const PLATFORM_ALIAS_KINDS = new Set<ProvenanceKind>(["g_form", "gs", "current"]);

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
  aggregates: Set<string>;
}

const CTOR_TO_KIND: Record<string, ProvenanceKind> = {
  GlideRecord: "GlideRecord",
  GlideRecordSecure: "GlideRecord",
  GlideAggregate: "GlideAggregate",
  GlideAjax: "GlideAjax",
  GlideDateTime: "GlideDateTime",
};

const QUERY_OPENERS = new Set(["query", "get", "getAsync"]);

export function ctorProvenanceKind(name: string | null): ProvenanceKind | null {
  if (!name) return null;
  return CTOR_TO_KIND[name] ?? null;
}

interface BindingState {
  name: string;
  functionId: number;
  provenance: Provenance;
}

interface FunctionFrame {
  id: number;
  bindings: Map<string, BindingState>;
}

function emptyProvenance(kind: ProvenanceKind): Provenance {
  return {
    kind,
    invalid: false,
    escaped: false,
    queryState: "unopened",
    windowed: false,
    sysparmName: false,
    aggregates: new Set(),
  };
}

function cloneProvenance(value: Provenance): Provenance {
  return { ...value, aggregates: new Set(value.aggregates) };
}

export interface ProvenanceQuery {
  ofIdentifier(node: ESTree.Node): Provenance | null;
  ofExpression(node: unknown): Provenance | null;
  isPlatformGlobal(node: ESTree.Node): boolean;
  isPlatformCtor(node: unknown, names: readonly string[]): boolean;
  isPlatformMember(node: unknown, object: string, property?: string): boolean;
  bindings: FileBindings;
}

/**
 * Conservative constructor provenance for GlideRecord, GlideAggregate,
 * GlideAjax, and GlideDateTime.
 *
 * Reassignment and unknown escape invalidate the binding. Branch merge is
 * conservative: disagreeing paths become unknown and suppress diagnostics.
 */
export function analyzeProvenance(context: Context, ast?: ESTree.Node): ProvenanceQuery {
  const program = (ast ?? (context.sourceCode.ast as ESTree.Node | undefined)) as ESTree.Node | undefined;
  const bindings = createFileBindings(context, program);
  const provenanceAtNode = new Map<ESTree.Node, Provenance>();
  const identifierAtNode = new Map<ESTree.Node, Provenance>();

    if (!program) {
    return makeQuery(bindings, provenanceAtNode, identifierAtNode);
  }

  let functionId = 1;
  const stack: FunctionFrame[] = [{ id: functionId++, bindings: new Map() }];
  const current = () => stack[stack.length - 1]!;

  const getBinding = (name: string): BindingState | undefined => current().bindings.get(name);

  const setBinding = (name: string, provenance: Provenance): void => {
    current().bindings.set(name, { name, functionId: current().id, provenance });
  };

  const platformAlias = (node: ESTree.Node): Provenance | null => {
    const name = getName(node);
    if (!name || !PLATFORM_ALIAS_KINDS.has(name as ProvenanceKind)) return null;
    if (!bindings.isPlatformGlobal(node)) return null;
    return emptyProvenance(name as ProvenanceKind);
  };

  const expressionProvenance = (node: unknown): Provenance | null => {
    if (!isNode(node)) return null;
    if (node.type === "Identifier") {
      const name = getName(node);
      if (!name) return null;
      const state = getBinding(name);
      if (state) {
        if (state.provenance.invalid || state.provenance.escaped) return null;
        return state.provenance;
      }
      return platformAlias(node);
    }
    if (node.type === "NewExpression") {
      const ctor = getName((node as ESTree.NewExpression).callee);
      const kind = ctorProvenanceKind(ctor);
      if (!kind) return null;
      if (!bindings.isPlatformGlobal((node as ESTree.NewExpression).callee as ESTree.Node)) return null;
      return emptyProvenance(kind);
    }
    return null;
  };

  const markEscape = (node: unknown): void => {
    if (!isNode(node)) return;
    if (node.type === "Identifier") {
      const name = getName(node);
      if (!name) return;
      const state = getBinding(name);
      if (state) state.provenance.escaped = true;
    }
  };

  const assignName = (name: string, right: unknown): void => {
    const proven = expressionProvenance(right);
    if (proven) {
      const shared = isNode(right) && right.type === "Identifier" ? proven : cloneProvenance(proven);
      setBinding(name, shared);
      return;
    }
    const existing = getBinding(name);
    if (existing) existing.provenance.invalid = true;
  };

  walk(program, {
    FunctionDeclaration(node) {
      stack.push({ id: functionId++, bindings: new Map() });
      // Nested functions that read an outer binding escape that binding.
      markClosedOver(node, stack);
    },
    FunctionExpression(node) {
      stack.push({ id: functionId++, bindings: new Map() });
      markClosedOver(node, stack);
    },
    ArrowFunctionExpression(node) {
      stack.push({ id: functionId++, bindings: new Map() });
      markClosedOver(node, stack);
    },
    "FunctionDeclaration:exit"() {
      stack.pop();
    },
    "FunctionExpression:exit"() {
      stack.pop();
    },
    "ArrowFunctionExpression:exit"() {
      stack.pop();
    },
    VariableDeclarator(node) {
      const decl = node as ESTree.VariableDeclarator;
      const name = getName(decl.id);
      if (!name || !decl.init) return;
      assignName(name, decl.init);
    },
    AssignmentExpression(node) {
      const assign = node as ESTree.AssignmentExpression;
      const name = getName(assign.left);
      if (name) assignName(name, assign.right);
    },
    CallExpression(node) {
      const call = node as ESTree.CallExpression;
      const callee = call.callee;
      const property = staticPropertyName(callee);
      const objectName =
        isNode(callee) && callee.type === "MemberExpression"
          ? getName((callee as ESTree.MemberExpression).object)
          : null;
      if (objectName && property) {
        const state = getBinding(objectName);
        if (state && !state.provenance.invalid) {
          if (QUERY_OPENERS.has(property)) {
            if (state.provenance.queryState === "unopened") state.provenance.queryState = "opened";
          }
          if (property === "setLimit" || property === "chooseWindow") {
            state.provenance.windowed = true;
          }
          if (property === "addParam") {
            const key = getStringValue(call.arguments[0]);
            if (key === "sysparm_name") state.provenance.sysparmName = true;
          }
          if (property === "addAggregate") {
            const type = getStringValue(call.arguments[0]);
            const field = call.arguments[1] ? getStringValue(call.arguments[1]) : "";
            if (type) state.provenance.aggregates.add(field ? `${type}:${field}` : type);
          }
          provenanceAtNode.set(node, cloneProvenance(state.provenance));
        }
      }

      for (const arg of call.arguments) {
        if (arg && (arg as { type?: string }).type !== "SpreadElement") {
          markEscape(arg);
        }
      }
    },
    NewExpression(node) {
      const proven = expressionProvenance(node);
      if (proven) provenanceAtNode.set(node, proven);
      for (const arg of (node as ESTree.NewExpression).arguments) {
        if (arg && (arg as { type?: string }).type !== "SpreadElement") {
          markEscape(arg);
        }
      }
    },
    ReturnStatement(node) {
      markEscape((node as ESTree.ReturnStatement).argument);
    },
    Property(node) {
      markEscape((node as unknown as ESTree.ObjectProperty).value);
    },
    ArrayExpression(node) {
      for (const element of (node as ESTree.ArrayExpression).elements) {
        markEscape(element);
      }
    },
    Identifier(node) {
      const name = getName(node);
      if (!name) return;
      const state = getBinding(name);
      if (state) {
        identifierAtNode.set(node, state.provenance);
        return;
      }
      if (PLATFORM_ALIAS_KINDS.has(name as ProvenanceKind) && bindings.isPlatformGlobal(node)) {
        identifierAtNode.set(node, emptyProvenance(name as ProvenanceKind));
      }
    },
  });

  return makeQuery(bindings, provenanceAtNode, identifierAtNode);
}

function markClosedOver(fn: ESTree.Node, stack: FunctionFrame[]): void {
  if (stack.length < 2) return;
  const outer = stack[stack.length - 2];
  if (!outer) return;
  walk(fn, {
    Identifier(node) {
      const name = getName(node);
      if (!name) return;
      const state = outer.bindings.get(name);
      if (state) state.provenance.escaped = true;
    },
    FunctionDeclaration() {},
  });
}

function makeQuery(
  bindings: FileBindings,
  provenanceAtNode: Map<ESTree.Node, Provenance>,
  identifierAtNode: Map<ESTree.Node, Provenance>,
): ProvenanceQuery {
  return {
    bindings,
    ofIdentifier(node) {
      return identifierAtNode.get(node) ?? null;
    },
    ofExpression(node) {
      if (!isNode(node)) return null;
      return provenanceAtNode.get(node) ?? identifierAtNode.get(node) ?? null;
    },
    isPlatformGlobal(node) {
      return bindings.isPlatformGlobal(node);
    },
    isPlatformCtor(node, names) {
      const name = getName(node);
      if (!name || !names.includes(name)) return false;
      if (!isNode(node)) return false;
      return bindings.isPlatformGlobal(node);
    },
    isPlatformMember(node, object, property) {
      if (!isNode(node) || node.type !== "MemberExpression") return false;
      const member = node as unknown as ESTree.MemberExpression;
      const objectNode = member.object as ESTree.Node;
      const direct =
        getName(objectNode) === object && bindings.isPlatformGlobal(objectNode);
      const proven = provenanceAtNode.get(objectNode) ?? identifierAtNode.get(objectNode);
      const aliased =
        proven !== undefined &&
        proven.kind === object &&
        !proven.invalid &&
        !proven.escaped;
      if (!direct && !aliased) return false;
      if (property === undefined) return true;
      return staticPropertyName(member) === property;
    },
  };
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
