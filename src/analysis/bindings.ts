import type { Context, ESTree } from "@oxlint/plugins";
import { getName, isNode, walk } from "../utils/ast.js";

export type BindingKind = "var" | "let" | "const" | "param" | "function" | "class" | "import" | "catch";

export interface LexicalBinding {
  /** Stable identity for this declaration. Distinct from runtime object identity. */
  id: number;
  name: string;
  kind: BindingKind;
  node: ESTree.Node;
  scopeId: number;
}

export type ScopeKind = "module" | "function" | "block" | "loop" | "switch" | "catch";

export interface ScopeNode {
  id: number;
  kind: ScopeKind;
  block: ESTree.Node;
  parent: ScopeNode | null;
  bindings: Map<string, LexicalBinding>;
}

export class ScopeTree {
  readonly root: ScopeNode | null = null;
  private nextId = 1;
  private nextBindingId = 1;
  private readonly byBlock = new Map<ESTree.Node, ScopeNode>();
  private readonly byId = new Map<number, ScopeNode>();
  private current: ScopeNode | null = null;

  enter(kind: ScopeNode["kind"], block: ESTree.Node): ScopeNode {
    const scope: ScopeNode = {
      id: this.nextId++,
      kind,
      block,
      parent: this.current,
      bindings: new Map(),
    };
    this.byBlock.set(block, scope);
    this.byId.set(scope.id, scope);
    this.current = scope;
    if (!this.root) {
      (this as { root: ScopeNode }).root = scope;
    }
    return scope;
  }

  exit(block: ESTree.Node): void {
    if (this.current?.block === block) {
      this.current = this.current.parent;
    }
  }

  declare(name: string, kind: BindingKind, node: ESTree.Node): void {
    const target = kind === "var" ? this.varScope() : this.current;
    if (!target) return;
    target.bindings.set(name, {
      id: this.nextBindingId++,
      name,
      kind,
      node,
      scopeId: target.id,
    });
  }

  private varScope(): ScopeNode | null {
    let scope = this.current;
    while (scope) {
      if (scope.kind === "function" || scope.kind === "module") return scope;
      scope = scope.parent;
    }
    return this.current;
  }

  scopeById(id: number): ScopeNode | null {
    return this.byId.get(id) ?? null;
  }

  scopeForNode(node: ESTree.Node, ancestors: readonly ESTree.Node[] = []): ScopeNode | null {
    if (this.byBlock.has(node)) return this.byBlock.get(node) ?? null;
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestor = ancestors[i];
      if (ancestor && this.byBlock.has(ancestor)) return this.byBlock.get(ancestor) ?? null;
    }
    return this.innermostScopeContaining(node) ?? this.root;
  }

  private innermostScopeContaining(node: ESTree.Node): ScopeNode | null {
    const start = (node as { start?: number }).start;
    const end = (node as { end?: number }).end;
    if (typeof start !== "number" || typeof end !== "number") return null;
    let best: ScopeNode | null = null;
    let bestSpan = Number.POSITIVE_INFINITY;
    for (const scope of this.byBlock.values()) {
      const blockStart = (scope.block as { start?: number }).start;
      const blockEnd = (scope.block as { end?: number }).end;
      if (typeof blockStart !== "number" || typeof blockEnd !== "number") continue;
      if (start < blockStart || end > blockEnd) continue;
      const span = blockEnd - blockStart;
      if (span < bestSpan) {
        best = scope;
        bestSpan = span;
      }
    }
    return best;
  }

  resolve(name: string, node: ESTree.Node, ancestors: readonly ESTree.Node[] = []): LexicalBinding | null {
    let scope = this.scopeForNode(node, ancestors);
    while (scope) {
      const binding = scope.bindings.get(name);
      if (binding) return binding;
      scope = scope.parent;
    }
    return null;
  }

  hasLocalBinding(name: string, node: ESTree.Node, ancestors: readonly ESTree.Node[] = []): boolean {
    return this.resolve(name, node, ancestors) !== null;
  }
}

export function collectPatternNames(node: unknown, names: string[]): void {
  if (!isNode(node)) return;
  switch (node.type) {
    case "Identifier":
      names.push((node as { name: string }).name);
      return;
    case "ObjectPattern":
      for (const prop of (node as ESTree.ObjectPattern).properties) {
        if ((prop as { type?: string }).type === "RestElement") {
          collectPatternNames((prop as { argument?: unknown }).argument, names);
        } else if ((prop as { type?: string }).type === "Property") {
          collectPatternNames((prop as { value?: unknown }).value, names);
        }
      }
      return;
    case "ArrayPattern":
      for (const element of (node as ESTree.ArrayPattern).elements) {
        collectPatternNames(element, names);
      }
      return;
    case "RestElement":
      collectPatternNames((node as { argument?: unknown }).argument, names);
      return;
    case "AssignmentPattern":
      collectPatternNames((node as ESTree.AssignmentPattern).left, names);
      return;
    default:
      return;
  }
}

function declareParams(
  tree: ScopeTree,
  node: { params: readonly unknown[] },
): void {
  for (const param of node.params) {
    const names: string[] = [];
    collectPatternNames(param, names);
    for (const name of names) tree.declare(name, "param", param as unknown as ESTree.Node);
  }
}

export function buildScopeTree(ast: ESTree.Node): ScopeTree {
  const tree = new ScopeTree();
  walk(ast, {
    Program(node) {
      tree.enter("module", node);
    },
    "Program:exit"(node) {
      tree.exit(node);
    },
    FunctionDeclaration(node) {
      const name = getName((node as { id?: ESTree.Node }).id);
      if (name) tree.declare(name, "function", node);
      tree.enter("function", node);
      declareParams(tree, node as { params: readonly unknown[] });
    },
    "FunctionDeclaration:exit"(node) {
      tree.exit(node);
    },
    FunctionExpression(node) {
      tree.enter("function", node);
      const name = getName((node as { id?: ESTree.Node }).id);
      if (name) tree.declare(name, "function", node);
      declareParams(tree, node as { params: readonly unknown[] });
    },
    "FunctionExpression:exit"(node) {
      tree.exit(node);
    },
    ArrowFunctionExpression(node) {
      tree.enter("function", node);
      declareParams(tree, node as ESTree.ArrowFunctionExpression);
    },
    "ArrowFunctionExpression:exit"(node) {
      tree.exit(node);
    },
    BlockStatement(node) {
      tree.enter("block", node);
    },
    "BlockStatement:exit"(node) {
      tree.exit(node);
    },
    CatchClause(node) {
      tree.enter("catch", node);
      const param = (node as ESTree.CatchClause).param;
      if (param) {
        const names: string[] = [];
        collectPatternNames(param, names);
        for (const name of names) tree.declare(name, "catch", node);
      }
    },
    "CatchClause:exit"(node) {
      tree.exit(node);
    },
    ForStatement(node) {
      tree.enter("loop", node);
    },
    "ForStatement:exit"(node) {
      tree.exit(node);
    },
    ForInStatement(node) {
      tree.enter("loop", node);
    },
    "ForInStatement:exit"(node) {
      tree.exit(node);
    },
    ForOfStatement(node) {
      tree.enter("loop", node);
    },
    "ForOfStatement:exit"(node) {
      tree.exit(node);
    },
    SwitchStatement(node) {
      tree.enter("switch", node);
    },
    "SwitchStatement:exit"(node) {
      tree.exit(node);
    },
    ImportDeclaration(node) {
      for (const spec of (node as ESTree.ImportDeclaration).specifiers) {
        const local = getName((spec as { local?: ESTree.Node }).local);
        if (local) tree.declare(local, "import", spec as unknown as ESTree.Node);
      }
    },
    VariableDeclaration(node) {
      const decl = node as ESTree.VariableDeclaration;
      const kind = decl.kind === "var" ? "var" : decl.kind === "let" ? "let" : "const";
      for (const item of decl.declarations) {
        const names: string[] = [];
        collectPatternNames(item.id, names);
        for (const name of names) tree.declare(name, kind, item as unknown as ESTree.Node);
      }
    },
    ClassDeclaration(node) {
      const name = getName((node as { id?: ESTree.Node }).id);
      if (name) tree.declare(name, "class", node);
    },
  });
  return tree;
}

export interface FileBindings {
  tree: ScopeTree;
  isLocalName(name: string, node: ESTree.Node, ancestors?: readonly ESTree.Node[]): boolean;
  isPlatformGlobal(node: ESTree.Node, ancestors?: readonly ESTree.Node[]): boolean;
}

interface HostScope {
  type?: string;
  set?: Map<string, { defs: ReadonlyArray<{ type?: string }> }>;
  variables?: ReadonlyArray<{ name: string; defs: ReadonlyArray<{ type?: string }> }>;
  upper?: HostScope | null;
}

/**
 * Host `isGlobalReference` is true only for configured JavaScript globals.
 * ServiceNow names such as `gs` and `current` are unresolved identifiers, so
 * a false result does not mean the name is local. Use host scope defs first.
 */
function hostHasDefinedBinding(context: Context, node: ESTree.Node, name: string): boolean | undefined {
  const sourceCode = context.sourceCode as {
    getScope?: (node: ESTree.Node) => HostScope | null;
  };
  if (typeof sourceCode.getScope !== "function") return undefined;
  try {
    let scope: HostScope | null | undefined = sourceCode.getScope(node);
    while (scope) {
      const variable = scope.set?.get(name) ?? scope.variables?.find((item) => item.name === name);
      if (
        variable &&
        variable.defs.some((def) => def.type !== "ImplicitGlobalVariable")
      ) {
        return true;
      }
      scope = scope.upper;
    }
    return false;
  } catch {
    return undefined;
  }
}

export function createFileBindings(context: Context, ast?: ESTree.Node): FileBindings {
  const program = (ast ?? (context.sourceCode.ast as ESTree.Node | undefined)) as ESTree.Node | undefined;
  const tree = program ? buildScopeTree(program) : new ScopeTree();

  return {
    tree,
    isLocalName(name, node, ancestors = []) {
      const host = hostHasDefinedBinding(context, node, name);
      if (host === true) return true;
      return tree.hasLocalBinding(name, node, ancestors);
    },
    isPlatformGlobal(node, ancestors = []) {
      const name = getName(node);
      if (!name) return false;
      const host = hostHasDefinedBinding(context, node, name);
      if (host === true) return false;
      if (tree.hasLocalBinding(name, node, ancestors)) return false;
      return true;
    },
  };
}

export function isFunctionLike(node: unknown): boolean {
  return (
    isNode(node) &&
    (node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression")
  );
}
